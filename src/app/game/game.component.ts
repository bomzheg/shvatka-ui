import {Component, OnDestroy, OnInit} from '@angular/core';
import {GameService} from "./game.service";
import {FullGame, GameStat, HintPart, Keys, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {Subscription} from "rxjs";
import {GameLogPartComponent} from "../game_log.part/game_log.part.component";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    HintPartComponent,
    GameLogPartComponent,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy {
  protected readonly ScenarioConditionType = ScenarioConditionType;
  private routeSubscription: Subscription | undefined;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    private http: HttpAdapter,
  ) {
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params: ParamMap) => {
      const gameId = Number(params.get('id'));
      if (Number.isNaN(gameId)) {
        return;
      }

      this.gameService.loadGame(gameId);
    });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
  }

  getGame(): FullGame | undefined {
    return this.gameService.getGame();
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

  getScenarioConditions(level: Level): ScenarioCondition[] {
    return level.scenario.conditions ?? [];
  }

  getWinKeyCondition(level: Level): ScenarioCondition | undefined {
    return this.getScenarioConditions(level).find(condition => condition.type === ScenarioConditionType.winKey);
  }

  getEffectsKeyConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level).filter(condition => condition.type === ScenarioConditionType.effectsKey);
  }

  getEffectsTimerConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level).filter(condition => condition.type === ScenarioConditionType.effectsTimer);
  }

  getConditionKeys(condition: ScenarioCondition): string[] {
    return Array.isArray(condition.keys) ? condition.keys : [];
  }

  getConditionEffectsSummary(condition: ScenarioCondition): string[] {
    const effects = Array.isArray(condition.effects) ? condition.effects : [];
    return effects.flatMap(effect => {
      const tags: string[] = [];
      if (effect.bonus_minutes > 0) {
        tags.push(`бонус ${effect.bonus_minutes} мин.`);
      } else if (effect.bonus_minutes < 0) {
        tags.push(`штраф ${-effect.bonus_minutes} мин.`);
      }

      if (effect.level_up) {
        if (effect.next_level) {
          tags.push(`переход на ${effect.next_level}`);
        } else {
          tags.push("переход на следующий уровень");
        }
      }

      return tags;
    });
  }

  getTimerActionTime(condition: ScenarioCondition): number | undefined {
    if (condition.type !== ScenarioConditionType.effectsTimer) {
      return undefined;
    }

    return typeof condition.action_time === "number" ? condition.action_time : undefined;
  }

  isLoading(): boolean {
    return this.gameService.isLoading();
  }

  hasLoadedData(): boolean {
    return this.gameService.hasLoadedCurrentGameData();
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined || this.getGame() === undefined) {
      return undefined;
    }

    return this.http.getFileUrl(this.getGame()!.id, hint.file_guid);
  }

}
