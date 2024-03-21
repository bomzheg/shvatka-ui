import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http.adapter";
import {UserService} from "./user.service";
import {ParamMap} from "@angular/router";

export class UserTgAuth {
  constructor(
    private id: string | null,
    private first_name: string | null,
    private auth_date: string | null,
    private hash: string | null,
    private photo_url: string | null,
    private username: string | null,
    private last_name: string | null,
) {}
  public static fromParams(m: ParamMap): UserTgAuth {
    return new UserTgAuth(
      m.get("id"),
      m.get("first_name"),
      m.get("auth_date"),
      m.get("hash"),
      m.get("photo_url"),
      m.get("username"),
      m.get("last_name"),
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthCallbackService {

  constructor(private http: HttpAdapter, private userService: UserService) {
  }

  public authenticate(user: UserTgAuth) {
    this.http.postWithoutCookies("/auth/login/data", user)
      .subscribe(
        () => {
          console.log(user)
          this.userService.loadMe()
        }
      );
  }
}
