import {Component, OnInit} from '@angular/core';
import {Game, GamesService} from "./games.service";
import {RouterLink, RouterLinkActive} from "@angular/router";

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
  private readonly tg;
  private readonly tgWa;
  constructor(private gamesService: GamesService) {
    // @ts-ignore
    this.tg = this.window.Telegram;
    console.log("this telegram is " + this.tg);
    if (this.tg !== undefined) {
      console.log("and webapp is " + this.tg.WebApp);
      this.tgWa = this.tg.WebApp;
    }
  }

  getGames(): Game[] {
    return this.gamesService.games!;
  }

  ngOnInit(): void {
        this.gamesService.loadGamesList();
        if (this.tgWa) {
          console.log("on init tgwa is " + this.tgWa);
        }
    }

}
