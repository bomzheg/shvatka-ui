import {DOCUMENT} from "@angular/common";
import {Inject, Injectable, signal} from "@angular/core";
import {
  defaultPushSettings,
  isDefaultPushSettings,
  isEverythingMuted,
  isKindEnabled,
  mutedKinds,
  normalizePushSettings,
  PushCategory,
  PushSettings,
  PushSettingsForWorker,
} from "./push-settings";

/** The message the service worker listens for; it keeps its own copy of the outcome. */
export const PUSH_SETTINGS_MESSAGE = "set-push-settings";

/**
 * Per-device push preferences, kept in `localStorage` (and only there): the
 * backend still sends every push this player is entitled to, and the device
 * decides what to show. So the settings follow the browser, not the account —
 * a phone can stay loud while a work laptop keeps quiet.
 *
 * Filtering happens in two places, because a push arrives in two ways: the
 * service worker draws the system notification (it is handed the muted kinds
 * on every change), and `PushService` raises the in-app toast while the app is
 * open.
 */
@Injectable({providedIn: "root"})
export class PushSettingsService {
  private readonly storageKey = "shvatka.push.settings";
  private readonly browserWindow: Window | null;
  /** Signal so templates re-read the switches; the value is replaced, never mutated. */
  readonly settings = signal<PushSettings>(defaultPushSettings());

  constructor(@Inject(DOCUMENT) document: Document) {
    this.browserWindow = document.defaultView;
    this.settings.set(this.read());
  }

  isCategoryEnabled(category: PushCategory): boolean {
    return this.settings().categories[category];
  }

  setCategoryEnabled(category: PushCategory, enabled: boolean): void {
    const current = this.settings();
    if (current.categories[category] === enabled) {
      return;
    }
    this.save({...current, categories: {...current.categories, [category]: enabled}});
  }

  get vibrate(): boolean {
    return this.settings().vibrate;
  }

  setVibrate(vibrate: boolean): void {
    const current = this.settings();
    if (current.vibrate === vibrate) {
      return;
    }
    this.save({...current, vibrate});
  }

  /** Whether a push of this kind is wanted here — asked by the in-app toast. */
  isKindEnabled(kind: string | undefined): boolean {
    return isKindEnabled(this.settings(), kind);
  }

  /** Every category off: the profile offers to turn push off outright instead. */
  isEverythingMuted(): boolean {
    return isEverythingMuted(this.settings());
  }

  /** Whether the player has changed anything here yet. */
  isDefault(): boolean {
    return isDefaultPushSettings(this.settings());
  }

  resetToDefaults(): void {
    this.save(defaultPushSettings());
  }

  /**
   * Hands the current settings to the service worker. Called on every change
   * and once on bootstrap, since the worker's own copy survives its restarts
   * but not a change made while it was asleep.
   */
  syncToServiceWorker(): void {
    const container = this.browserWindow?.navigator?.serviceWorker;
    if (!container) {
      return;
    }
    const message: PushSettingsForWorker & {type: string} = {
      type: PUSH_SETTINGS_MESSAGE,
      ...this.forWorker(),
    };
    container.ready
      .then(registration => (registration.active ?? container.controller)?.postMessage(message))
      .catch(error => console.error("push: settings sync failed", error));
  }

  /** The settings as the worker takes them: kinds to hide, and whether to vibrate. */
  forWorker(): PushSettingsForWorker {
    const current = this.settings();
    return {mutedKinds: mutedKinds(current), vibrate: current.vibrate};
  }

  private save(settings: PushSettings): void {
    this.settings.set(settings);
    try {
      this.browserWindow?.localStorage?.setItem(this.storageKey, JSON.stringify(settings));
    } catch {
      // Private mode or disabled storage: the choice holds for this session only.
    }
    this.syncToServiceWorker();
  }

  private read(): PushSettings {
    try {
      const saved = this.browserWindow?.localStorage?.getItem(this.storageKey);
      return normalizePushSettings(saved ? JSON.parse(saved) : null);
    } catch {
      // Unreadable storage or leftover garbage: everything on, as before.
      return defaultPushSettings();
    }
  }
}
