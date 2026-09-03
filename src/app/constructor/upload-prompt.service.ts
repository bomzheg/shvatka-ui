import {Injectable} from "@angular/core";
import {BehaviorSubject, EMPTY, Observable, catchError, switchMap, throwError} from "rxjs";
import {
  UploadOptions,
  UploadedFile,
  isHeicFile,
  isTelegramRejection,
  isUnsupportedMediaError,
  telegramRejectionMessage,
  unsupportedMediaMessage,
} from "./constructor.models";

/** The user's answer to an upload prompt. */
export type UploadChoice = "convert" | "keep" | "force" | "cancel";

/** What the server refused, which decides the buttons the prompt shows. */
export type UploadRefusal = "unsupported" | "telegram";

/** State of the currently visible prompt (or `null` when nothing is pending). */
export interface UploadPrompt {
  /** User-facing explanation — our local text, or the server's own message. */
  message: string;
  refusal: UploadRefusal;
}

/** Message shown when a HEIC/HEIF file is detected client-side, before upload. */
const HEIC_DETECTED_MESSAGE =
  "Файл в формате HEIC/HEIF не поддерживается для просмотра в браузере и Telegram. " +
  "Его можно сконвертировать в JPEG или загрузить как есть (в этом случае схватчики " +
  "будут получать ошибки при попытке посмотреть его).";

/**
 * Orchestrates uploading a file, asking the author what to do when the server
 * refuses it. Two refusals reach here:
 *
 * - an image the storage cannot render (HEIC/HEIF) — convert it, or keep the
 *   original. Detection is best-effort client-side; the server is the source of
 *   truth, so a 415 rejection is handled the same way.
 * - a file Telegram would not take. A hint reaches a team as a Telegram
 *   message, so such a file could never be shown; the upload is refused unless
 *   the author insists, which uploads it again with `force`.
 *
 * The service also owns the prompt state, rendered once by
 * {@link UploadPromptComponent}, so the choice UI works from any upload entry
 * point (files panel, inline hint editor) without per-component markup.
 */
@Injectable({providedIn: "root"})
export class UploadPromptService {
  /** Currently visible prompt, or `null`. Consumed by the prompt component. */
  readonly prompt$ = new BehaviorSubject<UploadPrompt | null>(null);

  /** Resolves the in-flight `ask()` once the user clicks a button. */
  private resolver: ((choice: UploadChoice) => void) | null = null;

  /**
   * Upload `file`, prompting the user when the server refuses it.
   *
   * `uploadFn` performs the actual request for a given set of options; it is
   * re-invoked (with conversion or force flags) after the user chooses. The
   * returned observable emits the stored file on success, errors on a real
   * failure, and completes without emitting when the user cancels.
   */
  upload(
    file: File,
    uploadFn: (options?: UploadOptions) => Observable<UploadedFile>,
  ): Observable<UploadedFile> {
    // Detectable up front → ask before wasting a round-trip that would 415.
    if (isHeicFile(file)) {
      return this.ask(HEIC_DETECTED_MESSAGE, "unsupported").pipe(
        switchMap(choice => this.runChoice(choice, uploadFn)),
      );
    }
    // Otherwise trust the server: only prompt if it refuses the file.
    return this.send(uploadFn);
  }

  /** Called by the prompt component's buttons to answer the pending prompt. */
  choose(choice: UploadChoice): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.prompt$.next(null);
    resolver?.(choice);
  }

  /** One attempt, with whatever prompt its refusal calls for. */
  private send(
    uploadFn: (options?: UploadOptions) => Observable<UploadedFile>,
    options?: UploadOptions,
  ): Observable<UploadedFile> {
    // an upload nobody chose anything for asks for nothing, not for undefined
    return (options === undefined ? uploadFn() : uploadFn(options)).pipe(
      catchError(err => {
        if (isUnsupportedMediaError(err)) {
          return this.ask(unsupportedMediaMessage(err), "unsupported").pipe(
            switchMap(choice => this.runChoice(choice, uploadFn)),
          );
        }
        if (isTelegramRejection(err)) {
          return this.ask(telegramRejectionMessage(err), "telegram").pipe(
            // keep what was already chosen (e.g. "store the HEIC as is"), and
            // add the force the author has just agreed to
            switchMap(choice => this.runChoice(choice, uploadFn, options)),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  private runChoice(
    choice: UploadChoice,
    uploadFn: (options?: UploadOptions) => Observable<UploadedFile>,
    options?: UploadOptions,
  ): Observable<UploadedFile> {
    switch (choice) {
      case "convert":
        return this.send(uploadFn, {...options, allowConversion: true});
      case "keep":
        return this.send(uploadFn, {...options, saveUnsupportedAsIs: true});
      case "force":
        // forced already: a second telegram prompt would just loop
        return uploadFn({...options, force: true});
      default:
        return EMPTY;
    }
  }

  private ask(message: string, refusal: UploadRefusal): Observable<UploadChoice> {
    return new Observable<UploadChoice>(subscriber => {
      const resolver = (choice: UploadChoice) => {
        subscriber.next(choice);
        subscriber.complete();
      };
      this.resolver = resolver;
      this.prompt$.next({message, refusal});
      // If the caller unsubscribes before a choice is made, drop the prompt.
      // Only ours: answering this prompt completes it, and the answer may have
      // opened the next one already (a kept HEIC telegram then refuses).
      return () => {
        if (this.resolver === resolver) {
          this.resolver = null;
          this.prompt$.next(null);
        }
      };
    });
  }
}
