import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {HttpAdapter} from "../http/http.adapter";
import {environment} from "../../environments/environment";
import {Page} from "../games/games.service";
import {FullGame} from "../domain/game.models";
import {MyGame, ScenarioPayload, UploadedFile, UploadOptions, uploadOptionsQuery} from "./constructor.models";
import {GameOrganizer, OrgPermissionKey, OrgPlayer} from "./organizers.models";

interface ItemsResponse<T> {
  items: T[];
}

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

  /** §1.7 — upload a single file (multipart `file`). The optional flags control
   *  server-side handling of unsupported images (HEIC/HEIF) — see
   *  {@link UploadOptions}; ordinary formats ignore them. */
  uploadFile(id: number, file: File, options?: UploadOptions): Observable<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);
    return this.httpClient.post<UploadedFile>(
      `${environment.cdnUrl}/games/${id}/files${uploadOptionsQuery(options)}`,
      formData,
      {withCredentials: true},
    );
  }

  /** §1.8 — rename an already uploaded file. */
  renameFile(id: number, guid: string, filename: string): Observable<UploadedFile> {
    return this.httpClient.patch<UploadedFile>(
      `${environment.cdnUrl}/games/${id}/files/${guid}`,
      {filename},
      {withCredentials: true},
    );
  }

  // -------------------------------------------------------------------------
  // Organizers (Game Organizers API)
  // -------------------------------------------------------------------------

  /** List the organizers of a game (primary first, then secondary incl. deleted). */
  listOrganizers(gameId: number): Observable<Page<GameOrganizer>> {
    return this.http.get<Page<GameOrganizer>>(`/games/${gameId}/organizers`);
  }

  /** Add a player as a new secondary organizer (all permissions start false). */
  addOrganizer(gameId: number, playerId: number): Observable<GameOrganizer> {
    return this.http.post<GameOrganizer>(`/games/${gameId}/organizers`, {player_id: playerId});
  }

  /** Soft-delete a secondary organizer (the org is passed in the body, not path). */
  deleteOrganizer(gameId: number, orgId: number): Observable<GameOrganizer> {
    return this.httpClient.request<GameOrganizer>(
      "DELETE",
      `${environment.apiUrl}/games/${gameId}/organizers`,
      {
        withCredentials: true,
        headers: {"Content-Type": "application/json"},
        body: {org_id: orgId},
        responseType: "json",
      },
    );
  }

  /** Set a single permission of a secondary organizer to an explicit value. */
  setOrganizerPermission(
    gameId: number,
    orgId: number,
    permission: OrgPermissionKey,
    value: boolean,
  ): Observable<GameOrganizer> {
    return this.http.put<GameOrganizer>(
      `/games/${gameId}/organizers/${orgId}`,
      {permission, value},
    );
  }

  /** Search players by username — used to pick a new organizer to invite. */
  searchPlayers(query: string): Observable<ItemsResponse<OrgPlayer>> {
    const qs = new URLSearchParams({username: query}).toString();
    return this.http.get<ItemsResponse<OrgPlayer>>(`/users?${qs}`);
  }
}
