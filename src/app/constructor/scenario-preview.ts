import {
  Effect,
  FullGame,
  HintPart,
  Level,
  Scenario,
  ScenarioCondition,
  TimeHint,
} from "../domain/game.models";
import {
  ConditionPayload,
  EffectsPayload,
  HintPayload,
  LevelPayload,
  ScenarioPayload,
} from "./constructor.models";

/**
 * The scenario the editor is about to save, as the domain objects the
 * read-only views render.
 *
 * It is built from the save payload itself rather than from the editor's own
 * state, so what the author previews is exactly what will be stored — the same
 * cleaned hints, the same conditions, in the same order.
 *
 * The identifiers a saved game gets from the server are stand-ins here: a
 * level's `db_id` is its position (the read-only view only tracks by it) and
 * levels are numbered in the order the editor lists them. Everything outside
 * the scenario — the id the files are read from, the author, the status —
 * comes from the loaded game.
 */
export function toPreviewGame(scenario: ScenarioPayload, game: FullGame): FullGame {
  return new FullGame(
    game.id,
    game.author,
    scenario.name,
    game.status,
    game.start_at,
    scenario.levels.map((level, index) => toPreviewLevel(level, index, game)),
  );
}

function toPreviewLevel(level: LevelPayload, index: number, game: FullGame): Level {
  const scenario = new Scenario(
    level.id,
    (level.time_hints ?? []).map(th => new TimeHint(th.time, (th.hint ?? []).map(toHintPart))),
    (level.conditions ?? []).map(toCondition),
  );
  return new Level(index, level.id, game.author, scenario, game.id, index);
}

function toCondition(condition: ConditionPayload): ScenarioCondition {
  return new ScenarioCondition(
    condition.type,
    condition.keys,
    condition.effects ? toEffect(condition.effects) : undefined,
    condition.action_time,
  );
}

function toEffect(effects: EffectsPayload): Effect {
  return new Effect(
    effects.id,
    (effects.hints ?? []).map(toHintPart),
    effects.bonus_minutes,
    effects.level_up,
    effects.next_level,
  );
}

function toHintPart(hint: HintPayload): HintPart {
  return HintPart.create(hint);
}
