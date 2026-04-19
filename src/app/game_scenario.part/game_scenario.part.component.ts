import {Component, Input} from '@angular/core';
import {FullGame, HintPart, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {EffectsPartComponent} from "../effects.part/effects.part.component";
import {HttpAdapter} from "../http/http.adapter";

@Component({
  selector: 'app-game-scenario-part',
  standalone: true,
  imports: [
    HintPartComponent,
    EffectsPartComponent,
  ],
  templateUrl: './game_scenario.part.component.html',
  styleUrl: './game_scenario.part.component.scss'
})
export class GameScenarioPartComponent {
  protected readonly ScenarioConditionType = ScenarioConditionType;

  @Input({required: true}) game!: FullGame;

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

  getEffectsTimerConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level).filter(condition => condition.type === ScenarioConditionType.effectsTimer);
  }

  getConditionKeys(condition: ScenarioCondition): string[] {
    return Array.isArray(condition.keys) ? condition.keys : [];
  }

  getConditionEffectsSummary(condition: ScenarioCondition): string[] {
    const effects = Array.isArray(condition.effects)
      ? condition.effects
      : (condition.effects ? [condition.effects] : []);

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
          tags.push('переход на следующий уровень');
        }
      }

      return tags;
    });
  }

  getTimerActionTime(condition: ScenarioCondition): number | undefined {
    if (condition.type !== ScenarioConditionType.effectsTimer) {
      return undefined;
    }

    return typeof condition.action_time === 'number' ? condition.action_time : undefined;
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }

    return this.http.getFileUrl(this.game.id, hint.file_guid);
  }
}
