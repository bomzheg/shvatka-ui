import {Component, Input} from '@angular/core';
import {EffectLike, Effects, FullGame, HintPart, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {EffectsPartComponent} from "../effects.part/effects.part.component";
import {HttpAdapter} from "../http/http.adapter";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

@Component({
  selector: 'app-game-scenario-part',
  standalone: true,
  imports: [
    HintPartComponent,
    EffectsPartComponent,
    MatIcon,
  ],
  templateUrl: './game_scenario.part.component.html',
  styleUrl: './game_scenario.part.component.scss'
})
export class GameScenarioPartComponent {
  protected readonly ScenarioConditionType = ScenarioConditionType;
  protected readonly AppIcon = AppIcon;
  showEffectConditions = true;

  @Input({required: true}) game!: FullGame;
  /** Blob URLs by file guid, winning over the CDN copy. The constructor's
   *  preview passes the files it has just uploaded, whose CDN copy may not be
   *  readable yet. */
  @Input() localUrls?: Map<string, string>;

  constructor(private http: HttpAdapter) {
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

  getWinTimerConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level)
      .filter(condition => condition.type === ScenarioConditionType.effectsTimer && this.conditionHasLevelUp(condition));
  }

  getEffectsTimerConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level)
      .filter(condition => condition.type === ScenarioConditionType.effectsTimer && !this.conditionHasLevelUp(condition));
  }

  hiddenEffectConditionsCount(level: Level): number {
    return this.getEffectsKeyConditions(level).length + this.getEffectsTimerConditions(level).length;
  }

  toggleEffectConditions(): void {
    this.showEffectConditions = !this.showEffectConditions;
  }

  getConditionKeys(condition: ScenarioCondition): string[] {
    return Array.isArray(condition.keys) ? condition.keys : [];
  }

  getTimerActionTime(condition: ScenarioCondition): number | undefined {
    if (condition.type !== ScenarioConditionType.effectsTimer) {
      return undefined;
    }

    return typeof condition.action_time === 'number' ? condition.action_time : undefined;
  }

  private conditionHasLevelUp(condition: ScenarioCondition): boolean {
    return Effects.normalize(condition.effects as EffectLike[] | EffectLike | undefined)
      .some(effect => effect.level_up === true);
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }

    return this.localUrls?.get(hint.file_guid) ?? this.http.getFileUrl(this.game.id, hint.file_guid);
  }

  getThumbUrl(hint: HintPart) {
    if (!hint.thumb_guid) {
      return undefined;
    }

    return this.localUrls?.get(hint.thumb_guid) ?? this.http.getFileUrl(this.game.id, hint.thumb_guid);
  }
}
