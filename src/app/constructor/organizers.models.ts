// The organizers of a game, under /games/{id}/organizers. snake_case
// throughout, so an object round-trips between the server and the ui.

/** Standard player projection used across the API. */
export interface OrgPlayer {
  id: number;
  can_be_author: boolean;
  name_mention: string;
}

/** The four independent organizer permission flags. */
export interface OrgPermissions {
  can_spy: boolean;
  can_see_log_keys: boolean;
  can_validate_waivers: boolean;
  view_scenario: boolean;
}

export type OrgPermissionKey = keyof OrgPermissions;

/**
 * Shared response shape of every organizers endpoint.
 * `org_id` is `null` for the primary organizer (the game's author), a number
 * for secondary organizers. `deleted` marks a soft-removed secondary org.
 */
export interface GameOrganizer extends OrgPermissions {
  org_id: number | null;
  player: OrgPlayer;
  deleted: boolean;
}

/** Body of `POST /games/{id}/organizers`. */
export interface NewOrg {
  player_id: number;
}

/** Body of `DELETE /games/{id}/organizers`. */
export interface DeleteOrg {
  org_id: number;
}

/** Body of `PUT /games/{id}/organizers/{org_id}`. */
export interface OrgPermissionUpdate {
  permission: OrgPermissionKey;
  value: boolean;
}

export interface OrgPermissionLabel {
  key: OrgPermissionKey;
  label: string;
}

/** UI labels (ru) for each permission, in display order. */
export const ORG_PERMISSION_LABELS: OrgPermissionLabel[] = [
  {key: "can_spy", label: "Шпионить"},
  {key: "can_see_log_keys", label: "Смотреть лог ключей"},
  {key: "can_validate_waivers", label: "Принимать вейверы"},
  {key: "view_scenario", label: "Смотреть сценарий"},
];

/** The valid permission keys — used for client-side validation of the PUT. */
export const ORG_PERMISSION_KEYS: OrgPermissionKey[] =
  ORG_PERMISSION_LABELS.map(p => p.key);
