import {Component, Inject, OnInit} from '@angular/core';
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
export class HeaderComponent implements OnInit {
  private window;
  private readonly tg;
  private readonly tgWa;
  activeGame: ActiveGame | undefined;

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
    this.gamesService.getActiveGame().subscribe(game => this.activeGame = game);

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

}
