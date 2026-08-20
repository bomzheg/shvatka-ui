import {Directive, ElementRef, HostListener, Input} from "@angular/core";
import {SnackbarService} from "../snackbar/snackbar.service";
import {DebugLogService} from "../debug/debug-log.service";

/**
 * Reports media load failures that happen outside Angular's HttpClient.
 *
 * `<img>`, `<video>`, `<audio>` and `<source>` elements fetch their `src`
 * directly, so a failure fires a DOM `error` event that never reaches the
 * global `ErrorHandler`. Without this, broken media is silent: no snackbar and
 * nothing in the debug log. Attach `[appMediaError]` to surface those errors
 * the same way HTTP errors are surfaced.
 */
@Directive({
  selector: "[appMediaError]",
  standalone: true,
})
export class MediaErrorDirective {
  /** Human-readable name of the media, e.g. "фото" or "видео". */
  @Input("appMediaError") label = "";

  /** Last src we reported, to avoid duplicate snackbars for the same resource. */
  private lastReportedSrc: string | null = null;

  constructor(
    private el: ElementRef<HTMLElement>,
    private snackbar: SnackbarService,
    private debugLog: DebugLogService,
  ) {}

  @HostListener("error")
  onError(): void {
    const src = this.currentSrc();
    if (src && src === this.lastReportedSrc) {
      return;
    }
    this.lastReportedSrc = src;

    const label = this.label.trim() || "медиа";
    this.debugLog.error("load media", {
      url: src ?? undefined,
      message: `failed to load ${label}`,
    });
    this.snackbar.error(`Не удалось загрузить ${label}`, "Закрыть");
  }

  private currentSrc(): string | null {
    const el = this.el.nativeElement as HTMLMediaElement &
      HTMLImageElement &
      HTMLSourceElement;
    return el.currentSrc || el.src || el.getAttribute("src");
  }
}
