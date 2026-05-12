import {Injectable} from "@angular/core";
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {Observable} from "rxjs";
import {AuthService} from "./auth.service";
import {AuthStateService} from "./auth-state.service";

export class UserData {
  id: number | undefined;
  name_mention: string | undefined;
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

  public clearUser() {
    this.me = undefined;
    this.authStateService.setUnauthenticated();
  }

  public changePassword(newPassword: string): Observable<void> {
    return this.http.put<void>("/users/me/password", JSON.stringify(newPassword));
  }
}
