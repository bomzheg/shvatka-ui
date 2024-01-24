import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {AuthComponent} from "./auth.component";

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://nemesis.bomzheg.dev/shvatka_test/';
  private authComponent: AuthComponent | undefined;

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    return this.http.post(`${this.apiUrl}/auth/token`, formData);
  }

  registerCallback(authComponent: AuthComponent) {
    this.authComponent = authComponent;
  }

  showLoginForm() {
    this.authComponent?.openLoginForm();
  }

}
