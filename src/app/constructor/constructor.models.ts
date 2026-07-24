import {HintType, ScenarioConditionType} from "../domain/game.models";
import {HttpErrorResponse} from "@angular/common/http";

// ---------------------------------------------------------------------------
// Constructor payload model — mirrors the "Game Scenario object" contract (§2).
// All fields are snake_case so the objects can be round-tripped (load → edit →
// save) without any key conversion.
// ---------------------------------------------------------------------------

export const SCENARIO_MODEL_VERSION = 1;

export interface MyGameAuthor {
  id: number;
  can_be_author: boolean;
  name_mention: string;
}

/** Item shape of `GET /games/my` and `POST /games/my` (§1.1). */
export interface MyGame {
  id: number;
  author: MyGameAuthor;
  name: string;
  status: string;
  start_at: string | null;
  number: number | null;
}

/** Upload response of `POST /cdn/games/{id}/files` (§1.7). */
export interface UploadedFile {
  guid: string;
  original_filename: string;
  extension: string;
  content_type?: string;
  mime_type?: string;
  sha256?: string;
}

/**
 * Optional flags of `POST /cdn/games/{id}/files` that control how an
 * unsupported image (HEIC/HEIF) is handled server-side. Both default to false;
 * ordinary formats (JPEG/PNG/mp4/…) ignore them entirely.
 */
export interface UploadOptions {
  /** Convert the unsupported image to JPEG before storing (lands as `.jpg`). */
  allowConversion?: boolean;
  /** Store the original bytes untouched instead of rejecting (won't preview). */
  saveUnsupportedAsIs?: boolean;
}

/** Build the query string for {@link UploadOptions}, or "" when none apply. */
export function uploadOptionsQuery(options?: UploadOptions): string {
  const params = new URLSearchParams();
  if (options?.allowConversion) {
    params.set("allow_conversion", "true");
  }
  if (options?.saveUnsupportedAsIs) {
    params.set("save_unsupported_as_is", "true");
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const HEIC_EXTENSIONS = [".heic", ".heif"];
const HEIC_MIME_TYPES = ["image/heic", "image/heif"];

/**
 * Best-effort client-side detection of a HEIC/HEIF image by MIME type or file
 * extension. The browser may report an empty MIME type for `.heic`, so the
 * extension is the reliable signal; the server remains the source of truth
 * (always be ready to handle a 415, see {@link isUnsupportedMediaError}).
 */
export function isHeicFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (HEIC_MIME_TYPES.includes(type)) {
    return true;
  }
  const name = (file.name || "").toLowerCase();
  return HEIC_EXTENSIONS.some(ext => name.endsWith(ext));
}

/** Whether a failed upload was rejected as an unsupported media type (415). */
export function isUnsupportedMediaError(err: unknown): err is HttpErrorResponse {
  return err instanceof HttpErrorResponse && err.status === 415;
}

/**
 * The user-facing message of a 415 rejection. The backend nests it under
 * `detail.text` (a localized string); `detail.description` is diagnostic only.
 */
export function unsupportedMediaMessage(err: HttpErrorResponse): string {
  const body = err.error as { detail?: { text?: unknown } } | null;
  const text = body?.detail?.text;
  return typeof text === "string" && text.length > 0
    ? text
    : "Формат файла не поддерживается для загрузки.";
}

export interface LinkPreview {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

/** Hint, discriminated by `type` (§2.3). Only the fields relevant to the
 *  selected type are sent; the rest stay undefined. */
export interface HintPayload {
  type: HintType;
  // text
  text?: string;
  link_preview?: LinkPreview | null;
  // gps / venue
  latitude?: number;
  longitude?: number;
  // venue
  title?: string;
  address?: string;
  foursquare_id?: string;
  foursquare_type?: string;
  // media
  caption?: string;
  show_caption_above_media?: boolean;
  file_guid?: string;
  thumb_guid?: string;
  // contact
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  vcard?: string;
}

export interface TimeHintPayload {
  time: number;
  hint: HintPayload[];
}

/** Effects (§2.5). A single object per effects condition. */
export interface EffectsPayload {
  id: string;
  hints: HintPayload[];
  bonus_minutes: number;
  level_up: boolean;
  next_level: string | null;
}

/** Condition, discriminated by `type` (§2.4). */
export interface ConditionPayload {
  type: ScenarioConditionType;
  keys?: string[];
  action_time?: number;
  effects?: EffectsPayload;
}

export interface LevelPayload {
  id: string;
  __model_version__: number;
  conditions: ConditionPayload[];
  time_hints: TimeHintPayload[];
}

export interface FilePayload {
  guid: string;
  original_filename: string;
  extension: string;
  content_type?: string;
  mime_type?: string;
  sha256?: string;
}

/** Body of `PUT /games/my/{id}/scenario` (§2). */
export interface ScenarioPayload {
  name: string;
  __model_version__: number;
  levels: LevelPayload[];
  files: FilePayload[];
}

// ---------------------------------------------------------------------------
// Constants for UI rendering
// ---------------------------------------------------------------------------

export const HINT_TYPE_LABELS: Record<HintType, string> = {
  [HintType.text]: "Текст",
  [HintType.gps]: "Координаты (GPS)",
  [HintType.venue]: "Место (venue)",
  [HintType.photo]: "Фото",
  [HintType.audio]: "Аудио",
  [HintType.video]: "Видео",
  [HintType.document]: "Документ",
  [HintType.animation]: "Анимация (GIF)",
  [HintType.voice]: "Голосовое",
  [HintType.video_note]: "Видеосообщение (кружок)",
  [HintType.contact]: "Контакт",
  [HintType.sticker]: "Стикер",
};

export const ALL_HINT_TYPES: HintType[] = [
  HintType.text,
  HintType.gps,
  HintType.venue,
  HintType.photo,
  HintType.audio,
  HintType.video,
  HintType.document,
  HintType.animation,
  HintType.voice,
  HintType.video_note,
  HintType.contact,
  HintType.sticker,
];

/**
 * Hint types that can be created from the web constructor. Sticker, voice and
 * video_note are intentionally excluded — we cannot upload those from the web.
 * Existing hints of those types still render/edit, they just can't be added.
 */
export const CREATABLE_HINT_TYPES: HintType[] = [
  HintType.text,
  HintType.gps,
  HintType.venue,
  HintType.photo,
  HintType.audio,
  HintType.video,
  HintType.document,
  HintType.animation,
  HintType.contact,
];

/** Hint types that carry a main file (`file_guid`). */
export const FILE_HINT_TYPES: HintType[] = [
  HintType.photo,
  HintType.audio,
  HintType.video,
  HintType.document,
  HintType.animation,
  HintType.voice,
  HintType.video_note,
  HintType.sticker,
];

/** Hint types that may carry an optional thumbnail (`thumb_guid`). */
export const THUMB_HINT_TYPES: HintType[] = [
  HintType.audio,
  HintType.video,
  HintType.document,
  HintType.animation,
];

/** Hint types that support a caption. */
export const CAPTION_HINT_TYPES: HintType[] = [
  HintType.photo,
  HintType.audio,
  HintType.video,
  HintType.document,
  HintType.animation,
  HintType.voice,
];

/** Hint types that support `show_caption_above_media`. */
export const CAPTION_ABOVE_HINT_TYPES: HintType[] = [
  HintType.photo,
  HintType.video,
  HintType.animation,
];

/** Labels for the CDN `content_type` of an uploaded file. */
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  photo: "Фото",
  video: "Видео",
  audio: "Аудио",
  document: "Документ",
};

export const STATUS_LABELS: Record<string, string> = {
  underconstruction: "В разработке",
  ready: "Готова",
  getting_waivers: "Сбор вейверов",
  started: "Идёт",
  finished: "Завершена",
  complete: "Опубликована",
};

export const EDITABLE_STATUSES = ["underconstruction", "ready", "getting_waivers"];

export function isEditableStatus(status: string | undefined): boolean {
  return !!status && EDITABLE_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Key format (§2.6): start with Latin SH or Cyrillic СХ, then uppercase
// letters/digits (Latin or Cyrillic). No lowercase, no spaces.
// ---------------------------------------------------------------------------

const KEY_REGEX = /^(SH|СХ)[A-Z0-9А-ЯЁ]+$/;
const LEVEL_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function isValidKey(key: string): boolean {
  return KEY_REGEX.test(key);
}

export function isValidLevelId(id: string): boolean {
  return LEVEL_ID_REGEX.test(id);
}

/** Parse a free-text keys field (separated by spaces / commas / newlines)
 *  into a normalized, uppercased list of unique keys. */
export function parseKeys(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map(p => p.trim().toUpperCase())
    .filter(p => p.length > 0);
  return Array.from(new Set(parts));
}

/** Human readable (ru) description of a request error, for snackbars. */
export function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return "сервер недоступен";
    }
    const body = err.error as { type?: unknown; description?: unknown; text?: unknown } | null;
    if (body && typeof body === "object") {
      const type = String(body.type ?? "");
      const description = String(body.description ?? body.text ?? "");
      const parts = [type, description].filter(s => s.length > 0).join(": ");
      return `[${err.status}] ${parts || "ошибка запроса"}`;
    }
    return `[${err.status}] ${err.statusText || "ошибка запроса"}`;
  }
  return "неизвестная ошибка";
}

export function generateEffectId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback (non-cryptographic) for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// Client-side validation of the scenario (§3). The server enforces all of
// these regardless; we validate locally for good UX. Returns a list of human
// readable (ru) error messages — empty list means valid.
// ---------------------------------------------------------------------------

function isWinningTimer(c: ConditionPayload): boolean {
  return c.type === ScenarioConditionType.effectsTimer && c.effects?.level_up === true;
}

function collectGuids(hints: HintPayload[] | undefined, sink: Set<string>) {
  for (const hint of hints ?? []) {
    if (hint.file_guid) {
      sink.add(hint.file_guid);
    }
    if (hint.thumb_guid) {
      sink.add(hint.thumb_guid);
    }
  }
}

export function validateScenario(scenario: ScenarioPayload): string[] {
  const errors: string[] = [];

  if (!scenario.name || scenario.name.trim().length === 0) {
    errors.push("Название игры не может быть пустым.");
  }

  if (scenario.levels.length === 0) {
    errors.push("В игре должен быть хотя бы один уровень.");
  }

  const levelIds = scenario.levels.map(l => l.id);
  const knownFileGuids = new Set(scenario.files.map(f => f.guid));
  const usedGuids = new Set<string>();

  scenario.levels.forEach((level, index) => {
    const label = `Уровень ${index + 1}${level.id ? ` (${level.id})` : ""}`;

    // §13 — level id format
    if (!isValidLevelId(level.id)) {
      errors.push(`${label}: идентификатор уровня должен соответствовать ^[a-zA-Z0-9_-]+$.`);
    }
    if (levelIds.indexOf(level.id) !== index) {
      errors.push(`${label}: идентификатор уровня повторяется.`);
    }

    // time_hints
    const times = level.time_hints.map(t => t.time);
    // §1 — must include time 0
    if (!times.includes(0)) {
      errors.push(`${label}: должна быть подсказка для времени 0.`);
    }
    // §2 — unique times, non-empty hint lists
    const seenTimes = new Set<number>();
    level.time_hints.forEach(th => {
      if (th.time < 0) {
        errors.push(`${label}: время подсказки не может быть отрицательным (${th.time}).`);
      }
      if (seenTimes.has(th.time)) {
        errors.push(`${label}: время ${th.time} повторяется в подсказках.`);
      }
      seenTimes.add(th.time);
      if (!th.hint || th.hint.length === 0) {
        errors.push(`${label}: у подсказки на время ${th.time} пустой список.`);
      }
      collectGuids(th.hint, usedGuids);
    });

    // conditions
    // §4 — non-empty
    if (level.conditions.length === 0) {
      errors.push(`${label}: должно быть хотя бы одно условие.`);
    }

    const winKeys = level.conditions.filter(c => c.type === ScenarioConditionType.winKey);
    const winningTimers = level.conditions.filter(isWinningTimer);
    const hasWin = winKeys.length > 0
      || level.conditions.some(c =>
        (c.type === ScenarioConditionType.effectsKey || c.type === ScenarioConditionType.effectsTimer)
        && c.effects?.level_up === true);

    // §5 — at least one win
    if (!hasWin) {
      errors.push(`${label}: нет условия победы (WIN_KEY или эффект с переходом на уровень).`);
    }
    // §6 — at most one WIN_KEY
    if (winKeys.length > 1) {
      errors.push(`${label}: допускается не более одного условия WIN_KEY.`);
    }
    // §7 — at most one winning timer
    if (winningTimers.length > 1) {
      errors.push(`${label}: допускается не более одного победного таймера.`);
    }

    // §8 — keys globally unique within a level
    const keySeen = new Set<string>();
    // §9 — effect ids unique within a level
    const effectIds = new Set<string>();
    // §10 — timer action_times unique
    const timerTimes = new Set<number>();

    level.conditions.forEach((c, ci) => {
      const cl = `${label}, условие ${ci + 1}`;
      if (c.type === ScenarioConditionType.winKey || c.type === ScenarioConditionType.effectsKey) {
        const keys = c.keys ?? [];
        if (keys.length === 0) {
          errors.push(`${cl}: список ключей пуст.`);
        }
        keys.forEach(k => {
          if (!isValidKey(k)) {
            errors.push(`${cl}: ключ «${k}» имеет неверный формат.`);
          }
          if (keySeen.has(k)) {
            errors.push(`${cl}: ключ «${k}» используется в нескольких условиях уровня.`);
          }
          keySeen.add(k);
        });
      }
      if (c.type === ScenarioConditionType.effectsTimer) {
        if (typeof c.action_time !== "number") {
          errors.push(`${cl}: не задано время срабатывания таймера.`);
        } else if (c.action_time < 0) {
          errors.push(`${cl}: время таймера не может быть отрицательным (${c.action_time}).`);
        } else if (timerTimes.has(c.action_time)) {
          errors.push(`${cl}: два таймера на одно время (${c.action_time}).`);
        } else {
          timerTimes.add(c.action_time);
        }
      }
      if (c.effects) {
        if (effectIds.has(c.effects.id)) {
          errors.push(`${cl}: идентификатор эффекта повторяется в уровне.`);
        }
        effectIds.add(c.effects.id);
        // next_level requires level_up
        if (c.effects.next_level && !c.effects.level_up) {
          errors.push(`${cl}: переход на другой уровень требует включённого «победа/переход».`);
        }
        // §12 — next_level must exist
        if (c.effects.next_level && !levelIds.includes(c.effects.next_level)) {
          errors.push(`${cl}: уровень перехода «${c.effects.next_level}» не существует.`);
        }
        collectGuids(c.effects.hints, usedGuids);
      }
    });

    // §3 / §11 — winning timer constraints
    if (winningTimers.length === 1) {
      const winTime = winningTimers[0].action_time;
      if (typeof winTime === "number") {
        times.forEach(t => {
          if (t >= winTime) {
            errors.push(`${label}: время подсказки ${t} должно быть строго меньше времени победного таймера (${winTime}).`);
          }
        });
        timerTimes.forEach(t => {
          if (t > winTime) {
            errors.push(`${label}: таймер на время ${t} превышает время победного таймера (${winTime}).`);
          }
        });
      }
    }
  });

  // §14 — every used guid must be present in the files array
  usedGuids.forEach(guid => {
    if (!knownFileGuids.has(guid)) {
      errors.push(`Файл ${guid} используется в подсказке, но отсутствует в списке файлов. Загрузите его заново.`);
    }
  });

  return errors;
}
