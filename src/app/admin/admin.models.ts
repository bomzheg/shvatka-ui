import {PlayedGame, PlayerTg, TeamDetails, TeamMemberPermissions} from '../team/team.models';

/** Compact player as returned inside admin poll/waiver structures. */
export interface AdminPlayerRef {
  id: number;
  can_be_author: boolean;
  name_mention: string;
  username?: string | null;
}

export interface AdminForumIdentity {
  name: string | null;
}

export interface AdminEmail {
  email: string;
  is_verified: boolean;
}

/** Row of `GET /admin/players` (no email/is_admin — see the detail endpoint). */
export interface AdminPlayerListItem {
  id: number;
  can_be_author: boolean;
  name_mention: string;
  username: string | null;
  tg: PlayerTg | null;
  forum: AdminForumIdentity | null;
}

/** `GET /admin/players/{id}` — player with all linked identities. */
export interface AdminPlayerDetails extends AdminPlayerListItem {
  email: AdminEmail | null;
  is_admin: boolean;
}

export interface AdminPlayersFilters {
  username?: string;
  name?: string;
  active?: boolean;
  archive?: boolean;
  can_be_author?: boolean;
}

export interface OneTimeLink {
  url: string;
}

export type PollVote = 'yes' | 'no' | 'think' | 'revoked' | 'not_allowed';

export interface PollEntry {
  player: AdminPlayerRef;
  vote: PollVote;
}

export interface PollTeam {
  team: TeamDetails;
  entries: PollEntry[];
}

export interface AdminPoll {
  teams: PollTeam[];
}

export interface WaiverEntry {
  player: AdminPlayerRef;
}

/**
 * `GET /admin/players/{id}/waiver-points` — interval around a played game
 * (start − 12h … start + 48h) in which the player's team membership is fixed
 * by a waiver and a manual merge timeline must keep them in `team`.
 */
export interface WaiverPoint {
  game: PlayedGame;
  team: TeamDetails;
  at_since: string;
  at_until: string;
}

/**
 * One entry of the manual timeline for `POST /admin/players/merge`.
 * Datetimes must carry an explicit timezone offset. The backend does not
 * inherit role/emoji/permissions from the old history — omitted fields fall
 * back to the defaults («полевой», no emoji, no permissions).
 */
export interface MergeTimelineItem {
  team_id: number;
  date_joined: string;
  date_left: string | null;
  role?: string;
  emoji?: string;
  permissions?: TeamMemberPermissions;
}

/** `GET /admin/waivers/game/{id}` — waiver entries are keyed by team id. */
export interface GameWaivers {
  teams: TeamDetails[];
  waivers: Record<string, WaiverEntry[]>;
}

/** One `game_files` row the garbage collector considers unused. */
export interface UnusedGameFile {
  game_id: number;
  file_id: number;
}

/**
 * `POST /admin/files/gc` — what the sweep removed, or would have when
 * `dry_run` is true. The three lists follow the three layers a file lives in:
 * the link that makes it usable in a game, the meta row that describes it, and
 * the content on the storage.
 */
export interface FileGarbage {
  dry_run: boolean;
  game_links: UnusedGameFile[];
  file_guids: string[];
  stored_files: string[];
}

/**
 * Row of `GET /admin/games` — a game's identity and its status, nothing of
 * what it is made of. An admin sees only games that stopped being drafts
 * (collecting waivers, running, finished, complete) and may change the status
 * of one; its scenario, keys and files are not an admin's to read until the
 * game is complete and public anyway.
 */
export interface AdminGame {
  id: number;
  author: AdminPlayerRef;
  name: string;
  status: string;
  start_at: string | null;
  number: number | null;
}
