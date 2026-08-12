import {toPreviewGame} from "./scenario-preview";
import {SCENARIO_MODEL_VERSION, ScenarioPayload} from "./constructor.models";
import {
  Effect,
  FullGame,
  HintType,
  Player,
  ScenarioConditionType,
} from "../domain/game.models";

function game(): FullGame {
  return new FullGame(
    7,
    new Player("Автор", 1, true),
    "сохранённое имя",
    "underconstruction",
    undefined,
    [],
  );
}

function scenario(levels: ScenarioPayload["levels"]): ScenarioPayload {
  return {name: "Игра", __model_version__: SCENARIO_MODEL_VERSION, levels, files: []};
}

describe("toPreviewGame", () => {
  it("takes the name from the payload and the rest from the loaded game", () => {
    const preview = toPreviewGame(scenario([]), game());

    expect(preview.id).toBe(7);
    expect(preview.name).toBe("Игра");
    expect(preview.status).toBe("underconstruction");
    expect(preview.levels).toEqual([]);
  });

  it("numbers levels in the order the editor lists them", () => {
    const preview = toPreviewGame(scenario([
      {id: "lvl_1", __model_version__: 1, time_hints: [], conditions: []},
      {id: "lvl_2", __model_version__: 1, time_hints: [], conditions: []},
    ]), game());

    expect(preview.levels.map(l => l.name_id)).toEqual(["lvl_1", "lvl_2"]);
    expect(preview.levels.map(l => l.number_in_game)).toEqual([0, 1]);
    expect(preview.levels.map(l => l.db_id)).toEqual([0, 1]);
    expect(preview.levels.map(l => l.game_id)).toEqual([7, 7]);
  });

  it("maps time hints into hint parts", () => {
    const preview = toPreviewGame(scenario([
      {
        id: "lvl_1",
        __model_version__: 1,
        conditions: [],
        time_hints: [
          {time: 0, hint: [{type: HintType.text, text: "загадка"}]},
          {time: 5, hint: [{type: HintType.photo, file_guid: "guid-1", has_spoiler: true}]},
        ],
      },
    ]), game());

    const timeHints = preview.levels[0].scenario.time_hints;
    expect(timeHints.map(th => th.time)).toEqual([0, 5]);
    expect(timeHints[0].hint[0].text).toBe("загадка");
    expect(timeHints[1].hint[0].file_guid).toBe("guid-1");
    expect(timeHints[1].hint[0].has_spoiler).toBeTrue();
  });

  it("keeps the conditions with their keys, timers and effects", () => {
    const preview = toPreviewGame(scenario([
      {
        id: "lvl_1",
        __model_version__: 1,
        time_hints: [],
        conditions: [
          {type: ScenarioConditionType.winKey, keys: ["SH123"]},
          {
            type: ScenarioConditionType.effectsTimer,
            action_time: 30,
            effects: {
              id: "e1",
              hints: [{type: HintType.text, text: "бонус"}],
              bonus_minutes: -5,
              level_up: true,
              next_level: "lvl_2",
            },
          },
        ],
      },
    ]), game());

    const [win, timer] = preview.levels[0].scenario.conditions;
    expect(win.type).toBe(ScenarioConditionType.winKey);
    expect(win.keys).toEqual(["SH123"]);
    expect(win.effects).toBeUndefined();

    expect(timer.action_time).toBe(30);
    const effect = timer.effects as Effect;
    expect(effect.id).toBe("e1");
    expect(effect.bonus_minutes).toBe(-5);
    expect(effect.level_up).toBeTrue();
    // A scenario routes by the target level's name_id, not by its position.
    expect(effect.next_level).toBe("lvl_2");
    expect(effect.getHints()[0].text).toBe("бонус");
    expect(effect.hasVisiblePayload()).toBeTrue();
  });
});
