import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {ShvatkaConfig} from "../app/app.config";

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  private username: string | undefined;
  private password: string | undefined;
  constructor(private http: HttpClient, private config: ShvatkaConfig) {
  }

  postWithoutCookies<T>(url: string, body: FormData): Observable<T> {
    let username = body.get("username")!!;
    let password = body.get("password")!!;
    if (typeof username !== "string" || typeof password !== "string") {
      throw new Error("Invalid username or password");
    }
    this.username = username;
    this.password = password;
    return new Observable<T>(o=> o.next());
  }

  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(
      this.config.apiUrl + url,
      body,
      this.getOptions(),
    );
  }

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(
      this.config.apiUrl + url,
      this.getOptions(),
    );
  }

  getFileUrl(gameId: number, fileId: string): string {
    return `${this.config.apiUrl}/games/${gameId}/files/${fileId}`
  }

  private getOptions() {
    return {headers: {Authorization: "Basic " + this.getBasicValue()}};
  }

  private getBasicValue(): string {
    return btoa(`${this.username}:${this.password}`);
  }
}
