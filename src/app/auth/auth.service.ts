import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {AuthComponent} from "./auth.component";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://nemesis.bomzheg.dev/shvatka_test';
  private authComponent: AuthComponent | undefined;

  constructor(private http: HttpClient) { }

  async login(username: string, password: string) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    console.log(formData)
    await this.http.post(`${this.apiUrl}/auth/token`, formData)
      .forEach(r => console.log(r));
  }

  registerCallback(authComponent: AuthComponent) {
    this.authComponent = authComponent;
  }

  showLoginForm() {
    this.authComponent?.openLoginForm();
  }

}
