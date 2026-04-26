import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable, of} from "rxjs";
import {catchError} from "rxjs/operators";
import {ShvatkaConfig} from "../app.config";

export interface VersionInfo {
  vcs_hash?: string;
  vcs_name?: string;
  commit_at?: string;
  build_at?: string;
}

@Injectable({
  providedIn: "root",
})
export class VersionService {
  constructor(
    private http: HttpClient,
    private config: ShvatkaConfig,
  ) {
  }

  getBackendVersion(): Observable<VersionInfo | undefined> {
    return this.http.get<VersionInfo>(`${this.config.apiUrl}/version`)
      .pipe(catchError(() => of(undefined)));
  }

  getFrontendVersion(): Observable<VersionInfo | undefined> {
    return this.http.get<VersionInfo>("/assets/frontend-version.json")
      .pipe(catchError(() => of(undefined)));
  }
}
