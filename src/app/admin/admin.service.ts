import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpAdapter} from '../http/http.adapter';
import {Items, TeamDetails, TeamMember, TeamRef} from '../team/team.models';
import {Game, Page} from '../games/games.service';
import {FullGame} from '../domain/game.models';
import {ScenarioPayload, UploadedFile, UploadOptions, uploadOptionsQuery} from '../constructor/constructor.models';
import {
  AdminEmail,
  AdminGame,
  AdminPlayerDetails,
  AdminPlayerListItem,
  AdminPlayerRef,
  AdminPlayersFilters,
  AdminPoll,
  FileGarbage,
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

  // ---------------------------------------------------------------------------
  // Team membership over the head of the captain. These endpoints skip the team
  // permissions entirely — the way out when the captain is gone or unreachable.
  // ---------------------------------------------------------------------------

  /** Make another player of the team its captain. The target must already play there. */
  changeTeamCaptain(teamId: number, playerId: number): Observable<TeamDetails> {
    return this.http.put<TeamDetails>(`/admin/teams/${teamId}/captain`, {player_id: playerId});
  }

  /** Put a player into the team. Fails if they already play somewhere else. */
  addPlayerToTeam(teamId: number, playerId: number, role?: string, emoji?: string): Observable<TeamMember> {
    const body: Record<string, unknown> = {player_id: playerId};
    if (role) body['role'] = role;
    if (emoji) body['emoji'] = emoji;
    return this.http.post<TeamMember>(`/admin/teams/${teamId}/players`, body);
  }

  removePlayerFromTeam(teamId: number, playerId: number): Observable<void> {
    return this.http.del<void>(`/admin/teams/${teamId}/players/${playerId}`);
  }

  getPoll(): Observable<AdminPoll> {
    return this.http.get<AdminPoll>('/admin/poll');
  }

  removePollEntry(teamId: number, playerId: number): Observable<void> {
    return this.http.del<void>(`/admin/poll/${teamId}/players/${playerId}`);
  }

  /**
   * Sweep files nothing refers to any more: game links no level uses, metas
   * left without a link, and stored content no meta points at. Defaults to a
   * dry run — the answer says what would go, nothing is deleted.
   */
  collectFileGarbage(dryRun = true): Observable<FileGarbage> {
    return this.http.post<FileGarbage>(`/admin/files/gc?dry_run=${dryRun}`, null);
  }

  getGameWaivers(gameId: number): Observable<GameWaivers> {
    return this.http.get<GameWaivers>(`/admin/waivers/game/${gameId}`);
  }

  listGames(): Observable<Page<Game>> {
    return this.http.get<Page<Game>>('/games');
  }

  // ---------------------------------------------------------------------------
  // Game statuses. The one thing an admin may change about a game that is not
  // complete — and all an admin may see of it: these two answer with the game's
  // identity and status, never with a level, a hint or a file.
  // ---------------------------------------------------------------------------

  /** Games an admin may act on: active (waivers/started/finished) and complete.
   *  A game still being written belongs to its author and is not listed. */
  listAdminGames(): Observable<Page<AdminGame>> {
    return this.http.get<Page<AdminGame>>('/admin/games');
  }

  /**
   * Move the game to another status — the way back out of waivers opened too
   * early. Moving it to `underconstruction` or `ready` is final for the admin:
   * the game becomes its author's again and disappears from the panel.
   */
  changeGameStatus(id: number, status: string): Observable<AdminGame> {
    return this.http.put<AdminGame>(`/admin/games/${id}/status`, {status});
  }

  /**
   * Send the running level's messages to a team again — telegram lost them.
   * Without `teamId` every team of the game gets its own level back.
   *
   * The answer is the teams the request covered and nothing else: the puzzle
   * and the hints go from the engine to the teams, never through here, and
   * which level anybody is on stays as invisible as before the button.
   */
  resendCurrentLevel(teamId?: number): Observable<Items<TeamRef>> {
    return this.http.post<Items<TeamRef>>('/admin/games/running/resend', {
      team_id: teamId ?? null,
    });
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
