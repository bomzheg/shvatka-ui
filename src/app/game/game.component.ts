import {Component, OnInit} from '@angular/core';
import {GameService, HintPart} from "./game.service";
import {ActivatedRoute} from "@angular/router";
import {HttpAdapter} from "../http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    HintPartComponent
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit {
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
      if (hint.file_guid === undefined) {
        return undefined;
      }
      return this.http.getFileUrl(this.getGame().id, hint.file_guid)
    }
}
