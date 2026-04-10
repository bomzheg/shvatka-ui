import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {DOCUMENT, NgClass, NgOptimizedImage, NgStyle} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {MatIcon} from "@angular/material/icon";
import {ActiveGame, GamesService} from "../games/games.service";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgOptimizedImage,
    AuthComponent,
    NgClass,
    NgStyle,
    RouterLink,
    RouterLinkActive,
    MatIcon,
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  private window;
  private readonly tg;
  private readonly tgWa;
  private countdownInterval: number | undefined;
  activeGame: ActiveGame | undefined;
  startInMessage: string = "";

  constructor(
    @Inject(DOCUMENT) private _document: any,
    private authService: AuthService,
    private userService: UserService,
    private gamesService: GamesService,
  ) {
    this.window = this._document.defaultView;
    this.tg = this.window.Telegram;
    this.tgWa = this.tg.WebApp;
  }

  openLoginForm() {
    this.authService.showLoginForm();
  }


  logout() {
    this.authService.logout().subscribe(() => this.userService.clearUser())
  }

  getMe() {
    return this.userService.getMe();
  }

  isAuthenticated() {
    return this.userService.isUserLoaded();
  }

  async ngOnInit() {
    this.gamesService.getActiveGame().subscribe(game => {
      this.activeGame = game;
      this.startInMessage = this.getStartInMessage();
      this.setupCountdownTicker();
    });

    if (this.tgWa.initData) {
      console.debug("let's try to auth with webapp")
      this.authService.authenticateWebApp(this.tgWa)
        .subscribe({
          next: async () => {
            console.debug("success webapp auth, let's load profile")
            await this.userService.loadMe()
            this.tgWa.ready()
          },
          error: async (err) => {
            console.error("webapp auth error " + err.message);
            await this.userService.loadMe();
          },
        });
    } else {
      console.debug("no webapp auth data, so try to use cookies if exists")
      await this.userService.loadMe();
    }
  }

  hasActiveGame() {
    return this.activeGame !== undefined;
  }

  hasRunningGame() {
    return this.activeGame?.status === "running";
  }

  getBannerText() {
    if (!this.activeGame) {
      return "";
    }

    if (this.activeGame.status === "running") {
      return `Идёт игра: ${this.activeGame.name}`;
    }

    if (this.activeGame.status === "getting_waivers") {
      return `в настоящее время игра ${this.activeGame.name} собирает вейверы${this.startInMessage}`;
    }

    if (this.activeGame.status === "finished") {
      return "игра завершена, ждём публикацию результатов";
    }

    return this.startInMessage
      ? `игра ${this.activeGame.name} ещё не началась${this.startInMessage}`
      : `игра ${this.activeGame.name} ещё не началась`;
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

    if (!this.activeGame?.start_at || this.activeGame.status === "running" || this.activeGame.status === "finished") {
      return;
    }

    this.countdownInterval = window.setInterval(() => {
      this.startInMessage = this.getStartInMessage();
    }, 1000);
  }

  private getStartInMessage(): string {
    if (!this.activeGame?.start_at || this.activeGame.status === "running" || this.activeGame.status === "finished") {
      return "";
    }

    const startAtMs = Date.parse(this.activeGame.start_at);
    const diffMs = Math.max(startAtMs - Date.now(), 0);
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `, игра начнётся через ${days} дней ${hours} часов`;
    }

    if (hours > 0) {
      return `, игра начнётся через ${hours} часов ${minutes} минут`;
    }

    return `, игра начнётся через ${minutes} минут ${seconds} секунд`;
  }

}
