import {Routes} from '@angular/router';
import {GamesComponent} from "./games/games.component";
import {HomeComponent} from "./home/home.component";
import {GameComponent} from "./game/game.component";
import {GamePlayComponent} from "./game_play/game_play.component";
import {ProfileComponent} from "./profile/profile.component";


export const routes: Routes = [
  {path: "", component: HomeComponent},
  {path: "games", component: GamesComponent},
  {path: "games/running", component: GamePlayComponent},
  {path: "games/:id", component: GameComponent},
  {path: "profile", component: ProfileComponent},
];
