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


  loginWithOneTimeToken(token: string) {
    return this.http.post<any>(
      '/auth/one-time-token',
      {token},
    );
  }

  registerWithEmail(username: string, email: string, password: string) {
    return this.http.postWithoutCookies<any>(
      '/auth/register/email',
      {username, email, password},
    );
  }

  loginWithEmail(email: string, password: string) {
    return this.http.postWithoutCookies<any>(
      '/auth/login/email',
      {email, password},
    );
  }

  confirmEmail(email: string, code: string) {
    return this.http.postWithoutCookies<any>(
      '/auth/email/confirm',
      {email, code},
    );
  }

  resendEmailCode(email: string) {
    return this.http.postWithoutCookies<any>(
      '/auth/email/resend',
      {email},
    );
  }

  linkEmail(email: string) {
    return this.http.post<any>(
      '/auth/email/link',
      {email},
    );
  }

  linkTelegram(tgUser: any) {
    return this.http.post<any>(
      '/auth/link/tg',
      tgUser,
    );
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

  showTgLinkForm() {
    this.authComponent?.openTgLinkForm();
  }

  logout() {
    return this.http.post<any>("/auth/logout", {});
  }
}
