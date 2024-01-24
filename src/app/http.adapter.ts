import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {ShvatkaConfig} from "./app.config";
import {HttpClient} from "@angular/common/http";
import {AuthResponse} from "./auth/auth.service";

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  constructor(private http: HttpClient, private config: ShvatkaConfig) {
  }

  post<T>(url: string, body: any): Observable<T> {
    const jwt = this.getJwt();
    return this.http.post<T>(
      this.config.apiUrl + url,
      body,
    jwt === null? {} :{headers: {["Authorization"]: jwt.token_type + " " + jwt.access_token}}
    );
  }

  get<T>(url: string): Observable<T> {
    const jwt = this.getJwt();
    return this.http.get<T>(
      this.config.apiUrl + url,
      jwt === null? {} :{headers: {["Authorization"]: jwt.token_type + " " + jwt.access_token}}
    );
  }

  private getJwt(): AuthResponse | null {
    return JSON.parse(localStorage.getItem("jwt")!) as AuthResponse;
  }
}
