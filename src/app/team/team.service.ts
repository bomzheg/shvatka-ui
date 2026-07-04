import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {HttpAdapter} from '../http/http.adapter';
import {environment} from '../../environments/environment';
import {
  Items,
  PlayedGame,
  PlayerProfile,
  PlayerSearchResult,
  PlayerStat,
  TeamDetails,
  TeamMember,
  TeamMemberPermissions,
} from './team.models';

type ItemsResponse<T> = Items<T>;

export interface TeamListFilters {
  active?: boolean;
  archive?: boolean;
  search?: string;
}

@Injectable({providedIn: 'root'})
export class TeamService {
  constructor(
    private http: HttpAdapter,
    private httpClient: HttpClient,
  ) {}

  getPlayer(id: number): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`/users/${id}/details`);
  }

  getPlayerStat(id: number): Observable<PlayerStat> {
    return this.http.get<PlayerStat>(`/users/${id}/stat`);
  }

  listTeams(filters: TeamListFilters = {}): Observable<ItemsResponse<TeamDetails>> {
    const params = new URLSearchParams();
    if (filters.active !== undefined) params.set('active', String(filters.active));
    if (filters.archive !== undefined) params.set('archive', String(filters.archive));
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return this.http.get<ItemsResponse<TeamDetails>>(`/teams${qs ? `?${qs}` : ''}`);
  }

  getTeamStat(teamId: number): Observable<ItemsResponse<PlayedGame>> {
    return this.http.get<ItemsResponse<PlayedGame>>(`/teams/${teamId}/stat`);
  }

  getTeam(teamId: number): Observable<TeamDetails> {
    return this.http.get<TeamDetails>(`/teams/${teamId}`);
  }

  createTeam(name: string, description: string | null): Observable<TeamDetails> {
    return this.http.post<TeamDetails>('/teams', {name, description});
  }

  searchPlayers(query: string): Observable<ItemsResponse<PlayerSearchResult>> {
    const qs = new URLSearchParams({username: query}).toString();
    return this.http.get<ItemsResponse<PlayerSearchResult>>(`/users?${qs}`);
  }

  getTeamPlayers(teamId: number): Observable<ItemsResponse<TeamMember>> {
    return this.http.get<ItemsResponse<TeamMember>>(`/teams/${teamId}/players`);
  }

  updateTeam(teamId: number, name: string, description: string | null): Observable<TeamDetails> {
    return this.http.put<TeamDetails>(`/teams/${teamId}`, {name, description});
  }

  addPlayer(teamId: number, playerId: number, role?: string, emoji?: string): Observable<TeamMember> {
    const body: Record<string, unknown> = {player_id: playerId};
    if (role) body['role'] = role;
    if (emoji) body['emoji'] = emoji;
    return this.http.post<TeamMember>(`/teams/${teamId}/players`, body);
  }

  updateMember(
    teamId: number,
    playerId: number,
    updates: {role?: string; emoji?: string | null; permissions?: Partial<TeamMemberPermissions>},
  ): Observable<TeamMember> {
    return this.http.put<TeamMember>(`/teams/${teamId}/players/${playerId}`, updates);
  }

  removeMember(teamId: number, playerId: number): Observable<void> {
    return this.httpClient.delete<void>(
      `${environment.apiUrl}/teams/${teamId}/players/${playerId}`,
      {withCredentials: true},
    );
  }
}
