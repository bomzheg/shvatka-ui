import {Component, Inject, OnInit} from '@angular/core';
import {Game, GamesService} from "./games.service";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {DOCUMENT} from "@angular/common";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './games.component.html',
  styleUrl: './games.component.scss'
})
export class GamesComponent implements OnInit {
  private window;
  private readonly tg;
  private readonly tgWa;
  constructor(
    private gamesService: GamesService,
    @Inject(DOCUMENT) private _document: any,
    private authService: AuthService,
    private userService: UserService,
    ) {
    this.window = this._document.defaultView;
    this.tg = this.window.Telegram;
    this.tgWa = this.tg.WebApp;
  }

  getGames(): Game[] {
    return this.gamesService.games!;
  }


  async updateUser() {
    await this.userService.loadMe()
  }

  ngOnInit(): void {
        this.gamesService.loadGamesList();
        if (this.tgWa.initData) {
          this.authService.authenticateWebApp(this.tgWa.initData)
            .subscribe({
              next: () => {this.updateUser()},
              error: (err) => {
                console.error("webapp auth error " + err.message);
              },
            });
        }
    }

}
