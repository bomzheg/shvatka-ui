import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {ShvatkaConfig} from "../app.config";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {throwError} from "rxjs";
import {AuthStateService} from "../auth/auth-state.service";

@Injectable({
  providedIn: "root",
})
export class HttpAdapter {
  constructor(
    private http: HttpClient,
    private config: ShvatkaConfig,
    private authStateService: AuthStateService,
  ) {
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
    if (this.shouldBlockProtectedRequest(url)) {
      return this.unauthorizedError(url);
    }
    return this.http.get<T>(
      this.config.apiUrl + url,
      {withCredentials: true},
    );
  }

  put<T>(url: string, body: any): Observable<T> {
    if (this.shouldBlockProtectedRequest(url)) {
      return this.unauthorizedError(url);
    }
    return this.http.put<T>(
      this.config.apiUrl + url,
      body,
      {
        withCredentials: true,
        headers: {"Content-Type": "application/json"},
      },
    );
  }

  getBlob(url: string): Observable<Blob> {
    if (this.shouldBlockProtectedRequest(url)) {
      return this.unauthorizedError(url);
    }
    return this.http.get(
      this.config.apiUrl + url,
      {withCredentials: true, responseType: "blob"},
    );
  }

  getFileUrl(gameId: number, fileId: string): string {
    return `${this.config.cdnUrl}/games/${gameId}/files/${fileId}`
  }

  uploadCdn<T>(url: string, formData: FormData): Observable<T> {
    return this.http.post<T>(
      this.config.cdnUrl + url,
      formData,
      {withCredentials: true},
    );
  }

  // Note: 'delete' is a JS reserved word and cannot be called from @Injectable services via
  // dot notation with Angular 17 esbuild. The del() method is the public entry point.
  delete<T>(url: string, body?: any): Observable<T> {
    if (this.shouldBlockProtectedRequest(url)) {
      return this.unauthorizedError(url);
    }
    return this.http.request<T>('DELETE',
      this.config.apiUrl + url,
      {
        withCredentials: true,
        headers: {"Content-Type": "application/json"},
        body,
        responseType: 'json',
      },
    );
  }

  del<T>(url: string, body?: any): Observable<T> {
    return this.delete<T>(url, body);
  }

  postCdnForm<T>(url: string, formData: FormData): Observable<T> {
    return this.uploadCdn<T>(url, formData);
  }

  private shouldBlockProtectedRequest(url: string): boolean {
    if (!this.authStateService.isUnauthenticated()) {
      return false;
    }

    return this.isProtectedUrl(url);
  }

  private isProtectedUrl(url: string): boolean {
    return /^\/admin(\/.*)?$/.test(url)
      || /^\/notifications([/?].*)?$/.test(url)
      || /^\/requests([/?].*)?$/.test(url)
      || /^\/games\/\d+$/.test(url)
      || /^\/games\/my(\/.*)?$/.test(url)
      || /^\/games\/\d+\/keys$/.test(url)
      || /^\/games\/\d+\/stat$/.test(url)
      || /^\/games\/\d+\/stat\/export$/.test(url)
      || /^\/games\/\d+\/files\/.+$/.test(url)
      || url === "/games/active/me"
      || url === "/games/running/level/current"
      || url === "/games/running/key"
      || url === "/users/me/password"
      || url === "/users/me/username"
      || /^\/teams\/my(\/.*)?$/.test(url)
      || /^\/teams\/\d+\/captain$/.test(url);
  }

  private unauthorizedError<T>(url: string): Observable<T> {
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: "Unauthorized",
      url: this.config.apiUrl + url,
    }));
  }
}
