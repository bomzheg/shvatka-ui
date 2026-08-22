import {Inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";
import {SnackbarService} from "../snackbar/snackbar.service";

/**
 * Display modes a PWA gets once it is launched from the home screen / app list.
 * In all of them the browser address bar is gone, so the only way to pass the
 * current page on is a share button of our own.
 */
const STANDALONE_DISPLAY_MODES = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"];

@Injectable({providedIn: "root"})
export class ShareService {
  private readonly window: (Window & typeof globalThis) | undefined;
  /** Cached once: reading `.matches` stays cheap enough for change detection. */
  private readonly standaloneQueries: MediaQueryList[];

  constructor(
    @Inject(DOCUMENT) private _document: any,
    private snackbar: SnackbarService,
  ) {
    this.window = this._document.defaultView;
    this.standaloneQueries = STANDALONE_DISPLAY_MODES
      .map(mode => this.window?.matchMedia?.(`(display-mode: ${mode})`))
      .filter((query): query is MediaQueryList => !!query);
  }

  /** True when the app runs as an installed PWA, i.e. without an address bar. */
  isInstalledPwa(): boolean {
    if (this.standaloneQueries.some(query => query.matches)) {
      return true;
    }

    // iOS Safari predates `display-mode` and reports standalone on navigator.
    return (this.window?.navigator as any)?.standalone === true;
  }

  /**
   * Shares the current page through the native share sheet, falling back to
   * copying the URL when the Web Share API is missing (most desktop browsers).
   */
  async shareCurrentPage(): Promise<void> {
    const url = this.window?.location?.href;
    if (!url) {
      return;
    }

    const navigator: any = this.window?.navigator;
    if (typeof navigator?.share === "function") {
      try {
        await navigator.share({title: this._document.title, url});
        return;
      } catch (error) {
        // Dismissing the share sheet is not a failure, and nothing else is
        // worth reporting either — copying the link still gets the job done.
        if ((error as DOMException)?.name === "AbortError") {
          return;
        }
      }
    }

    await this.copyToClipboard(url);
  }

  private async copyToClipboard(url: string): Promise<void> {
    try {
      await (this.window?.navigator as any)?.clipboard?.writeText(url);
      this.snackbar.success("Ссылка скопирована");
    } catch {
      this.snackbar.error("Не удалось поделиться ссылкой");
    }
  }
}
