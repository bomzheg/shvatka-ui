import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {DOCUMENT} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";
import {Router, RouterLink, RouterLinkActive} from "@angular/router";
import {MatIcon} from "@angular/material/icon";
import {ActiveGame, GamesService} from "../games/games.service";
import {THEME_MODES, ThemeMode, ThemeService} from "../theme/theme.service";

type CountdownUnit = "days" | "hours" | "minutes" | "seconds";

interface Countdown {
  firstValue: number;
  firstUnit: CountdownUnit;
  secondValue: number;
  secondUnit: CountdownUnit;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    AuthComponent,
    RouterLink,
    RouterLinkActive,
    MatIcon,
    FormsModule,
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly window: (Window & typeof globalThis) | undefined;
  private telegramSdkLoadPromise: Promise<void> | undefined;
  private readonly forceTelegramSdkLoad = false;
  private countdownInterval: number | undefined;
  activeGame: ActiveGame | undefined;
  countdown: Countdown | undefined;
  isMobileMenuOpen = false;
  readonly themeModes = THEME_MODES;
  selectedThemeMode: ThemeMode = "system";

  constructor(
    @Inject(DOCUMENT) private _document: any,
    private authService: AuthService,
    private userService: UserService,
    private gamesService: GamesService,
    private router: Router,
    private themeService: ThemeService,
  ) {
    this.window = this._document.defaultView;
  }

  openLoginForm() {
    this.authService.showLoginForm();
    this.closeMobileMenu();
  }

  logout() {
    this.authService.logout().subscribe(() => this.userService.clearUser());
    this.closeMobileMenu();
  }

  onNavClick(targetUrl: string, event: MouseEvent) {
    this.closeMobileMenu();

    const normalizedCurrent = this.router.url.split('?')[0].replace(/\/$/, '') || '/';
    const normalizedTarget = targetUrl.replace(/\/$/, '') || '/';

    if (normalizedCurrent === normalizedTarget) {
      event.preventDefault();
      window.location.reload();
    }
  }

  openMobileMenu() {
    this.isMobileMenuOpen = true;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  setThemeMode(mode: ThemeMode) {
    this.selectedThemeMode = mode;
    this.themeService.setMode(mode);
  }

  getThemeModeLabel(mode: ThemeMode): string {
    switch (mode) {
      case "system":
        return "Системная";
      case "light":
        return "Светлая";
      case "dark":
        return "Тёмная";
    }
  }

  getMe() {
    return this.userService.getMe();
  }

  isAuthenticated() {
    return this.userService.isUserLoaded();
  }

  async ngOnInit() {
    const telegramAuthResult = await this.tryTelegramAuthWithTimeout();
    if (telegramAuthResult) {
      await this.userService.loadMe();
      this.getTelegramWebApp()?.ready?.();
      return;
    }

    await this.userService.loadMe();
    this.selectedThemeMode = this.themeService.getMode();
    this.gamesService.getActiveGame().subscribe(game => {
      this.activeGame = game;
      this.countdown = this.getCountdown();
      this.setupCountdownTicker();
    });
  }

  private async tryTelegramAuthWithTimeout(): Promise<boolean> {
    const existingWebApp = this.getTelegramWebApp();
    if (existingWebApp?.initData) {
      this.logTelegramAuthDebug(`attempt: authenticate existing webapp (initDataLength=${existingWebApp.initData.length})`);
      return this.authenticateTelegramWebApp(existingWebApp);
    }

    try {
      await this.loadTelegramSDK();
      const tgWa = this.getTelegramWebApp();
      if (!tgWa?.initData) {
        this.logTelegramAuthDebug("skip: telegram sdk loaded but initData is empty");
        return false;
      }

      this.logTelegramAuthDebug(`attempt: authenticate webapp (initDataLength=${tgWa.initData.length})`);
      return this.authenticateTelegramWebApp(tgWa);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logTelegramAuthDebug(`failed: telegram sdk load error (${message})`);
      return false;
    }
  }

  private async loadTelegramSDK(timeoutMs = 2500): Promise<void> {
    if (!this.window) {
      return;
    }

    if (this.getTelegramWebApp()) {
      return;
    }

    if (this.telegramSdkLoadPromise) {
      return this.telegramSdkLoadPromise;
    }

    this.telegramSdkLoadPromise = new Promise<void>((resolve, reject) => {
      const src = "https://telegram.org/js/telegram-web-app.js";
      const existingScript = this._document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      const script = existingScript ?? this._document.createElement("script");
      let timeoutId: number | undefined;

      const cleanup = () => {
        if (timeoutId !== undefined) {
          this.window?.clearTimeout(timeoutId);
        }
        script.onload = null;
        script.onerror = null;
      };

      script.onload = () => {
        cleanup();
        resolve();
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Failed to load Telegram WebApp SDK"));
      };

      timeoutId = this.window?.setTimeout(() => {
        cleanup();
        reject(new Error("Telegram WebApp SDK load timeout"));
      }, timeoutMs);

      if (!existingScript) {
        script.src = src;
        script.async = true;
        this._document.head.appendChild(script);
      }
    }).catch((error: unknown) => {
      this.telegramSdkLoadPromise = undefined;
      throw error;
    });

    return this.telegramSdkLoadPromise;
  }

  private getTelegramWebApp() {
    return (this.window as any)?.Telegram?.WebApp;
  }


  hasActiveGame() {
    return this.activeGame !== undefined;
  }

  hasRunningGame() {
    if (!this.activeGame || this.isFinishedStatus()) {
      return false;
    }

    if (this.activeGame.status === "started") {
      return true;
    }

    return this.isStartTimeReached();
  }

  hasCurrentGameTab() {
    return this.hasRunningGame() || this.isGettingWaiversStatus();
  }

  isGettingWaiversStatus() {
    return this.activeGame?.status === "getting_waivers";
  }

  isFinishedStatus() {
    return this.activeGame?.status === "finished" || this.activeGame?.status === "complete";
  }

  isOtherPreStartStatus() {
    return !!this.activeGame && !this.hasRunningGame() && !this.isGettingWaiversStatus() && !this.isFinishedStatus();
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      window.clearInterval(this.countdownInterval);
    }
  }

  private setupCountdownTicker() {
    if (this.countdownInterval) {
      window.clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }

    if (!this.activeGame?.start_at || this.activeGame.status === "started" || this.isFinishedStatus()) {
      return;
    }

    if (this.isStartTimeReached()) {
      this.reloadOnceAfterCountdown();
      return;
    }

    this.countdownInterval = window.setInterval(() => {
      this.countdown = this.getCountdown();

      if (!this.countdown) {
        this.reloadOnceAfterCountdown();
      }
    }, 1000);
  }

  private isStartTimeReached(): boolean {
    if (!this.activeGame?.start_at) {
      return false;
    }

    return Date.parse(this.activeGame.start_at) <= Date.now();
  }

  private reloadOnceAfterCountdown() {
    if (!this.activeGame?.start_at || !this.window) {
      return;
    }

    const reloadKey = `active-game-reload:${this.activeGame.id}:${this.activeGame.start_at}`;
    if (this.window.sessionStorage.getItem(reloadKey) === "done") {
      return;
    }

    this.window.sessionStorage.setItem(reloadKey, "done");
    window.location.reload();
  }

  private getCountdown(): Countdown | undefined {
    if (!this.activeGame?.start_at || this.activeGame.status === "started" || this.isFinishedStatus()) {
      return undefined;
    }

    const startAtMs = Date.parse(this.activeGame.start_at);
    const diffMs = Math.max(startAtMs - Date.now(), 0);
    const totalSeconds = Math.floor(diffMs / 1000);

    if (totalSeconds <= 0) {
      return undefined;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return {
        firstValue: days,
        firstUnit: "days",
        secondValue: hours,
        secondUnit: "hours",
      };
    }

    if (hours > 0) {
      return {
        firstValue: hours,
        firstUnit: "hours",
        secondValue: minutes,
        secondUnit: "minutes",
      };
    }

    return {
      firstValue: minutes,
      firstUnit: "minutes",
      secondValue: seconds,
      secondUnit: "seconds",
    };
  }

  private authenticateTelegramWebApp(tgWa: any): Promise<boolean> {
    const payloadKeys = Object.keys(tgWa).join(",");
    this.logTelegramAuthDebug(`attempt: authenticateWebApp keys=[${payloadKeys}] body=${this.stringifyForDebug(tgWa)}`);

    return new Promise<boolean>((resolve) => {
      this.authService.authenticateWebApp(tgWa)
        .subscribe({
          next: () => {
            this.logTelegramAuthDebug("success: authenticateWebApp");
            resolve(true);
          },
          error: (error) => {
            const status = typeof error?.status === "number" ? error.status : "unknown";
            this.logTelegramAuthDebug(`failed: authenticateWebApp status=${status}`);
            resolve(false);
          },
        });
    });
  }

  private stringifyForDebug(payload: any): string {
    try {
      return JSON.stringify(payload);
    } catch {
      return "[unserializable]";
    }
  }

  private logTelegramAuthDebug(message: string) {
    const timestamp = new Date().toISOString();
    const line = `[tg-auth][${timestamp}] ${message}`;
    console.info(line);

    if (!this.window) {
      return;
    }

    const key = "tg-auth-debug-log";
    const existing = this.window.sessionStorage.getItem(key);
    const currentLines = existing ? existing.split("\n").filter(Boolean) : [];
    currentLines.push(line);
    const tail = currentLines.slice(-40);
    this.window.sessionStorage.setItem(key, tail.join("\n"));
  }

  countdownUnitLabel(unit: CountdownUnit): string {
    switch (unit) {
      case "days":
        return "дней";
      case "hours":
        return "часов";
      case "minutes":
        return "минут";
      case "seconds":
        return "секунд";
    }
  }
}
