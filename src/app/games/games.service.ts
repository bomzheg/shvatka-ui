import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {catchError, map, Observable, of, shareReplay} from "rxjs";
import {GameRelease} from "../domain/game.models";

export class Page<T> {
  constructor(public content: T[]) {
  }
}

export class Game {
  constructor(
    public id: number,
    public name: string,
    public number: number,
    public start_at: string | null = null,
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
    public start_at: string | null,
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

  /**
   * The game's release, or undefined when it has none.
   * Readable without auth: a release is promo.
   */
  getRelease(gameId: number): Observable<GameRelease | undefined> {
    return this.http.get<GameRelease | null>(`/games/${gameId}/release`).pipe(
      map(release => release ?? undefined),
      catchError(() => of(undefined)),
    );
  }

  getActiveGame(forceRefresh: boolean = false): Observable<ActiveGame | undefined> {
    if (forceRefresh) {
      this.activeGame$ = undefined;
    }

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
