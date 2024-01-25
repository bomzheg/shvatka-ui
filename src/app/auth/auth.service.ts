import {Injectable} from '@angular/core';
import {AuthComponent} from "./auth.component";
import {HttpAdapter} from "../http.adapter";

export class AuthResponse {
  access_token: string | undefined;
  token_type: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authComponent: AuthComponent | undefined;

  constructor(private http: HttpAdapter) {
  }

  async login(username: string, password: string) {
    this.postLoginForm(username, password)
      .subscribe(r => {
        localStorage.setItem("jwt", JSON.stringify(r));
        this.authComponent?.updateUser();
      } );
    this.authComponent?.closeLoginForm();
  }

  private postLoginForm(username: string, password: string) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    return this.http.post<AuthResponse>(
      '/auth/token',
      formData,
    )
  }

  registerCallback(authComponent: AuthComponent) {
    this.authComponent = authComponent;
  }

  showLoginForm() {
    this.authComponent?.openLoginForm();
  }

}
