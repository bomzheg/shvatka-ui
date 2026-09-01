import {
  parseScenarioYaml,
  relinkFileGuids,
  scenarioHints,
  ScenarioYamlError,
  scenarioToYaml,
  yamlFileName,
} from "./scenario-yaml";
import {FilePayload, SCENARIO_MODEL_VERSION, ScenarioPayload} from "./constructor.models";
import {HintType, ScenarioConditionType} from "../domain/game.models";

function scenario(): ScenarioPayload {
  return {
    name: "Ночная игра",
    __model_version__: SCENARIO_MODEL_VERSION,
    levels: [
      {
        id: "lvl_1",
        __model_version__: SCENARIO_MODEL_VERSION,
        time_hints: [
          {time: 0, hint: [{type: HintType.text, text: "загадка"}]},
          {
            time: 10,
            hint: [{type: HintType.photo, file_guid: "guid-1", caption: "вид", has_spoiler: true}],
          },
        ],
        conditions: [
          {type: ScenarioConditionType.winKey, keys: ["SHONE"]},
          {
            type: ScenarioConditionType.effectsTimer,
            action_time: 40,
            effects: {
              id: "e1",
              hints: [{type: HintType.text, text: "время вышло"}],
              bonus_minutes: -5,
              level_up: true,
              next_level: "lvl_2",
            },
          },
        ],
      },
      {
        id: "lvl_2",
        __model_version__: SCENARIO_MODEL_VERSION,
        time_hints: [{time: 0, hint: [{type: HintType.gps, latitude: 55.75, longitude: 37.61}]}],
        conditions: [{type: ScenarioConditionType.winKey, keys: ["SHTWO"]}],
      },
    ],
    files: [
      {guid: "guid-1", original_filename: "вид", extension: ".jpg", content_type: "photo"},
    ],
  };
}

describe("scenarioToYaml", () => {
  it("writes a document that reads back as the same scenario", async () => {
    const yaml = await scenarioToYaml(scenario());

    expect(await parseScenarioYaml(yaml)).toEqual(scenario());
  });

  it("explains in the header that files stay behind", async () => {
    const yaml = await scenarioToYaml(scenario());

    expect(yaml.startsWith("# Сценарий игры «Ночная игра»")).toBeTrue();
    expect(yaml).toContain("# Файлы");
    // The header is a comment, so it must not disturb the document itself.
    expect((await parseScenarioYaml(yaml)).name).toBe("Ночная игра");
  });
});

describe("yamlFileName", () => {
  it("makes a file name out of the game name", () => {
    expect(yamlFileName("Ночная игра")).toBe("Ночная-игра.yaml");
  });

  it("drops what a file name cannot hold, and never comes back empty", () => {
    expect(yamlFileName('игра: "первая"/вторая')).toBe("игра-перваявторая.yaml");
    expect(yamlFileName("   ")).toBe("scenario.yaml");
  });
});

describe("parseScenarioYaml", () => {
  it("reads a document written by hand", async () => {
    const parsed = await parseScenarioYaml(`
name: Простая игра
levels:
  - id: lvl_1
    time_hints:
      - time: 0
        hint:
          - type: text
            text: загадка
    conditions:
      - type: WIN_KEY
        keys: [shone, SHTWO, SHTWO]
`);

    expect(parsed.name).toBe("Простая игра");
    expect(parsed.__model_version__).toBe(SCENARIO_MODEL_VERSION);
    expect(parsed.levels.length).toBe(1);
    expect(parsed.levels[0].time_hints[0].hint[0].text).toBe("загадка");
    // Keys are uppercased and deduplicated, as the editor would.
    expect(parsed.levels[0].conditions[0].keys).toEqual(["SHONE", "SHTWO"]);
    expect(parsed.files).toEqual([]);
  });

  it("gives an effect without an id one of its own", async () => {
    const parsed = await parseScenarioYaml(`
name: Игра
levels:
  - id: lvl_1
    time_hints: []
    conditions:
      - type: EFFECTS_KEY
        keys: [SHBONUS]
        effects:
          bonus_minutes: 10
`);

    const effects = parsed.levels[0].conditions[0].effects!;
    expect(effects.id.length).toBeGreaterThan(0);
    expect(effects.bonus_minutes).toBe(10);
    expect(effects.level_up).toBeFalse();
    expect(effects.next_level).toBeNull();
    expect(effects.hints).toEqual([]);
  });

  it("drops a spoiler the hint type cannot carry", async () => {
    const parsed = await parseScenarioYaml(`
name: Игра
levels:
  - id: lvl_1
    time_hints:
      - time: 0
        hint:
          - type: document
            file_guid: guid-1
            has_spoiler: true
    conditions:
      - type: WIN_KEY
        keys: [SHONE]
`);

    expect(parsed.levels[0].time_hints[0].hint[0].has_spoiler).toBeUndefined();
  });

  it("rejects a broken document, naming the place to look at", async () => {
    await expectAsync(parseScenarioYaml("")).toBeRejectedWithError(ScenarioYamlError, /пуст/);
    await expectAsync(parseScenarioYaml("name: игра\nlevels: [")).toBeRejectedWithError(
      ScenarioYamlError, /не удалось разобрать YAML/);
    await expectAsync(parseScenarioYaml("name: игра\nlevels: {}")).toBeRejectedWithError(
      ScenarioYamlError, /ожидался список/);
    await expectAsync(parseScenarioYaml("name: игра\nlevels: []")).toBeRejectedWithError(
      ScenarioYamlError, /нет ни одного уровня/);
    await expectAsync(parseScenarioYaml(
      "name: игра\nlevels:\n  - time_hints: []\n    conditions: []",
    )).toBeRejectedWithError(ScenarioYamlError, /уровень 1: не задан идентификатор/);
    await expectAsync(parseScenarioYaml(
      "name: игра\nlevels:\n  - id: lvl_1\n    time_hints: []\n"
      + "    conditions:\n      - type: SOMETHING",
    )).toBeRejectedWithError(ScenarioYamlError, /неизвестный тип условия/);
    await expectAsync(parseScenarioYaml(
      "name: игра\nlevels:\n  - id: lvl_1\n    conditions: []\n"
      + "    time_hints:\n      - time: 0\n        hint:\n          - type: hologram",
    )).toBeRejectedWithError(ScenarioYamlError, /неизвестный тип части подсказки/);
  });

  it("refuses a document from a newer version of the model", async () => {
    await expectAsync(parseScenarioYaml(
      `__model_version__: ${SCENARIO_MODEL_VERSION + 1}\nname: игра\nlevels: []`,
    )).toBeRejectedWithError(ScenarioYamlError, /более новой версией/);
  });
});

describe("relinkFileGuids", () => {
  const imported: FilePayload[] = [
    {guid: "old-1", original_filename: "карта", extension: ".png"},
    {guid: "old-2", original_filename: "запись", extension: ".mp3"},
  ];

  it("keeps a guid the game already has", () => {
    const hints = [{type: HintType.photo, file_guid: "old-1"}];
    const gameFiles: FilePayload[] = [
      {guid: "old-1", original_filename: "что-то ещё", extension: ".png"},
    ];

    expect(relinkFileGuids(hints, gameFiles, imported)).toEqual([]);
    expect(hints[0].file_guid).toBe("old-1");
  });

  it("points a hint at the file of this game with the same name", () => {
    const hints = [
      {type: HintType.photo, file_guid: "old-1", thumb_guid: "old-2"},
    ];
    const gameFiles: FilePayload[] = [
      {guid: "new-1", original_filename: "Карта", extension: ".PNG"},
      {guid: "new-2", original_filename: "запись", extension: ".mp3"},
    ];

    expect(relinkFileGuids(hints, gameFiles, imported)).toEqual([]);
    expect(hints[0].file_guid).toBe("new-1");
    expect(hints[0].thumb_guid).toBe("new-2");
  });

  it("reports what the game has no file for, by the name the document gave", () => {
    const hints = [
      {type: HintType.photo, file_guid: "old-1"},
      {type: HintType.audio, file_guid: "old-3"},
    ];

    const missing = relinkFileGuids(hints, [], imported);

    expect(missing).toEqual([
      {guid: "old-1", name: "карта.png"},
      {guid: "old-3", name: undefined},
    ]);
    // Nothing matched, so the hints keep pointing where they did.
    expect(hints[0].file_guid).toBe("old-1");
  });
});

describe("scenarioHints", () => {
  it("collects the hints of the time hints and of the effects", () => {
    expect(scenarioHints(scenario()).map(h => h.type)).toEqual([
      HintType.text,
      HintType.photo,
      HintType.text,
      HintType.gps,
    ]);
  });
});
