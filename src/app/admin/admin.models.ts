import {PlayedGame, PlayerTg, TeamDetails} from '../team/team.models';

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

/** One entry of the manual timeline for `POST /admin/players/merge`. */
export interface MergeTimelineItem {
  team_id: number;
  date_joined: string;
  date_left: string | null;
}

/** `GET /admin/waivers/game/{id}` — waiver entries are keyed by team id. */
export interface GameWaivers {
  teams: TeamDetails[];
  waivers: Record<string, WaiverEntry[]>;
}
