import {Injectable} from "@angular/core";
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";

export class UserData {
  db_id: number | undefined;
  tg_id: number | undefined;
  username: string | undefined;
  first_name: string | undefined;
  last_name: string | undefined;
}

@Injectable({
  providedIn: "root",
})
export class UserService {
  private me: UserData | undefined;
  constructor(private http: HttpAdapter) {
  }
  public loadMe(){
    return new Promise<UserData>(resolve =>
      this.http.get<UserData>('/users/me')
        .subscribe({
          next: u => {this.me = u; resolve(u)},
          error: err => {
            if (err instanceof HttpErrorResponse && err.status === 401) {
              console.log("no saved user credentials")
            }
          }
        })
    );
  }

  public getMe() {
    return this.me
  }

  public isUserLoaded() {
    return this.me !== undefined;
  }

  public clearUser() {
    this.me = undefined;
  }
}
