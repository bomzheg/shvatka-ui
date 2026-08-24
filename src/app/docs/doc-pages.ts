/**
 * The documentation pages the ui links to.
 *
 * The value is the page path inside the ROOT module of the docs, the same
 * string the engine's `DocPage` uses (`shvatka/core/utils/doc_pages.py`) — the
 * two lists describe one site, so a page renamed there is renamed here.
 */
export const DocPage = {
  auth: "player/auth",
  joinTeam: "player/join_team",
  leaveTeam: "player/leave_team",
  play: "player/play",
  promotion: "player/promotion",
  createTeam: "setup_team/create_team",
  addPlayers: "setup_team/add_players",
  manageTeam: "setup_team/manage_team",
  teamPermissions: "setup_team/permissions",
  changeCaptain: "setup_team/change_captain",
  waivers: "setup_team/waivers",
  moveChat: "setup_team/move_chat",
  gameCreate: "author/game-create",
  levelCreate: "author/level-create",
  gameOrgs: "author/game-orgs",
} as const;

export type DocPage = typeof DocPage[keyof typeof DocPage];
