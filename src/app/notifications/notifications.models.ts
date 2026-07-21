/**
 * Backend contracts for the notifications feed and user-to-user action
 * requests (team-join invites, ask-to-join, org invites).
 *
 * Enum-like fields (`type`, `severity`, `status`) are typed as `string` on
 * purpose: the backend treats them as open enums, so the UI must render an
 * unknown value gracefully instead of failing to parse it. Known values are
 * listed in the companion constants below.
 */

/** Denormalized render context; keys depend on the notification/request type. */
export type NotificationPayload = Record<string, unknown>;

export interface AppNotification {
  id: number;
  type: string;
  severity: string;
  payload: NotificationPayload;
  created_at: string;
  read: boolean;
  actor_id: number | null;
  request_id: number | null;
}

export interface NotificationsPage {
  items: AppNotification[];
  limit: number;
  offset: number;
  unread_only: boolean;
}

export interface UnreadCount {
  count: number;
}

export interface ActionRequest {
  id: number;
  type: string;
  status: string;
  initiator_id: number;
  target_player_id: number | null;
  team_id: number | null;
  game_id: number | null;
  payload: NotificationPayload;
  created_at: string;
  responded_at: string | null;
}

export interface ActionRequestList {
  items: ActionRequest[];
}

/** Known NotificationType values (open enum). */
export const NotificationType = {
  playerJoinedTeam: "player_joined_team",
  playerLeftTeam: "player_left_team",
  teamRenamed: "team_renamed",
  orgAdded: "org_added",
  gameScheduleChanged: "game_schedule_changed",
  seasonScheduleChanged: "season_schedule_changed",
  teamJoinInvite: "team_join_invite",
  teamJoinRequest: "team_join_request",
  orgInvite: "org_invite",
  teamMergeRequest: "team_merge_request",
  playerMergeRequest: "player_merge_request",
  requestAccepted: "request_accepted",
  requestDeclined: "request_declined",
} as const;

/**
 * Known ActionRequest `type` values that differ from the notification `type`
 * announcing them (open enum). Merge requests are resolved by superusers;
 * a `player_merge` also appears in the primary player's own incoming list,
 * where they may only decline it.
 */
export const RequestType = {
  teamMerge: "team_merge",
  playerMerge: "player_merge",
} as const;

/** Request types resolvable only by a superuser (accept is admin-only). */
export const ADMIN_RESOLVED_REQUEST_TYPES: readonly string[] = [
  RequestType.teamMerge,
  RequestType.playerMerge,
];

/** Known RequestStatus values (open enum). */
export const RequestStatus = {
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  cancelled: "cancelled",
  expired: "expired",
} as const;

/** Notification types that reference an ActionRequest and may carry actions. */
export const ACTIONABLE_NOTIFICATION_TYPES: readonly string[] = [
  NotificationType.teamJoinInvite,
  NotificationType.teamJoinRequest,
  NotificationType.orgInvite,
  NotificationType.teamMergeRequest,
  NotificationType.playerMergeRequest,
];
