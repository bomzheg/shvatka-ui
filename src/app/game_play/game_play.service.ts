import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";
import {KeyTime, TimeHint} from "../domain/game.models";
import {Observable, tap} from "rxjs";
import {ActiveGame, GamesService} from "../games/games.service";

export type TypedKeyLog = KeyTime & {
  effects?: KeyEffect[];
};

export class CurrentHints {
  constructor(
    public hints: TimeHint[],
    public typed_keys: TypedKeyLog[],
    public level_number: number,
    public started_at: string,
    public game_id: number,
  ) {
  }
}

export class KeyEffect {
  constructor(
    public id: string,
    public hints_: any[],
    public bonus_minutes: number,
    public level_up: boolean,
    public next_level: string,
  ) {
  }
}

export class TypedKeyResult {
  constructor(
    public text: string,
    public is_duplicate: boolean,
    public wrong: boolean,
    public at: string,
    public effects: KeyEffect[],
    public game_finished: boolean,
  ) {
  }
}

export class WaiversTeam {
  constructor(
    public id: number,
    public name: string,
  ) {
  }
}

export class WaiverPlayer {
  constructor(
    public id: number,
    public can_be_author: boolean,
    public name_mention: string,
  ) {
  }
}

export class WaiverEntry {
  constructor(
    public player: WaiverPlayer,
  ) {
  }
}

export class CurrentWaivers {
  constructor(
    public teams: WaiversTeam[],
    public waivers: Record<string, WaiverEntry[]>,
  ) {
  }
}

@Injectable({
  providedIn: 'root'
})
export class GamePlayService {
  private currentHints: CurrentHints | undefined;
  private currentWaivers: CurrentWaivers | undefined;
  private isHintsLoading = false;
  private authRequired = false;

  constructor(
    private http: HttpAdapter,
    private snackBar: MatSnackBar,
    private gamesService: GamesService,
  ) {
  }

  loadHints() {
    this.isHintsLoading = true;
    this.authRequired = false;
    this.gamesService.getActiveGame(true).subscribe(game => {
      if (!game) {
        this.currentHints = undefined;
        this.currentWaivers = undefined;
        this.isHintsLoading = false;
        return;
      }

      if (game.status === "getting_waivers") {
        this.loadWaivers();
        return;
      }

      this.loadRunningHints();
    });
  }

  private loadRunningHints() {
    this.currentWaivers = undefined;
    this.http.get<CurrentHints>(`/games/running/level/current/hints`)
    .subscribe({
      next: h => {
        this.currentHints = h;
        this.isHintsLoading = false;
      },
      error: error => {
        this.isHintsLoading = false;
        this.currentHints = undefined;

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.authRequired = true;
          console.log("current hint 401 response: " + JSON.stringify(error));
          this.snackBar.open("Играть можно только авторизованным пользователям в составе команд", 'Закрыть', {duration: 3000});
        } else {
          throw error;
        }
      }
    })
  }

  private loadWaivers() {
    this.currentHints = undefined;
    this.http.get<CurrentWaivers>(`/waivers/game/current`)
      .subscribe({
        next: waivers => {
          this.currentWaivers = waivers;
          this.isHintsLoading = false;
        },
        error: error => {
          this.isHintsLoading = false;
          this.currentWaivers = undefined;

          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.authRequired = true;
            this.snackBar.open("Просмотр вейверов доступен только авторизованным пользователям", 'Закрыть', {duration: 3000});
          } else {
            throw error;
          }
        }
      });
  }

  getCurrentHints(): CurrentHints | undefined {
    return this.currentHints;
  }

  getCurrentWaivers(): CurrentWaivers | undefined {
    return this.currentWaivers;
  }

  hintsLoading(): boolean {
    return this.isHintsLoading;
  }

  isAuthRequired(): boolean {
    return this.authRequired;
  }

  getActiveGame(forceRefresh: boolean = false): Observable<ActiveGame | undefined> {
    return this.gamesService.getActiveGame(forceRefresh);
  }

  submitKey(text: string): Observable<TypedKeyResult> {
    return this.http.post<TypedKeyResult>(`/games/running/key`, {text}).pipe(
      tap(result => {
        if (result.effects?.some(effect => effect.level_up)) {
          this.snackBar.open("Уровень пройден! Загружаем следующий уровень.", 'Закрыть', {duration: 3000});
          this.loadHints();
        }
      }),
    );
  }
}
