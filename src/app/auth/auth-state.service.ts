import {Injectable} from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class AuthStateService {
  private authenticated: boolean | undefined = undefined;

  setAuthenticated() {
    this.authenticated = true;
  }

  setUnauthenticated() {
    this.authenticated = false;
  }

  reset() {
    this.authenticated = undefined;
  }

  isAuthenticated(): boolean {
    return this.authenticated === true;
  }

  isUnauthenticated(): boolean {
    return this.authenticated === false;
  }
}
