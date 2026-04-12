import {DOCUMENT} from "@angular/common";
import {Inject, Injectable, OnDestroy} from "@angular/core";

export type ThemeMode = "system" | "light" | "dark";
export const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

@Injectable({providedIn: "root"})
export class ThemeService implements OnDestroy {
  private readonly storageKey = "shvatka.theme.mode";
  private readonly mediaQuery: MediaQueryList | undefined;
  private readonly browserWindow: Window | null;
  private readonly tgWebApp: any;
  private currentMode: ThemeMode = "system";

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.browserWindow = this.document.defaultView;
    this.mediaQuery = this.browserWindow?.matchMedia?.("(prefers-color-scheme: dark)") ?? undefined;
    this.tgWebApp = (this.browserWindow as any)?.Telegram?.WebApp;

    this.currentMode = this.readMode();
    this.applyMode(this.currentMode);

    this.mediaQuery?.addEventListener("change", this.handleSystemThemeChange);
    this.tgWebApp?.onEvent?.("themeChanged", this.handleTelegramThemeChange);
  }

  ngOnDestroy(): void {
    this.mediaQuery?.removeEventListener("change", this.handleSystemThemeChange);
    this.tgWebApp?.offEvent?.("themeChanged", this.handleTelegramThemeChange);
  }

  getMode(): ThemeMode {
    return this.currentMode;
  }

  setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    this.browserWindow?.localStorage?.setItem(this.storageKey, mode);
    this.applyMode(mode);
  }

  private handleSystemThemeChange = () => {
    if (this.currentMode === "system") {
      this.applyMode(this.currentMode);
    }
  };

  private handleTelegramThemeChange = () => {
    if (this.currentMode === "system") {
      this.applyMode(this.currentMode);
    }
  };

  private readMode(): ThemeMode {
    const saved = this.browserWindow?.localStorage?.getItem(this.storageKey);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }

    return "system";
  }

  private applyMode(mode: ThemeMode): void {
    const resolvedTheme = this.resolveTheme(mode);
    const root = this.document.documentElement;

    root.dataset["theme"] = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    this.syncTelegramChrome(resolvedTheme);
  }

  private resolveTheme(mode: ThemeMode): "light" | "dark" {
    if (mode === "dark") {
      return "dark";
    }

    if (mode === "light") {
      return "light";
    }

    const tgScheme = this.tgWebApp?.colorScheme;
    if (tgScheme === "dark" || tgScheme === "light") {
      return tgScheme;
    }

    return this.mediaQuery?.matches ? "dark" : "light";
  }

  private syncTelegramChrome(resolvedTheme: "light" | "dark"): void {
    if (!this.tgWebApp) {
      return;
    }

    const backgroundColor = resolvedTheme === "dark" ? "#0b1220" : "#f1f6f3";
    const headerColor = resolvedTheme === "dark" ? "#123b24" : "#205d35";

    this.tgWebApp.setBackgroundColor(backgroundColor);
    this.tgWebApp.setHeaderColor(headerColor);
  }
}
