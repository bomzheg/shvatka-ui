import {Component, Input} from '@angular/core';
import {FullGame, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {EffectsPartComponent} from "../effects.part/effects.part.component";

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

  constructor() {
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

  getTimerActionTime(condition: ScenarioCondition): number | undefined {
    if (condition.type !== ScenarioConditionType.effectsTimer) {
      return undefined;
    }

    return typeof condition.action_time === 'number' ? condition.action_time : undefined;
  }
}
