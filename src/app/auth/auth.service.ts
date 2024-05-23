import {Injectable} from '@angular/core';
import {AuthComponent} from "./auth.component";
import {HttpAdapter} from "../http/http.adapter";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authComponent: AuthComponent | undefined;

  constructor(private http: HttpAdapter) {
  }

  login(username: string, password: string) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    return this.http.postWithoutCookies<any>(
      '/auth/token',
      formData,
    )
  }

  public authenticate(user: any) {
    return this.http.postWithoutCookies("/auth/login/data", user)
  }

  public authenticateWebApp(webAppData: any) {
    return this.http.postWithoutCookies("/auth/login/webapp", webAppData);
  }

  registerCallback(authComponent: AuthComponent) {
    this.authComponent = authComponent;
  }

  showLoginForm() {
    this.authComponent?.openLoginForm();
  }

  logout() {
    return this.http.post<any>("/auth/logout", {});
  }
}
