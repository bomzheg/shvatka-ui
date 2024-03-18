import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {UserData} from "../app/auth/user.service";
import {Game, Page} from "../app/games/games.service";
import {FullGame, HintPart, HintType, Level, Scenario, TimeHint} from "../app/game/game.service";

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  private authorized: boolean = false;
  private readonly user: UserData;
  private readonly games: Page<Game>;
  private readonly first_game: FullGame;
  constructor() {
    this.user = new UserData();
    this.user.username = "admin"
    this.games = new Page<Game>(
      [
        new Game(1, "Название игры", 1),
        new Game(2, "Весёлая игра", 2),
        new Game(3, "Ещё какая-то", 3),
        new Game(4, "Some English name", 4),
      ]
    );
    this.first_game = new FullGame(
      1,
      "admin",
      "Название игры",
      "complete",
      "2022-05-12T23:00:00",
      [new Level(
        5,
        "foo",
        "admin",
        new Scenario(
          "foo",
          [
            new TimeHint(
              0, [
                HintPart.create({type: HintType.text, text: "puzzle time"}),
              ]
            ),
            new TimeHint(
              5, [
                HintPart.create({type: HintType.text, text: "some hint"}),
                HintPart.create({type: HintType.photo, file_guid: "be9b08d4-1775-476b-87b6-e2219b9ecb01"}),
              ]
            ),
            new TimeHint(
              10, [
                HintPart.create({type: HintType.text, text: "SH123"}),
              ]
            ),
          ],
          ["SH123"],
          []
        ),
        1,
        0
      )]
    )
  }

  postWithoutCookies<T>(url: string, body: any): Observable<T> {
    switch (url) {
      case "/auth/token":
        body = body as FormData;
        let username = body.get("username");
        let password = body.get("password");
        if (username === "admin" && password === "admin") {
          this.authorized = true;
          return new Observable<T>(o=> o.next());
        } else {
          return new Observable<T>(() => {throw new Error("403")});
        }
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  post<T>(url: string, body: any): Observable<T> {
    switch (url) {
      case "/auth/logout":
        this.authorized = false;
        return new Observable<T>(o=> o.next());
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  get<T>(url: string): Observable<T> {
    switch (url) {
      case "/users/me":
        if (this.authorized) {
          return new Observable<T>(o => o.next(this.user as T))
        }
        return new Observable<T>( () => {throw new Error("401")});
      case "/games":
        return new Observable<T>(o=> o.next(this.games as T));
      case "/games/1":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/2":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/3":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      case "/games/4":
        if (!this.authorized) {
          return new Observable<T>(() => {throw new Error("401")})
        }
        return new Observable<T>(o=> o.next(this.first_game as T));
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }


  getWithQuery<T>(
    url: string,
    query: any
  ): Observable<T> {

    switch (url) {
      case "/auth/login/data":
        return new Observable<T>(() => {throw new Error("Not implemented")});
      default:
        return new Observable<T>(() => {throw new Error("Not implemented")});
    }
  }

  getFileUrl(gameId: number, fileId: string): string {
    return `/assets/scenario/${fileId}`;
  }
}
