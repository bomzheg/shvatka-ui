import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {ShvatkaConfig} from "./app.config";
import {HttpClient, HttpParams} from "@angular/common/http";

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  constructor(private http: HttpClient, private config: ShvatkaConfig) {
  }

  postWithoutCookies<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(
      this.config.apiUrl + url,
      body,
    );
  }

  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(
      this.config.apiUrl + url,
      body,
      {withCredentials: true},
    );
  }

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(
      this.config.apiUrl + url,
      {withCredentials: true},
    );
  }


  getWithQuery<T>(
    url: string,
    query: any
  ): Observable<T> {
    const params = new HttpParams({fromObject: query})
    return this.http.get<T>(
      this.config.apiUrl + url,
      {withCredentials: true, params: params},
    );
  }

  getFileUrl(gameId: number, fileId: string): string {
    return `${this.config.apiUrl}/games/${gameId}/files/${fileId}`
  }
}
