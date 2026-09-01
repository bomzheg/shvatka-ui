import {HintType, ScenarioConditionType} from "../domain/game.models";
import {
  cleanHint,
  ConditionPayload,
  EffectsPayload,
  FilePayload,
  generateEffectId,
  HintPayload,
  LevelPayload,
  LinkPreview,
  SCENARIO_MODEL_VERSION,
  ScenarioPayload,
  TimeHintPayload,
} from "./constructor.models";

// ---------------------------------------------------------------------------
// The scenario as a YAML document: what the constructor writes out and reads
// back. The document mirrors the "Game Scenario object" contract one to one —
// the same snake_case keys the API takes — so a file can be edited by hand, put
// under version control, or moved between games.
//
// A file (photo, audio, video…) is never part of the document: only its guid
// and its name travel. Importing into another game therefore needs the files
// uploaded there first; {@link relinkFileGuids} then matches them by name.
//
// js-yaml is pulled in on demand — only an author who exports or imports pays
// for it, and the bundle everyone else loads is unchanged.
// ---------------------------------------------------------------------------

/** A file a hint refers to that the game does not (yet) have. */
export interface MissingScenarioFile {
  guid: string;
  /** Name the imported document carried for this guid, when it carried one. */
  name?: string;
}

/** Everything wrong with a document is reported as this, in Russian. */
export class ScenarioYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioYamlError";
  }
}

const KNOWN_HINT_TYPES = new Set<string>(Object.values(HintType));
const KNOWN_CONDITION_TYPES = new Set<string>(Object.values(ScenarioConditionType));

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** The scenario as a YAML document, with a header explaining the file part. */
export async function scenarioToYaml(scenario: ScenarioPayload): Promise<string> {
  const {dump} = await import("js-yaml");
  const header = [
    `# Сценарий игры «${scenario.name || "без названия"}» — экспорт конструктора Схватки.`,
    "#",
    "# Файлы (фото, аудио, видео, документы) в этот файл не попадают — только их",
    "# guid и имена. Чтобы перенести сценарий в другую игру, загрузите туда файлы",
    "# с теми же именами: конструктор свяжет подсказки с ними при импорте.",
    "",
  ].join("\n");
  const body = dump(stripUndefined(scenario), {
    noRefs: true,
    lineWidth: 100,
    // Keep the contract's key order (type first in a hint) instead of a-z.
    sortKeys: false,
  });
  return `${header}${body}`;
}

/** A file name safe to offer as the download name of an exported scenario. */
export function yamlFileName(gameName: string): string {
  const base = (gameName || "scenario")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "scenario"}.yaml`;
}

/** Deep copy without the undefined values js-yaml would silently drop anyway. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) {
        out[key] = stripUndefined(item);
      }
    }
    return out as T;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Parse a YAML document into a scenario payload, rejecting anything the editor
 * could not represent. Unknown keys are dropped rather than carried through:
 * what comes back is exactly what a save would send.
 */
export async function parseScenarioYaml(text: string): Promise<ScenarioPayload> {
  const {load} = await import("js-yaml");

  let doc: unknown;
  try {
    doc = load(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ScenarioYamlError(`не удалось разобрать YAML: ${message}`);
  }

  if (doc === null || doc === undefined || doc === "") {
    throw new ScenarioYamlError("файл пуст");
  }
  const root = asRecord(doc, "сценарий");

  const version = num(root["__model_version__"]);
  if (version !== undefined && version > SCENARIO_MODEL_VERSION) {
    throw new ScenarioYamlError(
      `файл сохранён более новой версией конструктора (версия модели ${version}).`,
    );
  }

  const rawLevels = asArray(root["levels"], "levels");
  if (rawLevels.length === 0) {
    throw new ScenarioYamlError("в сценарии нет ни одного уровня");
  }

  return {
    name: str(root["name"]) ?? "",
    __model_version__: SCENARIO_MODEL_VERSION,
    levels: rawLevels.map((level, index) => parseLevel(level, index)),
    files: parseFiles(root["files"]),
  };
}

function parseLevel(raw: unknown, index: number): LevelPayload {
  const label = `уровень ${index + 1}`;
  const level = asRecord(raw, label);
  const id = str(level["id"]) ?? str(level["name_id"]);
  if (!id) {
    throw new ScenarioYamlError(`${label}: не задан идентификатор (id)`);
  }

  const named = `уровень «${id}»`;
  const timeHints = asArray(level["time_hints"], `${named}: time_hints`);
  const conditions = asArray(level["conditions"], `${named}: conditions`);

  // The keys go in the order a save writes them, so exporting what was just
  // imported gives back the same document.
  return {
    id,
    __model_version__: SCENARIO_MODEL_VERSION,
    time_hints: timeHints.map((th, i) => parseTimeHint(th, `${named}, подсказка ${i + 1}`)),
    conditions: conditions.map((c, i) => parseCondition(c, `${named}, условие ${i + 1}`)),
  };
}

function parseTimeHint(raw: unknown, label: string): TimeHintPayload {
  const timeHint = asRecord(raw, label);
  const time = num(timeHint["time"]);
  if (time === undefined) {
    throw new ScenarioYamlError(`${label}: не задано время (time)`);
  }
  // The contract spells it `hint`; `hints` is accepted as a courtesy to files
  // written by hand.
  const parts = timeHint["hint"] !== undefined ? timeHint["hint"] : timeHint["hints"];
  return {
    time,
    hint: asArray(parts, `${label}: hint`).map((h, i) => parseHint(h, `${label}, часть ${i + 1}`)),
  };
}

function parseCondition(raw: unknown, label: string): ConditionPayload {
  const condition = asRecord(raw, label);
  const rawType = str(condition["type"])?.toUpperCase();
  if (!rawType || !KNOWN_CONDITION_TYPES.has(rawType)) {
    throw new ScenarioYamlError(`${label}: неизвестный тип условия «${str(condition["type"]) ?? ""}»`);
  }
  const type = rawType as ScenarioConditionType;

  const out: ConditionPayload = {type};
  if (type === ScenarioConditionType.winKey || type === ScenarioConditionType.effectsKey) {
    out.keys = parseKeyList(condition["keys"], label);
  }
  if (type === ScenarioConditionType.effectsTimer) {
    const actionTime = num(condition["action_time"]);
    if (actionTime === undefined) {
      throw new ScenarioYamlError(`${label}: не задано время срабатывания (action_time)`);
    }
    out.action_time = actionTime;
  }
  if (type !== ScenarioConditionType.winKey) {
    out.effects = parseEffects(condition["effects"], label);
  }
  return out;
}

function parseKeyList(raw: unknown, label: string): string[] {
  const keys = asArray(raw, `${label}: keys`)
    .map(key => str(key)?.toUpperCase())
    .filter((key): key is string => !!key && key.length > 0);
  return Array.from(new Set(keys));
}

function parseEffects(raw: unknown, label: string): EffectsPayload {
  // The engine has been known to answer with a single-element list here; the
  // editor reads both shapes, so the document may carry either too.
  const source = Array.isArray(raw) ? raw[0] : raw;
  const effects = source === undefined || source === null
    ? {}
    : asRecord(source, `${label}: effects`);
  const hints = effects["hints"] !== undefined ? effects["hints"] : effects["hints_"];

  return {
    id: str(effects["id"]) ?? generateEffectId(),
    hints: hints === undefined || hints === null
      ? []
      : asArray(hints, `${label}: effects.hints`)
        .map((h, i) => parseHint(h, `${label}, эффект, часть ${i + 1}`)),
    bonus_minutes: num(effects["bonus_minutes"]) ?? 0,
    level_up: bool(effects["level_up"]) === true,
    next_level: str(effects["next_level"]) ?? null,
  };
}

function parseHint(raw: unknown, label: string): HintPayload {
  const hint = asRecord(raw, label);
  const type = str(hint["type"]);
  if (!type || !KNOWN_HINT_TYPES.has(type)) {
    throw new ScenarioYamlError(`${label}: неизвестный тип части подсказки «${type ?? ""}»`);
  }

  const out: HintPayload = {type: type as HintType};
  const copyString = (key: "text" | "title" | "address" | "foursquare_id" | "foursquare_type"
    | "caption" | "file_guid" | "thumb_guid" | "phone_number" | "first_name" | "last_name"
    | "vcard") => {
    const value = str(hint[key]);
    if (value !== undefined) {
      out[key] = value;
    }
  };
  copyString("text");
  copyString("title");
  copyString("address");
  copyString("foursquare_id");
  copyString("foursquare_type");
  copyString("caption");
  copyString("file_guid");
  copyString("thumb_guid");
  copyString("phone_number");
  copyString("first_name");
  copyString("last_name");
  copyString("vcard");
  out.latitude = num(hint["latitude"]);
  out.longitude = num(hint["longitude"]);
  out.show_caption_above_media = bool(hint["show_caption_above_media"]);
  out.has_spoiler = bool(hint["has_spoiler"]);
  const linkPreview = parseLinkPreview(hint["link_preview"], label);
  if (linkPreview) {
    out.link_preview = linkPreview;
  }

  // The same normalization a save runs, so an imported hint and a hand-built
  // one are indistinguishable afterwards.
  return cleanHint(out);
}

function parseLinkPreview(raw: unknown, label: string): LinkPreview | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const preview = asRecord(raw, `${label}: link_preview`);
  const out: LinkPreview = {};
  const url = str(preview["url"]);
  if (url !== undefined) {
    out.url = url;
  }
  const copyFlag = (key: "is_disabled" | "prefer_small_media" | "prefer_large_media"
    | "show_above_text") => {
    const value = bool(preview[key]);
    if (value !== undefined) {
      out[key] = value;
    }
  };
  copyFlag("is_disabled");
  copyFlag("prefer_small_media");
  copyFlag("prefer_large_media");
  copyFlag("show_above_text");
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseFiles(raw: unknown): FilePayload[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  return asArray(raw, "files")
    .map((item, index) => {
      const file = asRecord(item, `files[${index}]`);
      const guid = str(file["guid"]);
      if (!guid) {
        return undefined;
      }
      const entry: FilePayload = {
        guid,
        original_filename: str(file["original_filename"]) ?? guid,
        extension: str(file["extension"]) ?? "",
      };
      const contentType = str(file["content_type"]);
      if (contentType !== undefined) {
        entry.content_type = contentType;
      }
      const mimeType = str(file["mime_type"]);
      if (mimeType !== undefined) {
        entry.mime_type = mimeType;
      }
      const sha256 = str(file["sha256"]);
      if (sha256 !== undefined) {
        entry.sha256 = sha256;
      }
      return entry;
    })
    .filter((f): f is FilePayload => f !== undefined);
}

// ---------------------------------------------------------------------------
// Files: matching an imported guid to a file of this game
// ---------------------------------------------------------------------------

/** Every hint of a scenario — time hints first, then the ones effects carry. */
export function scenarioHints(scenario: ScenarioPayload): HintPayload[] {
  const hints: HintPayload[] = [];
  for (const level of scenario.levels) {
    for (const timeHint of level.time_hints) {
      hints.push(...timeHint.hint);
    }
    for (const condition of level.conditions) {
      hints.push(...(condition.effects?.hints ?? []));
    }
  }
  return hints;
}

/**
 * Point the hints at the files this game actually has.
 *
 * A guid the game knows is left alone. Any other guid is looked up by the name
 * the imported document gave it: a file of this game with the same name takes
 * its place — which is what makes a scenario portable, the author only has to
 * upload the same files again. What still has no match is returned, so the
 * editor can name the files that are missing.
 *
 * The hints are rewritten in place.
 */
export function relinkFileGuids(
  hints: HintPayload[],
  gameFiles: FilePayload[],
  importedFiles: FilePayload[],
): MissingScenarioFile[] {
  const known = new Set(gameFiles.map(f => f.guid));
  const byName = new Map<string, string>();
  for (const file of gameFiles) {
    const key = fileNameKey(file);
    if (key && !byName.has(key)) {
      byName.set(key, file.guid);
    }
  }
  const importedByGuid = new Map(importedFiles.map(f => [f.guid, f]));

  const missing = new Map<string, MissingScenarioFile>();
  const resolve = (guid: string): string => {
    if (known.has(guid)) {
      return guid;
    }
    const imported = importedByGuid.get(guid);
    const match = imported ? byName.get(fileNameKey(imported)) : undefined;
    if (match) {
      return match;
    }
    if (!missing.has(guid)) {
      missing.set(guid, {guid, name: imported ? fileLabel(imported) : undefined});
    }
    return guid;
  };

  for (const hint of hints) {
    if (hint.file_guid) {
      hint.file_guid = resolve(hint.file_guid);
    }
    if (hint.thumb_guid) {
      hint.thumb_guid = resolve(hint.thumb_guid);
    }
  }

  return Array.from(missing.values());
}

/** `name.ext` of a file, lowercased — what two games match their files by. */
function fileNameKey(file: FilePayload): string {
  if (!file.original_filename || file.original_filename === file.guid) {
    return "";
  }
  return fileLabel(file).toLowerCase();
}

function fileLabel(file: FilePayload): string {
  return `${file.original_filename}${file.extension || ""}`;
}

// ---------------------------------------------------------------------------
// Small typed readers. Everything they reject is reported in Russian, naming
// the place in the document the author has to look at.
// ---------------------------------------------------------------------------

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScenarioYamlError(`${what}: ожидался объект`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ScenarioYamlError(`${what}: ожидался список`);
  }
  return value;
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function bool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}
