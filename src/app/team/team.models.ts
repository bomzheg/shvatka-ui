export interface PlayerTg {
  tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface PlayerRef {
  id: number;
  can_be_author: boolean;
  name_mention: string;
}

export interface TeamRef {
  id: number;
  name: string;
  description: string | null;
  captain: PlayerRef;
}

export interface PlayerInTeam {
  id: number;
  team: TeamRef;
  date_joined: string;
  role: string;
  emoji: string | null;
}

export interface PlayerProfile {
  id: number;
  username: string | null;
  can_be_author: boolean;
  tg: PlayerTg | null;
  player_in_team: PlayerInTeam | null;
}

export interface TeamMemberPermissions {
  can_manage_waivers: boolean;
  can_manage_players: boolean;
  can_change_team_name: boolean;
  can_add_players: boolean;
  can_remove_players: boolean;
}

export interface TeamMember {
  team_player_id: number;
  id: number;
  username: string | null;
  can_be_author: boolean;
  emoji: string | null;
  role: string;
  permissions: TeamMemberPermissions;
  date_joined: string;
  played_games_count: number;
}

export interface TeamDetails {
  id: number;
  name: string;
  description: string | null;
  captain: PlayerRef | null;
  played_games_count?: number;
}

/**
 * A team the player is the captain of (`GET /teams/my/captained`).
 *
 * The captaincy outlives the membership: a captain who moved to another team as
 * a field player still leads the old one, and `is_current` is what tells the two
 * apart.
 */
export interface CaptainedTeam extends TeamDetails {
  is_current: boolean;
}

export interface PlayerSearchResult {
  id: number;
  can_be_author: boolean;
  name_mention: string;
}

export interface Items<T> {
  items: T[];
}

/** A published game a team or player took part in (see `GET /teams/{id}/stat`, played_games). */
export interface PlayedGame {
  id: number;
  author: PlayerRef;
  name: string;
  status: string;
  start_at: string | null;
  number: number | null;
}

/** One membership entry from a player's team history (`GET /users/{id}/stat`). */
export interface TeamPlayerHistory {
  team_player_id: number;
  team: TeamDetails | null;
  date_joined: string;
  date_left: string | null;
  role: string;
  emoji: string | null;
}

/** Aggregated player statistics (`GET /users/{id}/stat`). */
export interface PlayerStat {
  id: number;
  username: string | null;
  can_be_author: boolean;
  typed_keys_count: number;
  typed_correct_keys_count: number;
  team_history: TeamPlayerHistory[];
  played_games: PlayedGame[];
}
