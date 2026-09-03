import {ErrorHandler, Injectable, NgZone} from "@angular/core";
import {HttpErrorResponse} from "@angular/common/http";
import {AuthService} from "../auth/auth.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {DebugLogService} from "../debug/debug-log.service";
import {readApiError} from "./api-error";

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {
  private readonly knownErrorTranslations: Record<string, string> = {
    InvalidKey: "Неверный ключ",
    RequestNotPending: "Этот запрос уже обработан",
    RequestPermissionError: "Недостаточно прав, чтобы ответить на этот запрос",
    RequestNotFound: "Запрос не найден",
    PlayerAlreadyInTeam: "Игрок уже состоит в команде",
    PermissionsError: "Недостаточно прав",
    FileIsUsed: "Файл используется",
    FileNotFound: "Файл не найден",
    CantEditGame: "Нельзя изменить игру",
    GameHasAnotherAuthor: "Игра принадлежит другому автору",
    FileRejectedByTelegram: "Telegram не принял файл",
    GameWouldBeRewritten: "Импорт перезапишет существующую игру",
    FilesCantBeSentToTg: "Telegram не принял файлы игры",
    ScenarioNotCorrect: "Сценарий некорректен",
  };
  constructor(
    private snackbar: SnackbarService,
    private _zone: NgZone,
    private authService: AuthService,
    private debugLog: DebugLogService,
  ) { }

  handleError(error: any): void {
    this.logToDebug(error);
    this._zone.run(() => {
      if (!(error instanceof HttpErrorResponse)) {
        console.error(error);
        const name = error?.name || error?.constructor?.name || 'Error';
        const text = error?.message || String(error);
        this.snackbar.error(`${name}: ${text}`, 'Закрыть');
        return
      }
      if (error.status === 401) {
        console.log("401 response: " + JSON.stringify(error));
        this.snackbar.error("Для выполнения этой операции необходимо залогиниться", 'Закрыть', 3000);
        this.authService.showLoginForm();
      } else {
        console.error(error);
        const backendError = readApiError(error);
        if (backendError) {
          const type = backendError.type || "UnknownError";
          const typeText = this.knownErrorTranslations[type] ?? type;
          const parts = [typeText, backendError.text, backendError.description]
            .filter(v => v.length > 0)
            .join(": ");
          const message = `[${error.status}] ${parts || "Ошибка запроса"}`;
          this.snackbar.errorWithDoc(message, backendError.docUrl);
          return;
        }

        this.snackbar.error(
          this.formatUnknownHttpError(error),
          'Закрыть',
        );
      }
    });
  }

  private logToDebug(error: any): void {
    try {
      if (error instanceof HttpErrorResponse) {
        const method = (error as any)?.method;
        const action = `http request${method ? ` ${method}` : ""}`;
        this.debugLog.error(action, error);
      } else {
        const name = error?.name || error?.constructor?.name || "Error";
        this.debugLog.error(`uncaught ${name}`, error);
      }
    } catch {
      // Never let debug logging break the real error handling.
    }
  }

  private formatUnknownHttpError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return `Ошибка сети: сервер недоступен (${this.extractPath(error.url)})`;
    }
    const statusText = error.statusText || 'Unknown Error';
    return `[${error.status}] ${statusText} (${this.extractPath(error.url)})`;
  }

  private extractPath(url: string | null): string {
    if (!url) return '';
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
}
