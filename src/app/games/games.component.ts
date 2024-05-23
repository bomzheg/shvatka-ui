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
  constructor(private gamesService: GamesService) {
    // @ts-ignore
    this.tg = this.window.Telegram.WebApp;
  }

  getGames(): Game[] {
    return this.gamesService.games!;
  }

  ngOnInit(): void {
        this.gamesService.loadGamesList();
        if (this.tg) {
          console.log(this.tg);
        }
    }

}
