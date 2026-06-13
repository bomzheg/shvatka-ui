import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {HttpAdapter} from "../http/http.adapter";
import {environment} from "../../environments/environment";
import {Page} from "../games/games.service";
import {FullGame} from "../domain/game.models";
import {MyGame, ScenarioPayload, UploadedFile} from "./constructor.models";

@Injectable({
  providedIn: "root",
})
export class ConstructorService {
  constructor(private http: HttpAdapter, private httpClient: HttpClient) {
  }

  /** §1.1 — list the current author's game drafts (not complete). */
  listMyGames(): Observable<Page<MyGame>> {
    return this.http.get<Page<MyGame>>("/games/my");
  }

  /** §1.2 — full game by id for editing. */
  getGame(id: number): Observable<FullGame> {
    return this.http.get<FullGame>(`/games/my/${id}`);
  }

  /** §1.3 — create a new draft. */
  createGame(name: string): Observable<MyGame> {
    return this.http.post<MyGame>("/games/my", {name});
  }

  /** §1.4 — replace the whole scenario. */
  saveScenario(id: number, scenario: ScenarioPayload): Observable<FullGame> {
    return this.http.put<FullGame>(`/games/my/${id}/scenario`, scenario);
  }

  /** §1.5 — set or clear the planned start. */
  setStartAt(id: number, startAt: string | null): Observable<MyGame> {
    return this.http.put<MyGame>(`/games/my/${id}/start_at`, {start_at: startAt});
  }

  /** §1.6 — change status. */
  setStatus(id: number, status: string): Observable<MyGame> {
    return this.http.put<MyGame>(`/games/my/${id}/status`, {status});
  }

  /** §1.7 — upload a single file (multipart `file`). */
  uploadFile(id: number, file: File): Observable<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);
    return this.httpClient.post<UploadedFile>(
      `${environment.cdnUrl}/games/${id}/files`,
      formData,
      {withCredentials: true},
    );
  }
}
