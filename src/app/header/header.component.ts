import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {DOCUMENT, NgClass, NgStyle} from "@angular/common";
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
    NgClass,
    NgStyle,
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
  private readonly tg: any;
  private readonly tgWa: any;
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
    this.tg = (this.window as any)?.Telegram;
    this.tgWa = this.tg?.WebApp;
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
    this.selectedThemeMode = this.themeService.getMode();
    this.gamesService.getActiveGame().subscribe(game => {
      this.activeGame = game;
      this.countdown = this.getCountdown();
      this.setupCountdownTicker();
    });

    if (this.tgWa?.initData) {
      this.logTelegramAuthDebug(`attempt: authenticate blocking webapp (initDataLength=${this.tgWa.initData.length})`);
      const telegramAuthResult = await this.authenticateTelegramWebApp(this.tgWa);
      if (telegramAuthResult) {
        await this.userService.loadMe();
        this.tgWa?.ready?.();
        return;
      }
    } else {
      this.logTelegramAuthDebug("skip: blocking webapp is missing initData");
    }

    await this.userService.loadMe();
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
    const payload = this.buildTelegramWebAppPayload(tgWa);
    const payloadKeys = Object.keys(payload).join(",");
    this.logTelegramAuthDebug(`attempt: authenticateWebApp keys=[${payloadKeys}] body=${this.stringifyForDebug(payload)}`);

    return new Promise<boolean>((resolve) => {
      this.authService.authenticateWebApp(payload)
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

  private buildTelegramWebAppPayload(tgWa: any): any {
    const resolvedInitData = this.resolveTelegramInitData(tgWa);
    return {
      initData: resolvedInitData,
      initDataRaw: tgWa?.initData,
      initDataUnsafe: tgWa?.initDataUnsafe,
      version: tgWa?.version,
      platform: tgWa?.platform,
      ...tgWa?.initDataUnsafe,
    };
  }

  private resolveTelegramInitData(tgWa: any): string {
    const rawInitData = typeof tgWa?.initData === "string" ? tgWa.initData : "";
    if (rawInitData.length > 16) {
      return rawInitData;
    }

    const search = this.window?.location?.search ?? "";
    const hash = this.window?.location?.hash ?? "";
    const searchParams = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

    const fromSearch = searchParams.get("tgWebAppData");
    const fromHash = hashParams.get("tgWebAppData");
    const candidate = fromSearch || fromHash;
    if (candidate) {
      const reconstructed = this.reconstructTelegramInitData(searchParams, hashParams, candidate);
      this.logTelegramAuthDebug(`info: using tgWebAppData from url (rawLength=${candidate.length}, reconstructedLength=${reconstructed.length})`);
      return reconstructed;
    }

    return rawInitData;
  }

  private reconstructTelegramInitData(searchParams: URLSearchParams, hashParams: URLSearchParams, base: string): string {
    const merged = new URLSearchParams();
    const baseParams = new URLSearchParams(base);

    baseParams.forEach((value, key) => merged.set(key, value));

    const knownKeys = [
      "query_id",
      "user",
      "receiver",
      "chat",
      "chat_type",
      "chat_instance",
      "start_param",
      "can_send_after",
      "auth_date",
      "signature",
      "hash",
    ];

    const mergedFrom = [searchParams, hashParams];
    for (const key of knownKeys) {
      const existing = merged.get(key);
      if (existing) {
        continue;
      }

      for (const source of mergedFrom) {
        const value = source.get(key);
        if (value) {
          merged.set(key, value);
          break;
        }
      }
    }

    const keysSet = new Set<string>();
    merged.forEach((_, key) => keysSet.add(key));
    const keys = Array.from(keysSet).sort();
    this.logTelegramAuthDebug(`info: reconstructed initData keys=[${keys.join(",")}]`);
    return merged.toString();
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
