import {Injectable} from '@angular/core';
import {AuthComponent} from "./auth.component";
import {HttpAdapter} from "../http.adapter";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authComponent: AuthComponent | undefined;

  constructor(private http: HttpAdapter) {
  }

  login(username: string, password: string) {
    this.postLoginForm(username, password).subscribe(async unused => {
      this.authComponent?.closeLoginForm();
      await this.authComponent?.updateUser();
    });
  }

  private postLoginForm(username: string, password: string) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    return this.http.postWithoutCookies<any>(
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

  logout() {
    localStorage.removeItem("jwt");
  }
}
