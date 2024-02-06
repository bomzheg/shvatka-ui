import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";

export class FullGame {
constructor(
  public id: number ,
  public author: any,
  public name: string,
  public status: string,
  public start_at: string | undefined,
  public levels: [any],
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
