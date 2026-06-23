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

/** A team as returned inside `GET /waivers/game/{id}` (WaiversDto.teams). */
export interface WaiversGameTeam {
  id: number;
  name: string;
}

/** A player who voted for a game, returned inside WaiversDto.waivers values. */
export interface VotedPlayer {
  id: number;
  can_be_author: boolean;
  name_mention: string;
  played?: string | null;
}

/** Response of `GET /waivers/game/{id}` (WaiversDto). */
export interface GameWaivers {
  teams: WaiversGameTeam[];
  waivers: Record<string, VotedPlayer[]>;
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
  private waivers$ = new Map<number, Observable<GameWaivers>>();

  constructor(private http: HttpAdapter) { }

  getGameWaivers(gameId: number): Observable<GameWaivers> {
    let cached = this.waivers$.get(gameId);
    if (!cached) {
      cached = this.http.get<GameWaivers>(`/waivers/game/${gameId}`).pipe(shareReplay(1));
      this.waivers$.set(gameId, cached);
    }
    return cached;
  }

  loadGamesList() {
    return this.http.get<Page<Game>>("/games").subscribe(r => {
      this._games = r.content;
    })
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
