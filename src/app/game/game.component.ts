import {Component, OnInit} from '@angular/core';
import {GameService} from "./game.service";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit {

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    ) {
  }
    ngOnInit(): void {
      this.gameService.loadGame(Number(this.route.snapshot.paramMap.get('id')));
    }

    getGame() {
      return this.gameService.getGame();
    }

}
