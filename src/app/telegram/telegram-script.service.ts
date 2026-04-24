import {DOCUMENT} from "@angular/common";
import {Inject, Injectable} from "@angular/core";

@Injectable({providedIn: "root"})
export class TelegramScriptService {
  private readonly webAppScriptUrl = "https://telegram.org/js/telegram-web-app.js";
  private readonly scriptLoads = new Map<string, Promise<boolean>>();

  constructor(@Inject(DOCUMENT) private document: Document) {}

  loadWebAppSdk(timeoutMs = 1500): Promise<boolean> {
    return this.loadScript(this.webAppScriptUrl, timeoutMs);
  }

  private loadScript(src: string, timeoutMs: number): Promise<boolean> {
    const browserWindow = this.document.defaultView as (Window & {Telegram?: any}) | null;
    if (browserWindow?.Telegram?.WebApp) {
      return Promise.resolve(true);
    }

    const existingPromise = this.scriptLoads.get(src);
    if (existingPromise) {
      return existingPromise;
    }

    const existingScript = this.document.querySelector(`script[src=\"${src}\"]`) as HTMLScriptElement | null;
    const script = existingScript ?? this.document.createElement("script");

    if (!existingScript) {
      script.src = src;
      script.async = true;
      script.defer = true;
      this.document.head.appendChild(script);
    }

    const loadPromise = new Promise<boolean>((resolve) => {
      if (browserWindow?.Telegram?.WebApp) {
        resolve(true);
        return;
      }

      let isFinished = false;
      const finalize = (value: boolean) => {
        if (isFinished) {
          return;
        }

        isFinished = true;
        window.clearTimeout(timeoutHandle);
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
        resolve(value);
      };

      const handleLoad = () => finalize(!!browserWindow?.Telegram?.WebApp);
      const handleError = () => finalize(false);
      const timeoutHandle = window.setTimeout(() => finalize(false), timeoutMs);

      script.addEventListener("load", handleLoad, {once: true});
      script.addEventListener("error", handleError, {once: true});
    });

    this.scriptLoads.set(src, loadPromise);
    return loadPromise;
  }
}
