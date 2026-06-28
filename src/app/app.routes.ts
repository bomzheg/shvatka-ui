import {Routes} from '@angular/router';
import {GamesComponent} from "./games/games.component";
import {HomeComponent} from "./home/home.component";
import {GameComponent} from "./game/game.component";
import {GameChartPageComponent} from "./game_chart_page/game-chart-page.component";
import {GamePlayComponent} from "./game_play/game_play.component";
import {ProfileComponent} from "./profile/profile.component";
import {OneTimeTokenComponent} from "./auth/one-time-token.component";
import {ConstructorComponent} from "./constructor/constructor.component";
import {GameEditorComponent} from "./constructor/game-editor.component";
import {CaptainBridgeComponent} from "./team/captain-bridge.component";
import {TeamsComponent} from "./teams/teams.component";
import {TeamCardComponent} from "./team_card/team-card.component";
import {PlayerCardComponent} from "./player_card/player-card.component";


export const routes: Routes = [
  {path: "", component: HomeComponent},
  {path: "games", component: GamesComponent},
  {path: "games/running", component: GamePlayComponent},
  {path: "games/constructor", component: ConstructorComponent},
  {path: "games/constructor/:id", component: GameEditorComponent},
  {path: "games/:id/chart", component: GameChartPageComponent},
  {path: "games/:id", component: GameComponent},
  {path: "team", component: CaptainBridgeComponent},
  {path: "teams", component: TeamsComponent},
  {path: "teams/:id", component: TeamCardComponent},
  {path: "players/:id", component: PlayerCardComponent},
  {path: "profile", component: ProfileComponent},
  {path: "auth/one-time-token", component: OneTimeTokenComponent},
];
