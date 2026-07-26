import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpAdapter} from '../http/http.adapter';
import {Items, TeamDetails} from '../team/team.models';
import {Game, Page} from '../games/games.service';
import {FullGame} from '../domain/game.models';
import {ScenarioPayload, UploadedFile, UploadOptions, uploadOptionsQuery} from '../constructor/constructor.models';
import {
  AdminEmail,
  AdminPlayerDetails,
  AdminPlayerListItem,
  AdminPlayerRef,
  AdminPlayersFilters,
  AdminPoll,
  GameWaivers,
  MergeTimelineItem,
  OneTimeLink,
  WaiverPoint,
} from './admin.models';

@Injectable({providedIn: 'root'})
export class AdminService {
  constructor(private http: HttpAdapter) {}

  listPlayers(filters: AdminPlayersFilters = {}): Observable<Items<AdminPlayerListItem>> {
    const params = new URLSearchParams();
    if (filters.username) params.set('username', filters.username);
    if (filters.name) params.set('name', filters.name);
    if (filters.active !== undefined) params.set('active', String(filters.active));
    if (filters.archive !== undefined) params.set('archive', String(filters.archive));
    if (filters.can_be_author !== undefined) params.set('can_be_author', String(filters.can_be_author));
    const qs = params.toString();
    return this.http.get<Items<AdminPlayerListItem>>(`/admin/players${qs ? `?${qs}` : ''}`);
  }

  getPlayer(id: number): Observable<AdminPlayerDetails> {
    return this.http.get<AdminPlayerDetails>(`/admin/players/${id}`);
  }

  createOneTimeLink(playerId: number): Observable<OneTimeLink> {
    return this.http.post<OneTimeLink>(`/admin/players/${playerId}/one-time-link`, null);
  }

  setEmail(playerId: number, email: string, verified: boolean): Observable<AdminEmail> {
    return this.http.put<AdminEmail>(`/admin/players/${playerId}/email`, {email, verified});
  }

  /** Rename the player. Same rules as the self-service change: a-z, A-Z, 0-9, _, 3-50 chars. */
  setUsername(playerId: number, username: string): Observable<AdminPlayerDetails> {
    return this.http.put<AdminPlayerDetails>(`/admin/players/${playerId}/username`, {username});
  }

  relinkTg(
    playerId: number,
    tg: {tg_id: number; username?: string | null; first_name?: string | null; last_name?: string | null},
  ): Observable<AdminPlayerDetails> {
    return this.http.put<AdminPlayerDetails>(`/admin/players/${playerId}/tg`, tg);
  }

  /** Intervals where the player's team membership is fixed by waivers (constrains merge timelines). */
  getWaiverPoints(playerId: number): Observable<Items<WaiverPoint>> {
    return this.http.get<Items<WaiverPoint>>(`/admin/players/${playerId}/waiver-points`);
  }

  /**
   * Irreversible: folds the secondary player into the primary, then deletes the secondary.
   * With `timeline`, replaces the entire team history of both players by the given intervals
   * (needed when the histories overlap and can't be merged automatically).
   */
  mergePlayers(primaryId: number, secondaryId: number, timeline?: MergeTimelineItem[]): Observable<AdminPlayerRef> {
    const body: {primary_id: number; secondary_id: number; timeline?: MergeTimelineItem[]} = {
      primary_id: primaryId,
      secondary_id: secondaryId,
    };
    if (timeline) body.timeline = timeline;
    return this.http.post<AdminPlayerRef>('/admin/players/merge', body);
  }

  /** Irreversible: folds the secondary team into the primary, then deletes the secondary. */
  mergeTeams(primaryId: number, secondaryId: number): Observable<TeamDetails> {
    return this.http.post<TeamDetails>('/admin/teams/merge', {
      primary_id: primaryId,
      secondary_id: secondaryId,
    });
  }

  getPoll(): Observable<AdminPoll> {
    return this.http.get<AdminPoll>('/admin/poll');
  }

  removePollEntry(teamId: number, playerId: number): Observable<void> {
    return this.http.del<void>(`/admin/poll/${teamId}/players/${playerId}`);
  }

  getGameWaivers(gameId: number): Observable<GameWaivers> {
    return this.http.get<GameWaivers>(`/admin/waivers/game/${gameId}`);
  }

  listGames(): Observable<Page<Game>> {
    return this.http.get<Page<Game>>('/games');
  }

  // ---------------------------------------------------------------------------
  // Editing completed games (superuser only). The admin endpoints work only on
  // completed games — any other status is reported as 404 GameNotFound.
  // ---------------------------------------------------------------------------

  /** Full game (with levels/scenario) — completed games are readable here. */
  getGame(id: number): Observable<FullGame> {
    return this.http.get<FullGame>(`/games/${id}`);
  }

  /**
   * Replace the whole scenario of a completed game. With `authorId`, the game
   * is reassigned to that player before the scenario is saved (the target does
   * not need to be an approved author).
   */
  saveGameScenario(id: number, scenario: ScenarioPayload, authorId?: number): Observable<FullGame> {
    const body: {scenario: ScenarioPayload; author_id?: number} = {scenario};
    if (authorId !== undefined) body.author_id = authorId;
    return this.http.put<FullGame>(`/admin/games/${id}/scenario`, body);
  }

  /** Upload a media file for a completed game (owned by the game's author).
   *  The optional flags mirror the CDN endpoint's unsupported-image handling
   *  (HEIC/HEIF conversion) — see {@link UploadOptions}. */
  uploadGameFile(id: number, file: File, options?: UploadOptions): Observable<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadedFile>(`/admin/games/${id}/files${uploadOptionsQuery(options)}`, formData);
  }
}
