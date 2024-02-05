import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";

export class Page<T> {
  constructor(public content: [T]) {
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

@Injectable({
  providedIn: 'root'
})
export class GamesService {
  get games(): [Game] | undefined {
    return this._games;
  }
  private _games: [Game] | undefined

  constructor(private http: HttpAdapter) { }

  loadGamesList() {
    return this.http.get<Page<Game>>("/games").subscribe(async r => {
      this._games = r.content;
    })
  }
}
