import {Injectable, signal} from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class AuthStateService {
  // Signal so that dependents (e.g. notifications polling) can react to
  // login/logout; undefined means "not known yet".
  private readonly authenticated = signal<boolean | undefined>(undefined);

  setAuthenticated() {
    this.authenticated.set(true);
  }

  setUnauthenticated() {
    this.authenticated.set(false);
  }

  reset() {
    this.authenticated.set(undefined);
  }

  isAuthenticated(): boolean {
    return this.authenticated() === true;
  }

  isUnauthenticated(): boolean {
    return this.authenticated() === false;
  }
}
