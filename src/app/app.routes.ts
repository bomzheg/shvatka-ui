import {Routes} from '@angular/router';
import {GamesComponent} from "./games/games.component";
import {HomeComponent} from "./home/home.component";
import {GameComponent} from "./game/game.component";
import {AuthCallbackComponent} from "./auth-callback/auth-callback.component";


export const routes: Routes = [
  {path: "", component: HomeComponent},
  {path: "games", component: GamesComponent},
  {path: "games/:id", component: GameComponent},
  {path: "auth/callback", component: AuthCallbackComponent},
];
