import {Effects, FullGame, ScenarioConditionType} from "../domain/game.models";

/**
 * Normalized routing input shared by every placement of the graph (completed
 * game, running game, constructor). Each host maps its own scenario shape to
 * this so {@link ScenarioGraphPartComponent} stays free of model-specific logic.
 */
export interface GraphRoute {
  /**
   * Destination node position: `0..levels.length-1` for a level, or
   * `levels.length` for the terminal "Финиш" node.
   */
  target: number;
  kind: 'key' | 'timer';
  label: string;
}

export interface GraphLevel {
  title: string;
  routes: GraphRoute[];
}

const KEY_MAX = 16;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Short label for a key-triggered route: first key plus a `+N` overflow hint. */
export function keyRouteLabel(keys: string[] | undefined): string {
  const list = Array.isArray(keys) ? keys : [];
  if (list.length === 0) {
    return 'ключ';
  }
  const head = truncate(list[0], KEY_MAX);
  return list.length > 1 ? `${head} +${list.length - 1}` : head;
}

/** Short label for a timer-triggered route. */
export function timerRouteLabel(actionTime: number | undefined): string {
  return typeof actionTime === 'number' ? `${actionTime} мин` : 'таймер';
}

/**
 * Builds the routing levels from a played-game {@link FullGame}. Here a level's
 * `next_level` effect carries a numeric level index (matching
 * {@link Level.number_in_game}); `null`/absent means "the next level".
 */
export function routingGraphFromGame(game: FullGame): GraphLevel[] {
  const ordered = (game.levels ?? [])
    .map((level, position) => ({
      level,
      index: typeof level.number_in_game === 'number' ? level.number_in_game : position,
    }))
    .sort((a, b) => a.index - b.index);

  const indexToPos = new Map<number, number>();
  ordered.forEach((entry, pos) => indexToPos.set(entry.index, pos));
  const maxIndex = ordered.length > 0 ? ordered[ordered.length - 1].index : -1;
  const finishPos = ordered.length;

  return ordered.map((entry) => {
    const routes: GraphRoute[] = [];

    for (const condition of (entry.level.scenario?.conditions ?? [])) {
      const isTimer = condition.type === ScenarioConditionType.effectsTimer;
      for (const effect of Effects.normalize(condition.effects)) {
        if (effect.level_up !== true) {
          continue;
        }

        let targetIndex: number;
        if (typeof effect.next_level === 'number') {
          targetIndex = effect.next_level;
        } else if (effect.next_level === undefined || effect.next_level === null) {
          targetIndex = entry.index + 1;
        } else {
          // A non-numeric target can't be resolved against numeric level indices.
          continue;
        }

        let target: number;
        if (indexToPos.has(targetIndex)) {
          target = indexToPos.get(targetIndex)!;
        } else if (targetIndex > maxIndex) {
          target = finishPos;
        } else {
          continue;
        }

        routes.push({
          target,
          kind: isTimer ? 'timer' : 'key',
          label: isTimer ? timerRouteLabel(condition.action_time) : keyRouteLabel(condition.keys),
        });
      }
    }

    return {title: `№${entry.index + 1} (${entry.level.name_id})`, routes};
  });
}
