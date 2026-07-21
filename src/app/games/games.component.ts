import {Component, OnInit} from '@angular/core';
import {DatePipe} from "@angular/common";
import {Game, GamesService} from "./games.service";
import {ActivatedRoute, Params, Router, RouterLink, RouterLinkActive} from "@angular/router";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";


export interface GameYearGroup {
  /** Year the games started in, or null when the start date is unknown. */
  year: number | null;
  games: Game[];
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    DatePipe,
  ],
  templateUrl: './games.component.html',
  styleUrl: './games.component.scss'
})
export class GamesComponent implements OnInit {
  private groupedCache: GameYearGroup[] = [];
  private groupedSource: Game[] | undefined;

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

  /** Games grouped by the year they started, newest year first. */
  getGamesByYear(): GameYearGroup[] {
    const games = this.gamesService.games;
    if (!games) {
      return [];
    }
    if (this.groupedSource === games) {
      return this.groupedCache;
    }
    this.groupedSource = games;
    this.groupedCache = this.groupGamesByYear(games);
    return this.groupedCache;
  }

  private groupGamesByYear(games: Game[]): GameYearGroup[] {
    const byYear = new Map<number | null, Game[]>();
    for (const game of games) {
      const year = this.yearOf(game.start_at);
      const bucket = byYear.get(year);
      if (bucket) {
        bucket.push(game);
      } else {
        byYear.set(year, [game]);
      }
    }

    const groups: GameYearGroup[] = [];
    for (const [year, groupGames] of byYear) {
      groupGames.sort((a, b) => this.compareByStartDesc(a, b));
      groups.push({year, games: groupGames});
    }

    groups.sort((a, b) => {
      if (a.year === b.year) {
        return 0;
      }
      // Games with an unknown year go to the very bottom of the list.
      if (a.year === null) {
        return 1;
      }
      if (b.year === null) {
        return -1;
      }
      return b.year - a.year;
    });

    return groups;
  }

  private yearOf(startAt: string | null): number | null {
    if (!startAt) {
      return null;
    }
    const time = Date.parse(startAt);
    if (isNaN(time)) {
      return null;
    }
    return new Date(time).getFullYear();
  }

  private compareByStartDesc(a: Game, b: Game): number {
    const aTime = a.start_at ? Date.parse(a.start_at) : NaN;
    const bTime = b.start_at ? Date.parse(b.start_at) : NaN;
    const aValid = !isNaN(aTime);
    const bValid = !isNaN(bTime);
    if (aValid && bValid && aTime !== bTime) {
      return bTime - aTime;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }
    return b.number - a.number;
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
