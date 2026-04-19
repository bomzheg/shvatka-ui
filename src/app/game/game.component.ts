import {Component, OnDestroy, OnInit} from '@angular/core';
import {GameService} from "./game.service";
import {FullGame, GameStat, Keys, Level} from "../domain/game.models";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {Subscription} from "rxjs";
import {GameLogPartComponent} from "../game_log.part/game_log.part.component";
import {GameScenarioPartComponent} from "../game_scenario.part/game_scenario.part.component";

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [
    GameLogPartComponent,
    GameScenarioPartComponent,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
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

}