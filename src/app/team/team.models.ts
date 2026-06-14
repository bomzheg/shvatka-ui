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
}

export interface TeamDetails {
  id: number;
  name: string;
  description: string | null;
  captain: PlayerRef | null;
}

export interface PlayerSearchResult {
  id: number;
  can_be_author: boolean;
  name_mention: string;
}
