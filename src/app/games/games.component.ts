import {Component, Inject, OnInit} from '@angular/core';
import {Game, GamesService} from "./games.service";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {DOCUMENT} from "@angular/common";

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
    ) {
    this.window = this._document.defaultView;
    // @ts-ignore
    this.tg = this.window.Telegram;
    console.log("this telegram is " + JSON.stringify(this.tg));
    if (this.tg !== undefined) {
      console.log("and webapp is " + JSON.stringify(this.tg.WebApp));
      this.tgWa = this.tg.WebApp;
    }
  }

  getGames(): Game[] {
    return this.gamesService.games!;
  }

  ngOnInit(): void {
        this.gamesService.loadGamesList();
        if (this.tgWa) {
          console.log("on init tgwa is " + JSON.stringify(this.tgWa));
        }
    }

}
