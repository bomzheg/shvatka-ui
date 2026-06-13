import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {HttpAdapter} from '../http/http.adapter';
import {environment} from '../../environments/environment';
import {
  PlayerProfile,
  PlayerSearchResult,
  TeamDetails,
  TeamMember,
  TeamMemberPermissions,
} from './team.models';

interface ItemsResponse<T> {
  items: T[];
}

@Injectable({providedIn: 'root'})
export class TeamService {
  constructor(
    private http: HttpAdapter,
    private httpClient: HttpClient,
  ) {}

  getPlayer(id: number): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`/players/${id}`);
  }

  searchPlayers(query: string): Observable<ItemsResponse<PlayerSearchResult>> {
    const qs = new URLSearchParams({username: query}).toString();
    return this.http.get<ItemsResponse<PlayerSearchResult>>(`/players/search?${qs}`);
  }

  getTeamPlayers(teamId: number): Observable<ItemsResponse<TeamMember>> {
    return this.http.get<ItemsResponse<TeamMember>>(`/teams/${teamId}/players`);
  }

  updateTeam(teamId: number, name: string, description: string | null): Observable<TeamDetails> {
    return this.http.put<TeamDetails>(`/teams/${teamId}`, {name, description});
  }

  addPlayer(playerId: number, role?: string, emoji?: string): Observable<TeamMember> {
    const body: Record<string, unknown> = {player_id: playerId};
    if (role) body['role'] = role;
    if (emoji) body['emoji'] = emoji;
    return this.http.post<TeamMember>('/teams/my/players', body);
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
