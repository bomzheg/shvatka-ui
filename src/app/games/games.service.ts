import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {catchError, map, Observable, of, shareReplay} from "rxjs";

export class Page<T> {
  constructor(public content: T[]) {
  }
}

export class Game {
  constructor(
    public id: number,
    public name: string,
    public number: number,
  ) {
  }
}

export class GameAuthor {
  constructor(
    public id: number,
    public can_be_author: boolean,
    public name_mention: string,
  ) {
  }
}

export class ActiveGame {
  constructor(
    public id: number,
    public author: GameAuthor,
    public name: string,
    public status: string,
    public start_at: string,
    public number: number,
  ) {
  }
}

@Injectable({
  providedIn: 'root'
})
export class GamesService {
  get games(): Game[] | undefined {
    return this._games;
  }
  private _games: Game[] | undefined
  private activeGame$: Observable<ActiveGame | undefined> | undefined;

  constructor(private http: HttpAdapter) { }

  loadGamesList() {
    return this.http.get<Page<Game>>("/games").subscribe(r => {
      this._games = r.content;
    })
  }

  getActiveGame(): Observable<ActiveGame | undefined> {
    if (!this.activeGame$) {
      this.activeGame$ = this.http.get<ActiveGame>("/games/active").pipe(
        map(game => game?.id !== undefined ? game : undefined),
        catchError(() => of(undefined)),
        shareReplay(1),
      );
    }

    return this.activeGame$;
  }
}
