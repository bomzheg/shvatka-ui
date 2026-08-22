import {DOCUMENT} from "@angular/common";
import {Inject, Injectable, signal} from "@angular/core";

/** How many dismissals to keep — old games are never asked about again anyway. */
const MAX_REMEMBERED = 30;

/**
 * Remembers, per game, that the player asked not to be nagged about turning
 * notifications on. Kept in `localStorage` (and only there): it is a per-device
 * preference about a prompt, not account state the backend needs to know.
 */
@Injectable({providedIn: "root"})
export class PushPromptService {
  private readonly storageKey = "shvatka.push.prompt.dismissed";
  private readonly browserWindow: Window | null;
  /** Bumped on every change so templates re-read `isDismissed`. */
  private readonly revision = signal(0);
  private dismissed: string[];

  constructor(@Inject(DOCUMENT) document: Document) {
    this.browserWindow = document.defaultView;
    this.dismissed = this.read();
  }

  isDismissed(scope: string): boolean {
    this.revision();
    return this.dismissed.includes(scope);
  }

  dismiss(scope: string): void {
    if (this.dismissed.includes(scope)) {
      return;
    }
    this.dismissed = [...this.dismissed, scope].slice(-MAX_REMEMBERED);
    this.write();
  }

  /** Whether anything was ever waved away — the profile offers to undo it. */
  hasDismissed(): boolean {
    this.revision();
    return this.dismissed.length > 0;
  }

  /** Undo every dismissal, so the prompt shows up again. */
  clearDismissed(): void {
    if (this.dismissed.length === 0) {
      return;
    }
    this.dismissed = [];
    this.write();
  }

  /** The scope key of one game's prompt. */
  gameScope(gameId: number): string {
    return `game:${gameId}`;
  }

  private read(): string[] {
    try {
      const saved = this.browserWindow?.localStorage?.getItem(this.storageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
    } catch {
      // Private mode, disabled storage or leftover garbage: just never dismissed.
      return [];
    }
  }

  private write(): void {
    try {
      this.browserWindow?.localStorage?.setItem(this.storageKey, JSON.stringify(this.dismissed));
    } catch {
      // The preference is a nicety — losing it must not break the page.
    }
    this.revision.update(value => value + 1);
  }
}
