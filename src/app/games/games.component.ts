import {Component, OnInit} from '@angular/core';
import {Game, GameService} from "./game.service";
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
  constructor(private gameService: GameService) {
  }

  getGames(): [Game] {
    return this.gameService.games!;
  }

  ngOnInit(): void {
        this.gameService.loadGamesList();
    }

}
