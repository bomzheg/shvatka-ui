import {Inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";

const STORAGE_KEY = "debug-log";
const MAX_LINES = 40;

/**
 * Keeps a rolling, best-effort debug log in session storage so it can be
 * inspected after something goes wrong (e.g. on mobile / Telegram WebApp where
 * there is no devtools console).
 */
@Injectable({
  providedIn: "root",
})
export class DebugLogService {
  private readonly window: (Window & typeof globalThis) | undefined;

  constructor(@Inject(DOCUMENT) document: any) {
    this.window = document?.defaultView ?? undefined;
  }

  info(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[debug-info][${timestamp}] ${message}`;
    console.info(line);
    this.append(line);
  }

  /**
   * Logs an error together with meta info about what we were trying to do.
   */
  error(action: string, error: any): void {
    this.info(`error: ${action} ${this.describeError(error)}`);
  }

  private describeError(error: any): string {
    if (error == null) {
      return "(no error object)";
    }
    const status = typeof error?.status === "number" ? error.status : "unknown";
    const url = error?.url ? ` url=${this.extractPath(error.url)}` : "";
    const backend = error?.error;
    const description =
      (backend && typeof backend === "object"
        ? backend.description ?? backend.text ?? backend.type
        : undefined) ??
      error?.message ??
      String(error);
    return `status=${status}${url} message=${description}`;
  }

  private extractPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  private append(line: string): void {
    if (!this.window) {
      return;
    }
    try {
      const existing = this.window.sessionStorage.getItem(STORAGE_KEY);
      const currentLines = existing ? existing.split("\n").filter(Boolean) : [];
      currentLines.push(line);
      const tail = currentLines.slice(-MAX_LINES);
      this.window.sessionStorage.setItem(STORAGE_KEY, tail.join("\n"));
    } catch {
      // Storage may be unavailable (private mode, quota). Ignore — logging is best-effort.
    }
  }
}
