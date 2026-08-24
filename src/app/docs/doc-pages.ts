/**
 * A page of the user documentation, named the way the engine names it.
 *
 * The value is a `DocPage` member name from
 * `shvatka/core/utils/doc_pages.py` — the name, never the path: the engine
 * turns it into a url (`GET /docs/pages`), so a page renamed or moved in the
 * docs changes nothing here. A name the engine does not know renders no link.
 */
export type DocPage =
  | "AUTH"
  | "JOIN_TEAM"
  | "LEAVE_TEAM"
  | "PLAY"
  | "PLAY_KEYS"
  | "PROMOTION"
  | "CREATE_CHAT"
  | "GROUP_TO_SUPERGROUP"
  | "CHECK_CHAT"
  | "CREATE_TEAM"
  | "ADD_PLAYERS"
  | "MANAGE_TEAM"
  | "TEAM_PERMISSIONS"
  | "CHANGE_CAPTAIN"
  | "WAIVERS"
  | "MOVE_CHAT"
  | "LEVEL_CONCEPT"
  | "GAME_CREATE"
  | "LEVEL_CREATE"
  | "GAME_LEVELS"
  | "GAME_SCHEDULE"
  | "GAME_ORGS"
  | "SPY";

/** A page as the engine hands it over: where it is and what it is called. */
export interface DocPageLink {
  url: string;
  title: string;
}
