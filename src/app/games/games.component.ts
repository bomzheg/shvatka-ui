import {Component, OnInit} from '@angular/core';
import {Game, GamesService} from "./games.service";
import {ActivatedRoute, Params, Router, RouterLink, RouterLinkActive} from "@angular/router";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";


@Component({
  selector: 'app-games',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './games.component.html',
  styleUrl: './games.component.scss'
})
export class GamesComponent implements OnInit {
  constructor(
    private gamesService: GamesService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private snackbar: SnackbarService,
    ) {
  }

  getGames(): Game[] {
    return this.gamesService.games!;
  }

  ngOnInit(): void {
      this.activatedRoute.queryParams
        .subscribe((params: Params) => {
          const tgParams = params["tgWebAppStartParam"] as string;
          const gameId = Number(tgParams)
          if (!isNaN(gameId)) {
            this.router.navigate(['/games/' + gameId]);
          }
        });
        this.gamesService.loadGamesList();
    }

  canOpenGame(): boolean {
    return this.userService.isUserLoaded();
  }

  onGameClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.snackbar.info("Для просмотра деталей игры нужно авторизоваться");
  }
}
