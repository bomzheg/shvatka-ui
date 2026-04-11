import {Component, OnDestroy, OnInit} from '@angular/core';
import {GameService, GameStat, HintPart, KeyType, Keys, Level, FullGame} from "./game.service";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    HintPartComponent
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    private http: HttpAdapter,
  ) {
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params: ParamMap) => {
      const gameId = Number(params.get('id'));
      if (Number.isNaN(gameId)) {
        return;
      }

      this.gameService.loadGame(gameId);
    });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
  }

  getGame(): FullGame | undefined {
    return this.gameService.getGame();
  }

  getKeys(): Keys | undefined {
    return this.gameService.getKeys();
  }

  getStat(): GameStat | undefined {
    return this.gameService.getStat();
  }

  getLevels(): Level[] {
    return this.getGame()?.levels ?? [];
  }

  isLoading(): boolean {
    return this.gameService.isLoading();
  }

  hasLoadedData(): boolean {
    return this.gameService.hasLoadedCurrentGameData();
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined || this.getGame() === undefined) {
      return undefined;
    }

    return this.http.getFileUrl(this.getGame()!.id, hint.file_guid);
  }

  toLocal(dt: string): any {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  protected readonly KeyType = KeyType;
  protected readonly Object = Object;
}
