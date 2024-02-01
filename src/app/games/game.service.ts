import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";

export class Game {

}

@Injectable({
  providedIn: 'root'
})
export class GameService {

  constructor(private http: HttpAdapter) { }

  getGamesList() {
    return this.http.get("/games")
  }
}
