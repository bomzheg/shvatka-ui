import {Component, Input} from '@angular/core';
import {Effect, EffectLike, Effects, FullGame, Level, ScenarioCondition, ScenarioConditionType} from "../domain/game.models";
import {EffectsPartComponent} from "../effects.part/effects.part.component";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

/** A timer-like line in the compact view: either an effects timer or a time hint. */
export interface TimerEntry {
  time: number;
  effects: Effect[] | Effect | EffectLike | undefined;
  kind: 'timer' | 'hint';
}

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

  /**
   * Effects timers and time hints merged into one list sorted by time. Time
   * hints are treated as timers carrying only hints; a timer and a time hint
   * sharing the same time stay as two separate entries.
   */
  getTimerEntries(level: Level): TimerEntry[] {
    const entries: TimerEntry[] = [];

    for (const condition of this.getEffectsTimerConditions(level)) {
      const time = this.getTimerActionTime(condition);
      if (time === undefined) {
        continue;
      }
      entries.push({time, effects: condition.effects, kind: 'timer'});
    }

    for (const timeHint of (level.scenario.time_hints ?? [])) {
      const hints = Array.isArray(timeHint.hint) ? timeHint.hint : [];
      if (hints.length === 0) {
        continue;
      }
      entries.push({time: timeHint.time, effects: {hints_: hints}, kind: 'hint'});
    }

    return entries.sort((a, b) => a.time - b.time);
  }

  hasVisibleEntryEffects(entry: TimerEntry): boolean {
    return Effects.normalize(entry.effects).some(effect => Effects.hasVisiblePayload(effect));
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
