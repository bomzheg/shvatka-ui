import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap} from "@angular/router";
import {Subscription} from "rxjs";
import {GameService} from "../game/game.service";
import {FullGame, GameStat, Level} from "../domain/game.models";
import {GameChartPartComponent} from "../game_chart.part/game_chart.part.component";
import {BreadcrumbsComponent, Breadcrumb} from "../ui/breadcrumbs/breadcrumbs.component";

/**
 * Standalone, full-page view of a game's results chart — the "view" page reached
 * from the chart's expand button (à la Grafana). It reuses {@link GameService}
 * (so an already-loaded game is served from cache) and renders the same
 * {@link GameChartPartComponent}, but given the whole page width to breathe.
 */
@Component({
  selector: 'app-game-chart-page',
  standalone: true,
  imports: [GameChartPartComponent, BreadcrumbsComponent],
  templateUrl: './game-chart-page.component.html',
  styleUrl: './game-chart-page.component.scss',
})
export class GameChartPageComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;
  private gameId: number | undefined;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params: ParamMap) => {
      const gameId = Number(params.get('id'));
      if (Number.isNaN(gameId)) {
        return;
      }
      this.gameId = gameId;
      this.gameService.loadGame(gameId);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  getGame(): FullGame | undefined {
    return this.gameService.getGame();
  }

  getStat(): GameStat | undefined {
    return this.gameService.getStat();
  }

  getLevels(): Level[] {
    return this.getGame()?.levels ?? [];
  }

  isLoading(): boolean {
    return this.gameService.isLoading();
  }

  hasLoadedData(): boolean {
    return this.gameService.hasLoadedCurrentGameData();
  }

  getBreadcrumbs(): Breadcrumb[] {
    const game = this.getGame();
    return [
      {label: 'Игры', link: ['/games']},
      {label: game?.name ?? 'Игра', link: this.gameId !== undefined ? ['/games', this.gameId] : undefined},
      {label: 'График'},
    ];
  }
}
