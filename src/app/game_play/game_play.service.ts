import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";
import {TimeHint} from "../game/game.service";

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

@Injectable({
  providedIn: 'root'
})
export class GamePlayService {
  private currentHints: CurrentHints | undefined;

  constructor(private http: HttpAdapter, private snackBar: MatSnackBar) { }

  loadHints() {
    this.http.get<CurrentHints>(`/games/running/level/current/hints`)
      .subscribe({
        next: h => {
          this.currentHints = h;
        },
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            console.log("current hint 401 response: " + JSON.stringify(error));
            this.snackBar.open("Играть можно только авторизованным пользователям в составе команд", 'Закрыть', {duration: 3000});
          } else {
            throw error;
          }
        }
      })
  }

  getCurrentHints(): CurrentHints {
    return this.currentHints!;
  }
}
