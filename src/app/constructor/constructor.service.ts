import {Injectable} from "@angular/core";
import {map, Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {HttpAdapter} from "../http/http.adapter";
import {environment} from "../../environments/environment";
import {Page} from "../games/games.service";
import {FullGame, GameRelease} from "../domain/game.models";
import {
  HintPayload,
  MyGame,
  ScenarioPayload,
  UploadedFile,
  UploadOptions,
  uploadOptionsQuery,
} from "./constructor.models";
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

  /** Rename the game, without touching its scenario.
   *
   *  Saving a scenario renames the game too — but a draft with no levels yet
   *  has no scenario to save, so the name gets its own route.
   */
  renameGame(id: number, name: string): Observable<MyGame> {
    return this.http.put<MyGame>(`/games/my/${id}/name`, {name});
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

  /** Keys of the game as a pdf laid out for A4, to print and cut into slips. */
  keysToPrint(id: number): Observable<Blob> {
    return this.http.getBlob(`/games/my/${id}/keys/print`);
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

  /** Detach a file from the game, deleting it outright when this was its last
   *  use anywhere. The server refuses (409) while a level or the release still
   *  refers to it. */
  deleteFile(id: number, guid: string): Observable<void> {
    return this.httpClient.delete<void>(
      `${environment.cdnUrl}/games/${id}/files/${guid}`,
      {withCredentials: true},
    );
  }

  // -------------------------------------------------------------------------
  // Release (the promo published before a game)
  // -------------------------------------------------------------------------

  /** The game's published release, or undefined while it has none. */
  getRelease(gameId: number): Observable<GameRelease | undefined> {
    return this.http.get<GameRelease | null>(`/games/${gameId}/release`)
      .pipe(map(release => release ?? undefined));
  }

  /**
   * Write (or rewrite) the game's release. When it reaches the announcements
   * channel is the engine's call: a release saved before the waivers start
   * goes out when they do, one saved later goes out at once, and an already
   * published one has its channel messages edited.
   */
  saveRelease(
    gameId: number,
    banner: HintPayload | undefined,
    hints: HintPayload[],
  ): Observable<GameRelease> {
    return this.http.put<GameRelease>(`/games/my/${gameId}/release`, {
      banner: banner ?? null,
      hints,
    });
  }

  deleteRelease(gameId: number): Observable<void> {
    return this.http.del<void>(`/games/my/${gameId}/release`);
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
