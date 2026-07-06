import {Component, OnInit} from "@angular/core";
import {DatePipe} from "@angular/common";
import {MatIcon} from "@angular/material/icon";
import {HttpErrorResponse} from "@angular/common/http";
import {finalize, forkJoin} from "rxjs";
import {AppIcon} from "../ui/icons";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {NotificationsService} from "./notifications.service";
import {notificationIcon, notificationText} from "./notification-render";
import {
  ACTIONABLE_NOTIFICATION_TYPES,
  ActionRequest,
  AppNotification,
  RequestStatus,
} from "./notifications.models";

const PAGE_SIZE = 50;

type RequestAction = "accept" | "decline" | "cancel";

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

@Component({
  selector: "app-notifications",
  standalone: true,
  imports: [DatePipe, MatIcon],
  templateUrl: "./notifications.component.html",
  styleUrl: "./notifications.component.scss",
})
export class NotificationsComponent implements OnInit {
  items: NotificationView[] = [];
  isLoading = false;
  isLoadingMore = false;
  loadFailed = false;
  hasMore = false;

  private offset = 0;
  private requestsById = new Map<number, RequestView>();

  constructor(
    private notificationsService: NotificationsService,
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  ngOnInit(): void {
    this.loadRequests();
    this.loadFirstPage();
  }

  unreadCount(): number {
    return this.notificationsService.unreadCount();
  }

  text(view: NotificationView): string {
    return notificationText(view.notification, this.userService.getMe()?.id);
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
        },
        error: error => this.handleRequestError(error),
      });
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
   * Loads all of the caller's requests (both directions, any status) so feed
   * items can show live Accept/Decline/Cancel actions or the final status.
   */
  private loadRequests(): void {
    forkJoin({
      incoming: this.notificationsService.listRequests("incoming"),
      outgoing: this.notificationsService.listRequests("outgoing"),
    }).subscribe({
      next: ({incoming, outgoing}) => {
        const map = new Map<number, RequestView>();
        // Outgoing first: for requests visible in both directions the caller
        // is the initiator, so the "cancel" action wins over accept/decline.
        outgoing.items.forEach(request => map.set(request.id, {request, direction: "outgoing", busy: false}));
        incoming.items.forEach(request => {
          if (!map.has(request.id)) {
            map.set(request.id, {request, direction: "incoming", busy: false});
          }
        });
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
