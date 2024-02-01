import {Routes} from '@angular/router';
import {GamesComponent} from "./games/games.component";
import {HomeComponent} from "./home/home.component";


export const routes: Routes = [
  {path: "", component: HomeComponent},
  {path: "games", component: GamesComponent},
];
