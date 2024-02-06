import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";

export class HintPart {
  constructor(
    public text: string,
  ) {
  }
}

export class TimeHint {
  constructor(
    public time: number,
    public hint: [HintPart],
  ) {
  }
}

export class Scenario {
  constructor(
    public id: string,
    public time_hints: [TimeHint],
    public keys: [string],
    public bonus_keys: [any],
  ) {
  }
}

export class Level {
  constructor(
    public db_id: number,
    public name_id: string,
    public author: any,
    public scenario: Scenario,
    public game_id: number | undefined,
    public number_in_game: number | undefined,
  ) {
  }
}

export class FullGame {
constructor(
  public id: number ,
  public author: any,
  public name: string,
  public status: string,
  public start_at: string | undefined,
  public levels: [Level],
) {}
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;

  constructor(private http: HttpAdapter) { }

  loadGame(id: number) {
    this.http.get<FullGame>(`/games/${id}`).subscribe(g => {
      this.game = g;
    })
  }

  getGame(): FullGame {
    return this.game!;
  }
}
