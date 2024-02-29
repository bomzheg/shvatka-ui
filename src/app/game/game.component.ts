import {Component, OnInit} from '@angular/core';
import {GameService, HintType} from "./game.service";
import {ActivatedRoute} from "@angular/router";
import {environment} from "../../environments/environment";

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

  protected readonly HintType = HintType;
  protected readonly environment = environment;
  protected readonly JSON = JSON;
}
