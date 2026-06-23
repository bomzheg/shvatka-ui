import {Component, OnInit} from '@angular/core';
import {Game, GamesService, GameWaivers, VotedPlayer, WaiversGameTeam} from "./games.service";
import {ActivatedRoute, Params, Router, RouterLink, RouterLinkActive} from "@angular/router";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";

interface WaiversState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  data?: GameWaivers;
}

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
  private waiversState = new Map<number, WaiversState>();

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

  onWaiversToggle(game: Game, event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.loadWaivers(game.id);
    }
  }

  private loadWaivers(gameId: number): void {
    const existing = this.waiversState.get(gameId);
    if (existing && (existing.loading || existing.loaded)) {
      return;
    }

    this.waiversState.set(gameId, {loading: true, loaded: false, error: false});
    this.gamesService.getGameWaivers(gameId).subscribe({
      next: data => this.waiversState.set(gameId, {loading: false, loaded: true, error: false, data}),
      error: () => this.waiversState.set(gameId, {loading: false, loaded: true, error: true}),
    });
  }

  isWaiversLoading(gameId: number): boolean {
    return this.waiversState.get(gameId)?.loading ?? false;
  }

  hasWaiversError(gameId: number): boolean {
    return this.waiversState.get(gameId)?.error ?? false;
  }

  getWaiverTeams(gameId: number): WaiversGameTeam[] {
    return this.waiversState.get(gameId)?.data?.teams ?? [];
  }

  getTeamVotedPlayers(gameId: number, teamId: number): VotedPlayer[] {
    return this.waiversState.get(gameId)?.data?.waivers?.[String(teamId)] ?? [];
  }

  getPlayedLabel(played: string | null | undefined): string {
    switch (played) {
      case "yes":
        return "Играет";
      case "no":
        return "Отказался";
      case "think":
        return "Ещё не решил";
      case "revoked":
        return "Не допущен капитаном";
      case "not_allowed":
        return "Не допущен организаторами";
      default:
        return "";
    }
  }
}
