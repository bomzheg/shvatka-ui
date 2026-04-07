import {Component, OnInit} from '@angular/core';
import {GamePlayService, CurrentHints} from "./game_play.service";
import {ActivatedRoute} from "@angular/router";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HintPart} from "../game/game.service";

@Component({
  selector: 'app-game-play',
  standalone: true,
  imports: [
    HintPartComponent
  ],
  templateUrl: './game_play.component.html',
  styleUrl: './game_play.component.scss'
})
export class GamePlayComponent implements OnInit {
  constructor(
    private gameService: GamePlayService,
    private route: ActivatedRoute,
    private http: HttpAdapter,
    ) {
  }
  ngOnInit(): void {
    this.gameService.loadHints();
  }

  getCurrentHints(): CurrentHints {
    return this.gameService.getCurrentHints()
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.getCurrentHints().game_id, hint.file_guid)
  }

  toLocal(dt: string): any {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  protected readonly Object = Object;
}
