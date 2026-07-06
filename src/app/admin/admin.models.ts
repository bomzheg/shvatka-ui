import {PlayerTg, TeamDetails} from '../team/team.models';

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

/** `GET /admin/waivers/game/{id}` — waiver entries are keyed by team id. */
export interface GameWaivers {
  teams: TeamDetails[];
  waivers: Record<string, WaiverEntry[]>;
}
