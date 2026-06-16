import {Component, Input} from '@angular/core';
import {Effects, FullGame, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {EffectsPartComponent} from "../effects.part/effects.part.component";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

@Component({
  selector: 'app-game-scenario-compact-part',
  standalone: true,
  imports: [
    EffectsPartComponent,
    MatIcon,
  ],
  templateUrl: './game_scenario_compact.part.component.html',
  styleUrl: './game_scenario_compact.part.component.scss'
})
export class GameScenarioCompactPartComponent {
  protected readonly AppIcon = AppIcon;

  @Input({required: true}) game!: FullGame;

  private openedEffects = new Set<string>();

  getScenarioConditions(level: Level): ScenarioCondition[] {
    return level.scenario.conditions ?? [];
  }

  getWinKeys(level: Level): string[] {
    const condition = this.getScenarioConditions(level)
      .find(c => c.type === ScenarioConditionType.winKey);
    return this.getConditionKeys(condition);
  }

  getEffectsKeyConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level).filter(c => c.type === ScenarioConditionType.effectsKey);
  }

  getEffectsTimerConditions(level: Level): ScenarioCondition[] {
    return this.getScenarioConditions(level).filter(c => c.type === ScenarioConditionType.effectsTimer);
  }

  getConditionKeys(condition: ScenarioCondition | undefined): string[] {
    return Array.isArray(condition?.keys) ? condition!.keys! : [];
  }

  getTimerActionTime(condition: ScenarioCondition): number | undefined {
    return typeof condition.action_time === 'number' ? condition.action_time : undefined;
  }

  hasVisibleEffects(condition: ScenarioCondition): boolean {
    return Effects.normalize(condition.effects).some(effect => Effects.hasVisiblePayload(effect));
  }

  conditionId(level: Level, kind: string, index: number): string {
    return `${level.db_id}:${kind}:${index}`;
  }

  isOpened(id: string): boolean {
    return this.openedEffects.has(id);
  }

  toggleEffects(id: string): void {
    if (this.openedEffects.has(id)) {
      this.openedEffects.delete(id);
      return;
    }
    this.openedEffects.add(id);
  }
}
