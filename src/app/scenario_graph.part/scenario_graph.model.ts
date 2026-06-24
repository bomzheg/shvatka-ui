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
  /** Trigger description (key text or timer minutes). */
  label: string;
}

export interface GraphLevel {
  /** Stable key for navigation (the level's name_id / editor id). */
  id: string;
  /** Displayed name_id, e.g. "g3t1". */
  name: string;
  /** 1-based level number shown in the box. */
  number: number;
  /** Win-key trigger label for the default progression to the next level. */
  winLabel?: string;
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
  const posByName = new Map<string, number>();
  ordered.forEach((entry, pos) => {
    indexToPos.set(entry.index, pos);
    if (!posByName.has(entry.level.name_id)) {
      posByName.set(entry.level.name_id, pos);
    }
  });
  const maxIndex = ordered.length > 0 ? ordered[ordered.length - 1].index : -1;
  const finishPos = ordered.length;

  // A winning effect's `next_level` may be a level's name_id (the usual case
  // from the server), a numeric level index, or absent (meaning "the next
  // level"). Resolve all three to a node position, or undefined to skip.
  const resolveTarget = (nextLevel: number | string | null | undefined, pos: number): number | undefined => {
    if (nextLevel === undefined || nextLevel === null) {
      return pos + 1;
    }
    if (typeof nextLevel === 'string') {
      return posByName.has(nextLevel) ? posByName.get(nextLevel)! : undefined;
    }
    if (indexToPos.has(nextLevel)) {
      return indexToPos.get(nextLevel)!;
    }
    return nextLevel > maxIndex ? finishPos : undefined;
  };

  return ordered.map((entry, pos) => {
    const routes: GraphRoute[] = [];
    const winKeys: string[] = [];

    for (const condition of (entry.level.scenario?.conditions ?? [])) {
      if (condition.type === ScenarioConditionType.winKey) {
        winKeys.push(...(Array.isArray(condition.keys) ? condition.keys : []));
        continue;
      }
      const isTimer = condition.type === ScenarioConditionType.effectsTimer;
      for (const effect of Effects.normalize(condition.effects)) {
        if (effect.level_up !== true) {
          continue;
        }

        const target = resolveTarget(effect.next_level, pos);
        if (target === undefined) {
          continue;
        }

        routes.push({
          target,
          kind: isTimer ? 'timer' : 'key',
          label: isTimer ? timerRouteLabel(condition.action_time) : keyRouteLabel(condition.keys),
        });
      }
    }

    return {
      id: entry.level.name_id,
      name: entry.level.name_id,
      number: entry.index + 1,
      winLabel: winKeys.length > 0 ? keyRouteLabel(winKeys) : undefined,
      routes,
    };
  });
}
