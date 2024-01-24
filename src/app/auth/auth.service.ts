import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://nemesis.bomzheg.dev/shvatka_test/';

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    return this.http.post(`${this.apiUrl}/auth/token`, formData);
  }
}
