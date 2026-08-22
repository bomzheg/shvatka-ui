import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {DOCUMENT} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";
import {Router, RouterLink, RouterLinkActive} from "@angular/router";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";
import {ActiveGame, GamesService} from "../games/games.service";
import {ThemeMode, ThemeService} from "../theme/theme.service";
import {PushService} from "../push/push.service";
import {NotificationsService} from "../notifications/notifications.service";
import {DebugLogService} from "../debug/debug-log.service";
import {GameRelease} from "../domain/game.models";
import {HttpAdapter} from "../http/http.adapter";
import {ShareService} from "../share/share.service";

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
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly AppIcon = AppIcon;
  private readonly window: (Window & typeof globalThis) | undefined;
  private readonly tg: any;
  private readonly tgWa: any;
  private countdownInterval: number | undefined;
  activeGame: ActiveGame | undefined;
  countdown: Countdown | undefined;
  /** Release of the active game, when its author wrote one. */
  release: GameRelease | undefined;
  isMobileMenuOpen = false;
  selectedThemeMode: ThemeMode = "system";

  constructor(
    @Inject(DOCUMENT) private _document: any,
    private authService: AuthService,
    private userService: UserService,
    private gamesService: GamesService,
    private router: Router,
    private themeService: ThemeService,
    private pushService: PushService,
    private notificationsService: NotificationsService,
    private debugLog: DebugLogService,
    private http: HttpAdapter,
    private shareService: ShareService,
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
    this.logDebugInfo("attempt: logout");
    this.pushService.onLogout()
      .catch(error => this.logDebugError("push onLogout before logout", error))
      .finally(() => {
        this.authService.logout().subscribe({
          next: () => {
            this.userService.clearUser();
            this.logDebugInfo("success: logout");
          },
          error: error => this.logDebugError("logout", error),
        });
      });
    this.closeMobileMenu();
  }

  onSearchSubmit(value: string, event: Event) {
    event.preventDefault();
    const query = value.trim();
    if (!query) {
      return;
    }

    this.closeMobileMenu();
    // By default the search runs everywhere; filters live on the results page.
    this.router.navigate(["/search"], {queryParams: {query}});
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

  canBeAuthor() {
    return this.userService.canBeAuthor();
  }

  /**
   * The share button only makes sense in an installed PWA: a browser tab
   * already has an address bar to copy the URL from.
   */
  canShare(): boolean {
    return this.shareService.isInstalledPwa();
  }

  share() {
    this.closeMobileMenu();
    this.shareService.shareCurrentPage()
      .catch(error => this.logDebugError("share current page", error));
  }

  unreadNotifications(): number {
    return this.notificationsService.unreadCount();
  }

  unreadNotificationsLabel(): string {
    const count = this.unreadNotifications();
    return count > 99 ? "99+" : String(count);
  }

  async ngOnInit() {
    this.selectedThemeMode = this.themeService.getMode();
    this.gamesService.getActiveGame().subscribe({
      next: game => {
        this.activeGame = game;
        this.countdown = this.getCountdown();
        this.setupCountdownTicker();
        this.loadRelease(game);
      },
      error: error => this.logDebugError("load active game", error),
    });


    if (this.tgWa?.initData) {
      this.logDebugInfo(`attempt: authenticate blocking webapp (initDataLength=${this.tgWa.initData.length})`);
      const telegramAuthResult = await this.authenticateTelegramWebApp(this.tgWa);
      if (telegramAuthResult) {
        try {
          await this.userService.loadMe();
          this.pushService.refresh();
          this.tgWa?.ready?.();
        } catch (error) {
          this.logDebugError("load me after telegram webapp auth", error);
        }
        return;
      }
    } else {
      this.logDebugInfo("skip: blocking webapp is missing initData");
    }

    try {
      await this.userService.loadMe();
    } catch (error) {
      this.logDebugError("load me", error);
    }
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

  isGamesTabActive(): boolean {
    const path = this.router.url.split(/[?#]/)[0].replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);

    if (segments[0] !== "games") {
      return false;
    }

    // /games (list) and /games/:id (game card) belong to "Прошедшие игры",
    // but /games/running and /games/constructor have their own tabs.
    return segments.length === 1 || (segments[1] !== "running" && segments[1] !== "constructor");
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

  activeGameBannerLabel(): string {
    if (this.isGettingWaiversStatus()) return "собирает вейверы";
    if (this.isFinishedStatus()) return "все команды финишировали";
    if (this.hasRunningGame()) return "идёт игра";
    return "ещё не началась";
  }

  /**
   * The release's banner, the only part that fits above the header, and the
   * only thing shown there — the whole release is on the main page, which the
   * banner links to.
   */
  bannerUrl(): string | undefined {
    return this.releaseUrlFor(this.release?.banner?.file_guid);
  }

  bannerAlt(): string {
    return this.activeGame ? `Релиз игры ${this.activeGame.name}` : "Релиз игры";
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      window.clearInterval(this.countdownInterval);
    }
  }

  /** A release is optional — a game without one just shows no banner. */
  private loadRelease(game: ActiveGame | undefined) {
    if (!game) {
      this.release = undefined;
      return;
    }

    this.gamesService.getRelease(game.id).subscribe({
      next: release => this.release = release,
      error: error => this.logDebugError("load game release", error),
    });
  }

  private releaseUrlFor(guid: string | undefined): string | undefined {
    if (!guid || !this.release) {
      return undefined;
    }

    return this.http.getFileUrl(this.release.game_id, guid);
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
    this.logDebugInfo(`attempt: authenticateWebApp ${this.stringifyForDebug(tgWa)}`);

    return new Promise<boolean>((resolve) => {
      this.authService.authenticateWebApp(tgWa)
        .subscribe({
          next: () => {
            this.logDebugInfo("success: authenticateWebApp");
            resolve(true);
          },
          error: (error) => {
            this.logDebugError("authenticateWebApp", error);
            resolve(false);
          },
        });
    });
  }

  private stringifyForDebug(payload: any): string {
    return "disabled debug"
  }

  private logDebugError(action: string, error: any) {
    this.debugLog.error(action, error);
  }

  private logDebugInfo(message: string) {
    this.debugLog.info(message);
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
