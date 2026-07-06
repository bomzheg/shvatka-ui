import {Injectable} from "@angular/core";
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {Observable} from "rxjs";
import {AuthService} from "./auth.service";
import {AuthStateService} from "./auth-state.service";

export class TgIdentity {
  tg_id: number | undefined;
  username: string | null | undefined;
  first_name: string | null | undefined;
  last_name: string | null | undefined;
}

export class ForumIdentity {
  name: string | undefined;
}

export class EmailIdentity {
  email: string | undefined;
  is_verified: boolean | undefined;
}

export class UserData {
  id: number | undefined;
  username: string | undefined;
  name_mention: string | undefined;
  can_be_author: boolean | undefined;
  tg: TgIdentity | null | undefined;
  forum: ForumIdentity | null | undefined;
  email: EmailIdentity | null | undefined;
  is_admin: boolean | undefined;
}

@Injectable({
  providedIn: "root",
})
export class UserService {
  private me: UserData | undefined;
  constructor(
    private http: HttpAdapter,
    private authService: AuthService,
    private authStateService: AuthStateService,
  ) {
  }
  public loadMe(){
    return new Promise<UserData | undefined>(resolve =>
      this.http.get<UserData>('/users/me')
        .subscribe({
          next: u => {
            this.me = u;
            this.authStateService.setAuthenticated();
            resolve(u)
          },
          error: err => {
            if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 404)) {
              console.log("no saved user credentials");
              this.me = undefined;
              this.authStateService.setUnauthenticated();
              this.authService.showLoginForm();
              resolve(undefined);
              return;
            }
            this.authStateService.reset();
            resolve(undefined);
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

  public canBeAuthor() {
    // Show author tools unless the backend explicitly says the user can't.
    return this.me !== undefined && this.me.can_be_author !== false;
  }

  public isAdmin() {
    // Rendering hint only — every /admin/* endpoint re-checks on the server.
    return this.me?.is_admin === true;
  }

  public clearUser() {
    this.me = undefined;
    this.authStateService.setUnauthenticated();
  }

  public changePassword(newPassword: string): Observable<void> {
    return this.http.put<void>("/users/me/password", JSON.stringify(newPassword));
  }

  public changeUsername(newUsername: string): Observable<void> {
    return this.http.put<void>("/users/me/username", JSON.stringify({username: newUsername}));
  }
}
