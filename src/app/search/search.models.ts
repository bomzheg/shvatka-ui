/**
 * Typed results of the global `GET /search` endpoint. The backend returns a
 * single flat list; every item carries a `type` discriminator the UI switches
 * on to pick a row renderer and a navigation target.
 */

export interface GameSearchResult {
  type: "game";
  game_id: number;
  game_name: string;
  game_number: number | null;
  snippet: string;
}

/** Which part of the level matched the query. */
export type LevelFoundIn = "name_id" | "hint" | "key";

export interface LevelSearchResult {
  type: "level";
  level_id: number;
  level_name_id: string;
  level_number: number | null;
  game_id: number;
  game_name: string;
  game_number: number | null;
  found_in: LevelFoundIn;
  /** 0-based index of the time-hint; null for bonus hints and non-hint matches. */
  hint_number: number | null;
  hint_time: number | null;
  hint_part_number: number | null;
  /** For bonus hints: the key(s) unlocking the hint (empty when not key-driven). */
  condition_key: string[];
  /** For bonus hints: the timer minute unlocking the hint. */
  condition_timer: number | null;
  /** For found_in="key": the matched answer key. */
  key: string | null;
  snippet: string;
}

export interface TeamSearchResult {
  type: "team";
  team_id: number;
  team_name: string;
  snippet: string;
}

/** Which of the player's names matched the query. */
export type PlayerFoundIn = "username" | "tg_username" | "tg_name" | "forum_name";

export interface PlayerSearchResult {
  type: "player";
  player_id: number;
  player_name: string;
  found_in: PlayerFoundIn;
  snippet: string;
}

export type SearchResult =
  | GameSearchResult
  | LevelSearchResult
  | TeamSearchResult
  | PlayerSearchResult;

/** The four "search in" filters of `GET /search`; all true = search everywhere. */
export interface SearchScope {
  games: boolean;
  levels: boolean;
  teams: boolean;
  players: boolean;
}

export const DEFAULT_SEARCH_SCOPE: SearchScope = {
  games: true,
  levels: true,
  teams: true,
  players: true,
};
