import {AfterViewChecked, Component, OnDestroy, OnInit} from '@angular/core';
import {DatePipe} from "@angular/common";
import {GameService} from "./game.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {FullGame, GameStat, GameWaivers, HintPart, Keys, Level, Team, VotedPlayer} from "../domain/game.models";
import {ActivatedRoute, ParamMap, RouterLink} from "@angular/router";
import {HttpErrorResponse} from "@angular/common/http";
import {Subscription} from "rxjs";
import {GameLogPartComponent} from "../game_log.part/game_log.part.component";
import {GameScenarioPartComponent} from "../game_scenario.part/game_scenario.part.component";
import {GameScenarioCompactPartComponent} from "../game_scenario_compact.part/game_scenario_compact.part.component";
import {ScenarioGraphPartComponent} from "../scenario_graph.part/scenario_graph.part.component";
import {GraphLevel, routingGraphFromGame} from "../scenario_graph.part/scenario_graph.model";
import {levelAnchorId, scrollToLevel} from "../scenario_graph.part/scenario_graph.nav";
import {BreadcrumbsComponent, Breadcrumb} from "../ui/breadcrumbs/breadcrumbs.component";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HttpAdapter} from "../http/http.adapter";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    GameLogPartComponent,
    GameScenarioPartComponent,
    GameScenarioCompactPartComponent,
    RouterLink,
    ScenarioGraphPartComponent,
    BreadcrumbsComponent,
    DatePipe,
    HintPartComponent,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy, AfterViewChecked {
  private routeSubscription: Subscription | undefined;
  private queryParamsSubscription: Subscription | undefined;
  // Level name_id from the `level` query param (e.g. a search result link):
  // once the full scenario renders its card, we scroll to and highlight it.
  private pendingLevelAnchor: string | undefined;
  scenarioTab: 'compact' | 'full' | 'graph' = 'compact';
  gameId: number | undefined;
  exporting = false;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    private snackbar: SnackbarService,
    private http: HttpAdapter,
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

    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params: ParamMap) => {
      const level = params.get('level');
      if (level) {
        this.pendingLevelAnchor = level;
        this.scenarioTab = 'full';
      }
    });
  }

  ngAfterViewChecked(): void {
    if (!this.pendingLevelAnchor) {
      return;
    }

    const anchor = this.pendingLevelAnchor;
    if (document.getElementById(levelAnchorId(anchor))) {
      this.pendingLevelAnchor = undefined;
      scrollToLevel(anchor);
    }
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
  }

  getGame(): FullGame | undefined {
    return this.gameService.getGame();
  }

  hasRelease(): boolean {
    return this.releaseParts().length > 0;
  }

  /** The release as it was written — the banner leads. */
  releaseParts(): HintPart[] {
    const release = this.gameService.getRelease();
    if (!release) {
      return [];
    }

    return release.banner ? [release.banner, ...release.hints] : release.hints;
  }

  releaseFileUrl(part: HintPart): string | undefined {
    return this.releaseUrlFor(part.file_guid);
  }

  releaseThumbUrl(part: HintPart): string | undefined {
    return this.releaseUrlFor(part.thumb_guid);
  }

  private releaseUrlFor(guid: string | undefined): string | undefined {
    return guid && this.gameId ? this.http.getFileUrl(this.gameId, guid) : undefined;
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [
      {label: 'Игры', link: ['/games']},
      {label: this.getGame()?.name ?? 'Игра'},
    ];
  }

  getKeys(): Keys | undefined {
    return this.gameService.getKeys();
  }

  getStat(): GameStat | undefined {
    return this.gameService.getStat();
  }

  getLevels(): Level[] {
    return this.getGame()?.levels ?? [];
  }

  private graphCacheGame: FullGame | undefined;
  private graphCacheLevels: GraphLevel[] = [];

  getGraphLevels(): GraphLevel[] {
    const game = this.getGame();
    if (!game) {
      return [];
    }
    if (this.graphCacheGame !== game) {
      this.graphCacheGame = game;
      this.graphCacheLevels = routingGraphFromGame(game);
    }
    return this.graphCacheLevels;
  }

  onGraphLevelSelected(id: string): void {
    scrollToLevel(id);
  }

  setScenarioTab(tab: 'compact' | 'full' | 'graph'): void {
    this.scenarioTab = tab;
  }

  isLoading(): boolean {
    return this.gameService.isLoading();
  }

  hasLoadedData(): boolean {
    return this.gameService.hasLoadedCurrentGameData();
  }

  onWaiversToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
      this.gameService.loadWaivers();
    }
  }

  isWaiversLoading(): boolean {
    return this.gameService.isWaiversLoading();
  }

  hasWaiversError(): boolean {
    return this.gameService.hasWaiversError();
  }

  getWaivers(): GameWaivers | undefined {
    return this.gameService.getWaivers();
  }

  getWaiverTeams(): Team[] {
    return this.getWaivers()?.teams ?? [];
  }

  getTeamVotedPlayers(teamId: number): VotedPlayer[] {
    return this.getWaivers()?.waivers?.[String(teamId)] ?? [];
  }

  onExportStat(): void {
    const id = this.gameId;
    if (id === undefined || this.exporting) {
      return;
    }

    this.exporting = true;
    this.gameService.exportStat(id).subscribe({
      next: blob => {
        this.exporting = false;
        this.triggerDownload(blob, `${this.getGame()?.name ?? 'game'}.xlsx`);
      },
      error: error => {
        this.exporting = false;
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.snackbar.error("Экспорт результатов доступен только авторизованным пользователям", 'Закрыть', 3000);
        } else {
          this.snackbar.error("Не удалось скачать результаты игры", 'Закрыть', 3000);
        }
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

}