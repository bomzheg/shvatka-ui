import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TimeHint} from "../game/game.service";
import {Observable, tap} from "rxjs";

export class CurrentHints {
  constructor(
    public hints: TimeHint[],
    public typed_keys: any[],
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

@Injectable({
  providedIn: 'root'
})
export class GamePlayService {
  private currentHints: CurrentHints | undefined;
  private isHintsLoading = false;
  private authRequired = false;

  constructor(private http: HttpAdapter, private snackBar: MatSnackBar) { }

  loadHints() {
    this.isHintsLoading = true;
    this.authRequired = false;
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

  getCurrentHints(): CurrentHints | undefined {
    return this.currentHints;
  }

  hintsLoading(): boolean {
    return this.isHintsLoading;
  }

  isAuthRequired(): boolean {
    return this.authRequired;
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
