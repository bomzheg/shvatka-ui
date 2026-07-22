import {Component, OnInit} from "@angular/core";
import {DatePipe} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {RouterLink} from "@angular/router";
import {MatIcon} from "@angular/material/icon";
import {HttpErrorResponse} from "@angular/common/http";
import {catchError, finalize, forkJoin, of} from "rxjs";
import {AppIcon} from "../ui/icons";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {AdminService} from "../admin/admin.service";
import {WaiverPoint} from "../admin/admin.models";
import {AdminMergeTimelineComponent, TimelineState} from "../admin/admin-merge-timeline.component";
import {TeamService} from "../team/team.service";
import {TeamPlayerHistory} from "../team/team.models";
import {NotificationsService} from "./notifications.service";
import {notificationIcon, notificationText, requestResultText, requestText, typeIcon} from "./notification-render";
import {
  ACTIONABLE_NOTIFICATION_TYPES,
  ADMIN_RESOLVED_REQUEST_TYPES,
  ActionRequest,
  AppNotification,
  NotificationType,
  RequestStatus,
  RequestType,
} from "./notifications.models";

const PAGE_SIZE = 50;

type RequestAction = "accept" | "decline" | "cancel";
type NotificationsTab = "feed" | "requests";

interface RequestView {
  request: ActionRequest;
  direction: "incoming" | "outgoing";
  busy: boolean;
}

interface NotificationView {
  notification: AppNotification;
  /** Unread at load time; keeps the highlight after we mark it read on the server. */
  wasUnread: boolean;
  icon: AppIcon;
}

/**
 * Inline timeline editor opened when accepting a `player_merge` request fails
 * with a 422 `MergeError` (incompatible team histories). At most one editor is
 * open at a time; it lives under the request's row in the incoming list.
 */
interface MergeEditor {
  requestId: number;
  loading: boolean;
  points: WaiverPoint[];
  history: TeamPlayerHistory[];
  state: TimelineState | null;
  serverError: string | null;
  submitting: boolean;
}

@Component({
  selector: "app-notifications",
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, MatIcon, AdminMergeTimelineComponent],
  templateUrl: "./notifications.component.html",
  styleUrl: "./notifications.component.scss",
})
export class NotificationsComponent implements OnInit {
  items: NotificationView[] = [];
  isLoading = false;
  isLoadingMore = false;
  loadFailed = false;
  hasMore = false;

  activeTab: NotificationsTab = "feed";
  incomingRequests: RequestView[] = [];
  outgoingRequests: RequestView[] = [];
  isLoadingRequests = false;
  /** Requests tab filter: show only pending (default) or the full history. */
  pendingOnly = true;

  mergeEditor: MergeEditor | null = null;

  private offset = 0;
  private requestsById = new Map<number, RequestView>();

  constructor(
    private notificationsService: NotificationsService,
    private userService: UserService,
    private snackbar: SnackbarService,
    private adminService: AdminService,
    private teamService: TeamService,
  ) {
  }

  ngOnInit(): void {
    this.loadRequests();
    this.loadFirstPage();
  }

  unreadCount(): number {
    return this.notificationsService.unreadCount();
  }

  selectTab(tab: NotificationsTab): void {
    this.activeTab = tab;
  }

  text(view: NotificationView): string {
    const notification = view.notification;
    // A resolved-request feed item carries only a bare "принят/отклонён"
    // payload; enrich it from the originating request (loaded into
    // requestsById) so it names the request kind and the other party.
    if (notification.request_id !== null
      && (notification.type === NotificationType.requestAccepted
        || notification.type === NotificationType.requestDeclined)) {
      const linked = this.requestsById.get(notification.request_id);
      if (linked) {
        return requestResultText(linked.request, notification.type === NotificationType.requestAccepted);
      }
    }
    return notificationText(notification, this.userService.getMe()?.id);
  }

  requestRowText(requestView: RequestView): string {
    return requestText(requestView.request, this.userService.getMe()?.id);
  }

  requestRowIcon(requestView: RequestView): AppIcon {
    return typeIcon(requestView.request.type);
  }

  visibleIncoming(): RequestView[] {
    return this.filterRequests(this.incomingRequests);
  }

  visibleOutgoing(): RequestView[] {
    return this.filterRequests(this.outgoingRequests);
  }

  pendingRequestsCount(): number {
    return this.incomingRequests.concat(this.outgoingRequests)
      .filter(view => view.request.status === RequestStatus.pending)
      .length;
  }

  private filterRequests(views: RequestView[]): RequestView[] {
    if (!this.pendingOnly) {
      return views;
    }
    return views.filter(view => view.request.status === RequestStatus.pending);
  }

  severityClass(view: NotificationView): string {
    return `severity-${view.notification.severity}`;
  }

  /** The related request, when this feed item is an invite/ask-to-join. */
  requestView(view: NotificationView): RequestView | undefined {
    const requestId = view.notification.request_id;
    if (requestId === null || !ACTIONABLE_NOTIFICATION_TYPES.includes(view.notification.type)) {
      return undefined;
    }
    return this.requestsById.get(requestId);
  }

  isPending(requestView: RequestView): boolean {
    return requestView.request.status === RequestStatus.pending;
  }

  /**
   * Merge requests are resolved by superusers regardless of who initiated
   * them — a superuser who filed the merge themself sees it as "outgoing"
   * (cancel) but must still be able to accept it. The primary player of a
   * `player_merge` sees the request too but may only decline it. Hidden while
   * the timeline editor is open — the editor has its own accept button.
   */
  showAccept(requestView: RequestView): boolean {
    if (this.isMergeEditorFor(requestView)) {
      return false;
    }
    if (ADMIN_RESOLVED_REQUEST_TYPES.includes(requestView.request.type)) {
      return this.userService.isAdmin();
    }
    return requestView.direction === "incoming";
  }

  showDecline(requestView: RequestView): boolean {
    return requestView.direction === "incoming";
  }

  showCancel(requestView: RequestView): boolean {
    return requestView.direction === "outgoing";
  }

  /**
   * Deep link to the admin's manual merge page prefilled with both sides —
   * the escape hatch when the request can't be accepted as-is (linked
   * identities conflict, timeline can't be built, etc.). Merging there does
   * NOT resolve the request; it has to be declined afterwards.
   */
  adminMergeLink(requestView: RequestView): {path: string; params: {primary: number; secondary: number}} | null {
    if (!this.userService.isAdmin()) {
      return null;
    }
    const payload = requestView.request.payload ?? {};
    if (requestView.request.type === RequestType.playerMerge) {
      const primary = payload["primary_player_id"] ?? requestView.request.target_player_id;
      const secondary = payload["secondary_player_id"];
      if (typeof primary !== "number" || typeof secondary !== "number") {
        return null;
      }
      return {path: "/admin/merge/players", params: {primary, secondary}};
    }
    if (requestView.request.type === RequestType.teamMerge) {
      const primary = payload["primary_team_id"] ?? requestView.request.team_id;
      const secondary = payload["secondary_team_id"];
      if (typeof primary !== "number" || typeof secondary !== "number") {
        return null;
      }
      return {path: "/admin/merge/teams", params: {primary, secondary}};
    }
    return null;
  }

  isMergeEditorFor(requestView: RequestView): boolean {
    return this.mergeEditor?.requestId === requestView.request.id;
  }

  statusLabel(requestView: RequestView): string {
    switch (requestView.request.status) {
      case RequestStatus.accepted:
        return "Принят";
      case RequestStatus.declined:
        return "Отклонён";
      case RequestStatus.cancelled:
        return "Отменён";
      case RequestStatus.expired:
        return "Истёк";
      default:
        return requestView.request.status;
    }
  }

  respond(requestView: RequestView, action: RequestAction): void {
    if (requestView.busy) {
      return;
    }
    requestView.busy = true;

    const call = action === "accept"
      ? this.notificationsService.acceptRequest(requestView.request.id)
      : action === "decline"
        ? this.notificationsService.declineRequest(requestView.request.id)
        : this.notificationsService.cancelRequest(requestView.request.id);

    call
      .pipe(finalize(() => {
        requestView.busy = false;
      }))
      .subscribe({
        next: updated => {
          requestView.request = updated;
          this.notificationsService.refreshUnreadCount();
          if (action === "accept") {
            this.snackbar.success("Запрос принят");
          } else if (action === "decline") {
            this.snackbar.info("Запрос отклонён");
          } else {
            this.snackbar.info("Запрос отменён");
          }
          if (this.isMergeEditorFor(requestView)) {
            this.closeMergeEditor();
          }
        },
        error: error => {
          // Incompatible team histories: the request stays pending, and the
          // admin has to build the merged timeline by hand and accept again.
          if (action === "accept"
            && requestView.request.type === RequestType.playerMerge
            && this.isMergeError(error)) {
            this.snackbar.info("Истории команд игроков несовместимы — соберите таймлайн вручную");
            this.openMergeEditor(requestView);
            return;
          }
          this.handleRequestError(error);
        },
      });
  }

  onMergeTimelineChange(state: TimelineState): void {
    if (this.mergeEditor) {
      this.mergeEditor.state = state;
      this.mergeEditor.serverError = null;
    }
  }

  closeMergeEditor(): void {
    this.mergeEditor = null;
  }

  /** Retry the accept with the manually built timeline. */
  submitMergeTimeline(requestView: RequestView): void {
    const editor = this.mergeEditor;
    if (!editor || editor.requestId !== requestView.request.id
      || editor.submitting || !editor.state?.valid) {
      return;
    }
    editor.submitting = true;
    this.notificationsService.acceptRequest(requestView.request.id, editor.state.items)
      .pipe(finalize(() => {
        editor.submitting = false;
      }))
      .subscribe({
        next: updated => {
          requestView.request = updated;
          this.closeMergeEditor();
          this.notificationsService.refreshUnreadCount();
          this.snackbar.success("Игроки объединены");
        },
        error: error => {
          if (this.isMergeError(error)) {
            // Keep the editor open and show the rejection next to it.
            const description = error instanceof HttpErrorResponse ? error.error?.description : undefined;
            editor.serverError = typeof description === "string" && description
              ? description
              : "Сервер отклонил таймлайн — проверьте интервалы";
            return;
          }
          this.handleRequestError(error);
        },
      });
  }

  /**
   * Loads waiver points and team histories of both players and opens the
   * timeline editor under the request's row on the "Заявки" tab.
   */
  private openMergeEditor(requestView: RequestView): void {
    const payload = requestView.request.payload ?? {};
    const primaryId = typeof payload["primary_player_id"] === "number"
      ? payload["primary_player_id"]
      : requestView.request.target_player_id;
    const secondaryId = typeof payload["secondary_player_id"] === "number"
      ? payload["secondary_player_id"]
      : null;
    if (primaryId === null || secondaryId === null) {
      this.snackbar.error("В заявке нет идентификаторов игроков — обновите страницу");
      return;
    }

    // The editor renders only in the incoming list of the requests tab.
    this.activeTab = "requests";
    const editor: MergeEditor = {
      requestId: requestView.request.id,
      loading: true,
      points: [],
      history: [],
      state: null,
      serverError: null,
      submitting: false,
    };
    this.mergeEditor = editor;

    forkJoin({
      primaryPoints: this.adminService.getWaiverPoints(primaryId),
      secondaryPoints: this.adminService.getWaiverPoints(secondaryId),
      primaryStat: this.teamService.getPlayerStat(primaryId).pipe(catchError(() => of(null))),
      secondaryStat: this.teamService.getPlayerStat(secondaryId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({primaryPoints, secondaryPoints, primaryStat, secondaryStat}) => {
        if (this.mergeEditor !== editor) {
          return;
        }
        // The merge validates against the union of both players' points; dedupe shared games.
        const seen = new Set<string>();
        editor.points = [...primaryPoints.items, ...secondaryPoints.items]
          .filter(point => {
            const key = `${point.game.id}:${point.team.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => Date.parse(a.at_since) - Date.parse(b.at_since));
        // Primary player's entries first: they win overlaps in the auto-built timeline.
        editor.history = [...(primaryStat?.team_history ?? []), ...(secondaryStat?.team_history ?? [])];
        editor.loading = false;
      },
      error: () => {
        if (this.mergeEditor === editor) {
          this.closeMergeEditor();
        }
        this.snackbar.error("Не удалось загрузить вейверы игроков");
      },
    });
  }

  private isMergeError(error: unknown): boolean {
    return error instanceof HttpErrorResponse
      && error.status === 422
      && error.error?.type === "MergeError";
  }

  markAllRead(): void {
    this.notificationsService.markAllRead().subscribe({
      next: () => {
        this.items.forEach(view => {
          view.wasUnread = false;
          view.notification.read = true;
        });
        this.notificationsService.refreshUnreadCount();
      },
      error: () => this.snackbar.error("Не удалось отметить уведомления прочитанными"),
    });
  }

  loadMore(): void {
    if (this.isLoadingMore) {
      return;
    }
    this.isLoadingMore = true;
    this.notificationsService.getNotifications({limit: PAGE_SIZE, offset: this.offset})
      .pipe(finalize(() => {
        this.isLoadingMore = false;
      }))
      .subscribe({
        next: page => this.appendPage(page.items),
        error: () => this.snackbar.error("Не удалось загрузить уведомления"),
      });
  }

  private loadFirstPage(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.notificationsService.getNotifications({limit: PAGE_SIZE, offset: 0})
      .pipe(finalize(() => {
        this.isLoading = false;
      }))
      .subscribe({
        next: page => this.appendPage(page.items),
        error: () => {
          this.loadFailed = true;
        },
      });
  }

  private appendPage(notifications: AppNotification[]): void {
    const views = notifications.map(notification => ({
      notification,
      wasUnread: !notification.read,
      icon: notificationIcon(notification),
    }));
    this.items = [...this.items, ...views];
    this.offset += notifications.length;
    this.hasMore = notifications.length === PAGE_SIZE;
    this.markLoadedAsRead(notifications);
  }

  /** Opening the feed counts as reading: mark everything just loaded as read. */
  private markLoadedAsRead(notifications: AppNotification[]): void {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) {
      return;
    }
    this.notificationsService.markRead(unreadIds).subscribe({
      next: () => this.notificationsService.refreshUnreadCount(),
      error: error => console.error("notifications: mark read failed", error),
    });
  }

  /**
   * Loads all of the caller's requests (both directions, any status). The
   * same RequestView objects back the "Заявки" tab lists and the feed's
   * per-notification actions, so responding in one place updates the other.
   */
  private loadRequests(): void {
    this.isLoadingRequests = true;
    this.closeMergeEditor();
    forkJoin({
      incoming: this.notificationsService.listRequests("incoming"),
      outgoing: this.notificationsService.listRequests("outgoing"),
    })
      .pipe(finalize(() => {
        this.isLoadingRequests = false;
      }))
      .subscribe({
        next: ({incoming, outgoing}) => {
          const byDate = (a: RequestView, b: RequestView) =>
            Date.parse(b.request.created_at) - Date.parse(a.request.created_at);

          this.outgoingRequests = outgoing.items
            .map(request => ({request, direction: "outgoing" as const, busy: false}))
            .sort(byDate);
          // A manager's own ask-to-join can show up in both directions; the
          // initiator's view (cancel) wins, so drop such duplicates here.
          const outgoingIds = new Set(this.outgoingRequests.map(view => view.request.id));
          this.incomingRequests = incoming.items
            .filter(request => !outgoingIds.has(request.id))
            .map(request => ({request, direction: "incoming" as const, busy: false}))
            .sort(byDate);

          const map = new Map<number, RequestView>();
          this.outgoingRequests.forEach(view => map.set(view.request.id, view));
          this.incomingRequests.forEach(view => map.set(view.request.id, view));
          this.requestsById = map;
        },
        error: error => console.error("notifications: load requests failed", error),
      });
  }

  private handleRequestError(error: unknown): void {
    const backendType = error instanceof HttpErrorResponse ? error.error?.type : undefined;
    if (backendType === "RequestNotPending") {
      this.snackbar.info("Этот запрос уже обработан");
      this.loadRequests();
      return;
    }
    const description = error instanceof HttpErrorResponse ? error.error?.description : undefined;
    this.snackbar.error(typeof description === "string" && description
      ? description
      : "Не удалось выполнить действие");
  }
}
