import {Injectable} from "@angular/core";
import {BehaviorSubject, EMPTY, Observable, catchError, switchMap, throwError} from "rxjs";
import {
  UploadOptions,
  UploadedFile,
  isHeicFile,
  isUnsupportedMediaError,
  unsupportedMediaMessage,
} from "./constructor.models";

/** The user's answer to the unsupported-format prompt. */
export type HeicChoice = "convert" | "keep" | "cancel";

/** State of the currently visible prompt (or `null` when nothing is pending). */
export interface HeicPrompt {
  /** User-facing explanation — either our local text or the server's 415 message. */
  message: string;
}

/** Message shown when a HEIC/HEIF file is detected client-side, before upload. */
const HEIC_DETECTED_MESSAGE =
  "Файл в формате HEIC/HEIF не поддерживается для просмотра в браузере и Telegram. " +
  "Его можно сконвертировать в JPEG или загрузить как есть (без предпросмотра).";

/**
 * Orchestrates uploading a file while transparently handling HEIC/HEIF images
 * the storage cannot render. Detection is best-effort client-side; the server
 * is the source of truth, so a 415 rejection is handled the same way.
 *
 * The service also owns the prompt state, rendered once by
 * {@link HeicUploadPromptComponent}, so the choice UI works from any upload
 * entry point (files panel, inline hint editor) without per-component markup.
 */
@Injectable({providedIn: "root"})
export class HeicUploadService {
  /** Currently visible prompt, or `null`. Consumed by the prompt component. */
  readonly prompt$ = new BehaviorSubject<HeicPrompt | null>(null);

  /** Resolves the in-flight `ask()` once the user clicks a button. */
  private resolver: ((choice: HeicChoice) => void) | null = null;

  /**
   * Upload `file`, prompting the user when it is an unsupported image.
   *
   * `uploadFn` performs the actual request for a given set of options; it is
   * re-invoked (with conversion flags) after the user chooses. The returned
   * observable emits the stored file on success, errors on a real failure, and
   * completes without emitting when the user cancels.
   */
  upload(
    file: File,
    uploadFn: (options?: UploadOptions) => Observable<UploadedFile>,
  ): Observable<UploadedFile> {
    // Detectable up front → ask before wasting a round-trip that would 415.
    if (isHeicFile(file)) {
      return this.ask(HEIC_DETECTED_MESSAGE).pipe(
        switchMap(choice => this.runChoice(choice, uploadFn)),
      );
    }
    // Otherwise trust the server: only prompt if it rejects the format.
    return uploadFn().pipe(
      catchError(err => {
        if (isUnsupportedMediaError(err)) {
          return this.ask(unsupportedMediaMessage(err)).pipe(
            switchMap(choice => this.runChoice(choice, uploadFn)),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  /** Called by the prompt component's buttons to answer the pending prompt. */
  choose(choice: HeicChoice): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.prompt$.next(null);
    resolver?.(choice);
  }

  private runChoice(
    choice: HeicChoice,
    uploadFn: (options?: UploadOptions) => Observable<UploadedFile>,
  ): Observable<UploadedFile> {
    switch (choice) {
      case "convert":
        return uploadFn({allowConversion: true});
      case "keep":
        return uploadFn({saveUnsupportedAsIs: true});
      default:
        return EMPTY;
    }
  }

  private ask(message: string): Observable<HeicChoice> {
    return new Observable<HeicChoice>(subscriber => {
      this.resolver = choice => {
        subscriber.next(choice);
        subscriber.complete();
      };
      this.prompt$.next({message});
      // If the caller unsubscribes before a choice is made, drop the prompt.
      return () => {
        if (this.resolver) {
          this.resolver = null;
          this.prompt$.next(null);
        }
      };
    });
  }
}
