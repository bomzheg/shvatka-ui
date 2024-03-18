import {Component, OnInit} from '@angular/core';
import {GameService, HintPart, HintType} from "./game.service";
import {ActivatedRoute} from "@angular/router";
import {HttpAdapter} from "../http.adapter";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit {
  protected readonly HintType = HintType;
  protected readonly JSON = JSON;
  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    private http: HttpAdapter,
    ) {
  }
    ngOnInit(): void {
      this.gameService.loadGame(Number(this.route.snapshot.paramMap.get('id')));
    }

    getGame() {
      return this.gameService.getGame();
    }

    getFileUrl(hint: HintPart) {
      return this.http.getFileUrl(this.getGame().id, hint.file_guid!)
    }
}
