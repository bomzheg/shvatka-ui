/**
 * Which pushes this browser wants to see.
 *
 * The engine sends every push a player is entitled to and tags it with a
 * `data.kind`; the choice of what to actually show is made here, on the device.
 * Categories — not raw kinds — are what a player picks: a kind is an engine
 * detail that may gain a sibling at any time, so an unknown kind is always
 * shown rather than silently swallowed.
 *
 * Kept free of Angular so both the service and its tests can use it, and so
 * the mapping lives in exactly one place: the service worker never learns the
 * categories, it is handed the flat list of muted kinds.
 */

export type PushCategory = "play" | "hints" | "team" | "org";

export interface PushCategoryDescriptor {
  id: PushCategory;
  /** Switch label, as the player reads it. */
  label: string;
  /** One line spelling out what falls into the category. */
  hint: string;
  /** The engine's `data.kind` values this category covers. */
  kinds: readonly string[];
}

/** Every category, in the order the profile lists them. */
export const PUSH_CATEGORIES: readonly PushCategoryDescriptor[] = [
  {
    id: "play",
    label: "Ход игры",
    hint: "Новый уровень, сработавшие эффекты, финиш команды и игры.",
    kinds: ["puzzle", "effects", "team_finished", "game_finished"],
  },
  {
    id: "hints",
    label: "Подсказки",
    hint: "Каждая подсказка, открывшаяся команде на уровне.",
    kinds: ["hint"],
  },
  {
    id: "team",
    label: "Команда",
    hint: "Игрок вступил или вышел, смена капитана, новое название.",
    kinds: ["player_joined_team", "player_left_team", "team_captain_changed", "team_renamed"],
  },
  {
    id: "org",
    label: "Организатору",
    hint: "Переходы команд, новые орги, завершённое тестирование уровня.",
    kinds: ["org_level_up", "new_org", "level_test_completed"],
  },
];

/** The per-device preferences as they are stored and applied. */
export interface PushSettings {
  categories: Record<PushCategory, boolean>;
  /** Whether a shown notification vibrates the device. */
  vibrate: boolean;
}

/** What the service worker needs to apply the settings: no categories, only the outcome. */
export interface PushSettingsForWorker {
  mutedKinds: string[];
  vibrate: boolean;
}

/** Everything on: a player who never opened the settings gets what they got before. */
export function defaultPushSettings(): PushSettings {
  const categories = {} as Record<PushCategory, boolean>;
  for (const category of PUSH_CATEGORIES) {
    categories[category.id] = true;
  }
  return {categories, vibrate: true};
}

/**
 * Reads whatever was stored back into settings, filling in anything missing:
 * a category added in a later release is on until its owner turns it off.
 */
export function normalizePushSettings(raw: unknown): PushSettings {
  const settings = defaultPushSettings();
  if (!raw || typeof raw !== "object") {
    return settings;
  }

  const source = raw as Record<string, unknown>;
  const categories = source["categories"];
  if (categories && typeof categories === "object") {
    const stored = categories as Record<string, unknown>;
    for (const category of PUSH_CATEGORIES) {
      if (typeof stored[category.id] === "boolean") {
        settings.categories[category.id] = stored[category.id] as boolean;
      }
    }
  }
  if (typeof source["vibrate"] === "boolean") {
    settings.vibrate = source["vibrate"] as boolean;
  }
  return settings;
}

/** The category a kind belongs to, or `null` for a kind this release doesn't know. */
export function categoryOfKind(kind: string): PushCategory | null {
  return PUSH_CATEGORIES.find(category => category.kinds.includes(kind))?.id ?? null;
}

/** Whether a push of this kind should be shown. An unknown kind always is. */
export function isKindEnabled(settings: PushSettings, kind: string | undefined): boolean {
  if (!kind) {
    return true;
  }
  const category = categoryOfKind(kind);
  return category === null || settings.categories[category];
}

/** The kinds to hide, in the flat form the service worker applies. */
export function mutedKinds(settings: PushSettings): string[] {
  return PUSH_CATEGORIES
    .filter(category => !settings.categories[category.id])
    .flatMap(category => [...category.kinds]);
}

/** Whether every category is off — the point at which turning push off is the honest choice. */
export function isEverythingMuted(settings: PushSettings): boolean {
  return PUSH_CATEGORIES.every(category => !settings.categories[category.id]);
}

/** Whether nothing was changed from the defaults — the profile hides «вернуть» until it is. */
export function isDefaultPushSettings(settings: PushSettings): boolean {
  return settings.vibrate && PUSH_CATEGORIES.every(category => settings.categories[category.id]);
}
