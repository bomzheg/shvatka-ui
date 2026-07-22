import {effect, Injectable, NgZone, signal} from "@angular/core";
import {Observable} from "rxjs";
import {HttpAdapter} from "../http/http.adapter";
import {AuthStateService} from "../auth/auth-state.service";
import {MergeTimelineItem} from "../admin/admin.models";
import {
  ActionRequest,
  ActionRequestList,
  NotificationsPage,
  UnreadCount,
} from "./notifications.models";

const UNREAD_POLL_INTERVAL_MS = 60_000;

/**
 * API access for the notifications feed / action requests plus the shared
 * unread counter.
 *
 * The unread counter is the single source of truth for both the header bell
 * badge and the PWA icon badge: it is polled while the user is authenticated,
 * refreshed when the tab becomes visible or a push arrives, and mirrored to
 * the app icon via the Badging API (the push service worker keeps its own
 * persisted count for background pushes and is re-synced from here, see
 * push-sw.js).
 */
@Injectable({providedIn: "root"})
export class NotificationsService {
  readonly unreadCount = signal(0);

  private pollTimer: number | undefined;
  private listenersBound = false;

  constructor(
    private http: HttpAdapter,
    private authState: AuthStateService,
    private zone: NgZone,
  ) {
    // allowSignalWrites: resetting the counter on logout is a signal write
    // from inside an effect, which Angular forbids by default (NG0600).
    effect(() => {
      if (this.authState.isAuthenticated()) {
        this.startPolling();
      } else {
        this.stopPolling();
        this.unreadCount.set(0);
      }
    }, {allowSignalWrites: true});
    effect(() => {
      const count = this.unreadCount();
      // While the auth state is still unknown (app just booted), leave the
      // icon badge alone: it may hold a valid count from background pushes.
      if (this.authState.isAuthenticated() || this.authState.isUnauthenticated()) {
        this.applyAppBadge(count);
      }
    });
  }

  /**
   * Called once on app bootstrap: reacts to the tab becoming visible and to
   * pushes delivered while the app is open, so the badge never goes stale.
   */
  init(): void {
    if (this.listenersBound || typeof document === "undefined") {
      return;
    }
    this.listenersBound = true;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.refreshUnreadCount();
      }
    });

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
        if (event.data?.type === "push") {
          this.zone.run(() => this.refreshUnreadCount());
        }
      });
    }
  }

  /** Re-reads the unread counter; call after any read/accept/decline action. */
  refreshUnreadCount(): void {
    if (!this.authState.isAuthenticated()) {
      return;
    }
    this.http.get<UnreadCount>("/notifications/unread-count").subscribe({
      next: response => this.unreadCount.set(response.count),
      error: error => console.error("notifications: unread-count failed", error),
    });
  }

  getNotifications(options: {unread?: boolean; limit?: number; offset?: number} = {}): Observable<NotificationsPage> {
    const params = new URLSearchParams();
    if (options.unread !== undefined) {
      params.set("unread", String(options.unread));
    }
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options.offset !== undefined) {
      params.set("offset", String(options.offset));
    }
    const query = params.toString();
    return this.http.get<NotificationsPage>(`/notifications${query ? `?${query}` : ""}`);
  }

  markRead(ids: number[]): Observable<void> {
    return this.http.post<void>("/notifications/read", {ids});
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>("/notifications/read-all", {});
  }

  listRequests(direction: "incoming" | "outgoing", pending?: boolean): Observable<ActionRequestList> {
    const params = new URLSearchParams({direction});
    if (pending !== undefined) {
      params.set("pending", String(pending));
    }
    return this.http.get<ActionRequestList>(`/requests?${params.toString()}`);
  }

  /**
   * Creation endpoints are idempotent on the backend: if an identical request
   * is already pending, the existing one is returned instead of a duplicate.
   */
  createTeamJoinInvite(teamId: number, playerId: number, role?: string, emoji?: string): Observable<ActionRequest> {
    const body: Record<string, unknown> = {team_id: teamId, player_id: playerId};
    if (role) {
      body["role"] = role;
    }
    if (emoji) {
      body["emoji"] = emoji;
    }
    return this.http.post<ActionRequest>("/requests/team-join-invite", body);
  }

  createTeamJoinRequest(teamId: number): Observable<ActionRequest> {
    return this.http.post<ActionRequest>("/requests/team-join", {team_id: teamId});
  }

  createOrgInvite(gameId: number, playerId: number): Observable<ActionRequest> {
    return this.http.post<ActionRequest>("/requests/org-invite", {game_id: gameId, player_id: playerId});
  }

  /** Invites a player to become an author ("аппрув"); caller must be an author. */
  createPromotionInvite(playerId: number): Observable<ActionRequest> {
    return this.http.post<ActionRequest>("/requests/promotion-invite", {player_id: playerId});
  }

  /**
   * `timeline` applies to `player_merge` requests only: when a plain accept is
   * rejected with a 422 `MergeError` (incompatible team histories), retry with
   * a manually built timeline that replaces both players' histories.
   */
  acceptRequest(id: number, timeline?: MergeTimelineItem[]): Observable<ActionRequest> {
    return this.http.post<ActionRequest>(`/requests/${id}/accept`, timeline ? {timeline} : {});
  }

  declineRequest(id: number): Observable<ActionRequest> {
    return this.http.post<ActionRequest>(`/requests/${id}/decline`, {});
  }

  cancelRequest(id: number): Observable<ActionRequest> {
    return this.http.post<ActionRequest>(`/requests/${id}/cancel`, {});
  }

  private startPolling(): void {
    if (this.pollTimer !== undefined) {
      return;
    }
    this.refreshUnreadCount();
    // Polling runs outside the Angular zone so a background tick does not
    // trigger change detection; the signal update re-enters the zone itself.
    this.zone.runOutsideAngular(() => {
      this.pollTimer = window.setInterval(
        () => this.zone.run(() => this.refreshUnreadCount()),
        UNREAD_POLL_INTERVAL_MS,
      );
    });
  }

  private stopPolling(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Mirrors the unread count to the installed-app icon (Badging API) and to
   * the push service worker's persisted counter, so background pushes keep
   * incrementing from the right base.
   */
  private applyAppBadge(count: number): void {
    if (typeof navigator === "undefined") {
      return;
    }

    const badging = navigator as Navigator & {
      setAppBadge?(contents?: number): Promise<void>;
      clearAppBadge?(): Promise<void>;
    };
    if (count > 0) {
      badging.setAppBadge?.(count).catch(() => undefined);
    } else {
      badging.clearAppBadge?.().catch(() => undefined);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration()
        .then(registration => registration?.active?.postMessage({type: "set-badge-count", count}))
        .catch(() => undefined);
    }
  }
}
