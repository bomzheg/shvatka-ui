import {Component, OnInit} from '@angular/core';
import {GameService, GameStat, HintPart, KeyType, Level} from "./game.service";
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
  getKeys() {
    return this.gameService.getKeys();
  }
  getStat(): GameStat {
    return this.gameService.getStat();
  }
  getLevels(): Level[] {
    return this.gameService.getGame().levels;
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.getGame().id, hint.file_guid)
  }

  toLocal(dt: string): any {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  protected readonly KeyType = KeyType;
  protected readonly JSON = JSON;
  protected readonly Object = Object;
}
