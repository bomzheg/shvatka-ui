import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";
import {GameStat, KeyTime, Keys, TimeHint} from "../domain/game.models";
import {Observable, tap} from "rxjs";
import {ActiveGame, GamesService} from "../games/games.service";

export type TypedKeyLog = KeyTime & {
  effects?: KeyEffect[];
};

export class CurrentHints {
  constructor(
    public hints: TimeHint[],
    public typed_keys: TypedKeyLog[],
    public level_number: number,
    public started_at: string,
    public game_id: number,
  ) {
  }
}

export class KeyEffect {
  constructor(
    public id: string,
    public hints_: any[],
    public bonus_minutes: number,
    public level_up: boolean,
    public next_level: string,
  ) {
  }
}

export class TypedKeyResult {
  constructor(
    public text: string,
    public is_duplicate: boolean,
    public wrong: boolean,
    public at: string,
    public effects: KeyEffect[],
    public game_finished: boolean,
  ) {
  }
}

export class WaiversTeam {
  constructor(
    public id: number,
    public name: string,
  ) {
  }
}

export class WaiverPlayer {
  constructor(
    public id: number,
    public can_be_author: boolean,
    public name_mention: string,
  ) {
  }
}

export class WaiverEntry {
  constructor(
    public player: WaiverPlayer,
  ) {
  }
}

export class CurrentWaivers {
  constructor(
    public teams: WaiversTeam[],
    public waivers: Record<string, WaiverEntry[]>,
  ) {
  }
}

export enum Played {
  yes = "yes",
  no = "no",
  think = "think",
  revoked = "revoked",
  not_allowed = "not_allowed",
}

export class RolePlayer {
  constructor(
    public id: number,
    public can_be_author: boolean,
    public name_mention: string,
  ) {
  }
}

export class RoleTeam {
  constructor(
    public id: number,
    public name: string,
    public captain: RolePlayer | null,
    public description: string | null,
  ) {
  }
}

export class OrganizerDto {
  constructor(
    public player: RolePlayer,
    public can_spy: boolean,
    public can_see_log_keys: boolean,
    public can_validate_waivers: boolean,
    public deleted: boolean,
  ) {
  }
}

export class MyRoleDto {
  constructor(
    public waiver_vote: Played | null,
    public team: RoleTeam | null,
    public org: OrganizerDto | null,
  ) {
  }
}

@Injectable({
  providedIn: 'root'
})
export class GamePlayService {
  private currentHints: CurrentHints | undefined;
  private currentWaivers: CurrentWaivers | undefined;
  private myRole: MyRoleDto | undefined;
  private myRoleGameId: number | undefined;
  private myRoleCacheUntil: number | undefined;
  private spyGameId: number | undefined;
  private spyKeys: Keys | undefined;
  private spyStat: GameStat | undefined;
  private spyLoadingRequests = 0;
  private isSpyLoading = false;
  private isHintsLoading = false;
  private authRequired = false;

  constructor(
    private http: HttpAdapter,
    private snackBar: MatSnackBar,
    private gamesService: GamesService,
  ) {
  }

  loadHints() {
    this.isHintsLoading = true;
    this.authRequired = false;
    this.gamesService.getActiveGame(true).subscribe(game => {
      if (!game) {
        this.currentHints = undefined;
        this.currentWaivers = undefined;
        this.myRole = undefined;
        this.spyGameId = undefined;
        this.spyKeys = undefined;
        this.spyStat = undefined;
        this.isHintsLoading = false;
        return;
      }

      if (game.status === "getting_waivers") {
        this.loadMyRole(game);
        this.loadWaivers();
        return;
      }

      this.loadMyRole(game, false, role => {
        if (role?.waiver_vote === Played.yes) {
          this.loadRunningHints();
          return;
        }

        this.currentHints = undefined;
        this.isHintsLoading = false;
      });
    });
  }

  private loadRunningHints() {
    this.currentWaivers = undefined;
    this.http.get<CurrentHints>(`/games/running/level/current`)
    .subscribe({
      next: h => {
        this.currentHints = h;
        this.isHintsLoading = false;
      },
      error: error => {
        this.isHintsLoading = false;
        this.currentHints = undefined;

        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.authRequired = true;
          console.log("current hint 401 response: " + JSON.stringify(error));
          this.snackBar.open("Играть можно только авторизованным пользователям в составе команд", 'Закрыть', {duration: 3000});
        } else {
          throw error;
        }
      }
    })
  }

  private loadWaivers() {
    this.currentHints = undefined;
    this.http.get<CurrentWaivers>(`/waivers/game/current`)
      .subscribe({
        next: waivers => {
          this.currentWaivers = waivers;
          this.isHintsLoading = false;
        },
        error: error => {
          this.isHintsLoading = false;
          this.currentWaivers = undefined;

          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.authRequired = true;
            this.snackBar.open("Просмотр вейверов доступен только авторизованным пользователям", 'Закрыть', {duration: 3000});
          } else {
            throw error;
          }
        }
      });
  }

  private loadMyRole(game: ActiveGame, forceRefresh = false, onLoaded?: (role: MyRoleDto | undefined) => void) {
    const cacheValid = !forceRefresh
      && this.myRole !== undefined
      && this.myRoleGameId === game.id
      && (this.myRoleCacheUntil === undefined || this.myRoleCacheUntil > Date.now());

    if (cacheValid) {
      this.maybeLoadSpyData(game.id, this.myRole);
      onLoaded?.(this.myRole);
      return;
    }

    this.http.get<MyRoleDto>(`/games/active/me`)
      .subscribe({
        next: role => {
          this.myRole = role;
          this.myRoleGameId = game.id;
          this.myRoleCacheUntil = this.resolveRoleCacheUntil(game);
          this.maybeLoadSpyData(game.id, role);
          onLoaded?.(role);
        },
        error: error => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.myRole = undefined;
            this.myRoleGameId = undefined;
            this.myRoleCacheUntil = undefined;
            onLoaded?.(undefined);
            return;
          }

          throw error;
        }
      });
  }

  private maybeLoadSpyData(gameId: number, role: MyRoleDto | undefined) {
    if (!role?.org || role.org.deleted) {
      return;
    }

    if (role.org.can_spy || role.org.can_see_log_keys) {
      this.loadSpyData(gameId);
    }
  }

  private resolveRoleCacheUntil(game: ActiveGame): number | undefined {
    if (game.status === "getting_waivers") {
      const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
      if (!game.start_at) {
        return fiveMinutesFromNow;
      }

      const gameStartAtMs = Date.parse(game.start_at);
      return Math.min(fiveMinutesFromNow, gameStartAtMs);
    }

    return undefined;
  }

  loadSpyData(gameId: number, forceRefresh: boolean = false) {
    const org = this.myRole?.org;
    const canLoadStat = !!org && !org.deleted && org.can_spy;
    const canLoadKeys = !!org && !org.deleted && org.can_see_log_keys;

    if (!canLoadStat && !canLoadKeys) {
      this.spyGameId = gameId;
      this.spyKeys = undefined;
      this.spyStat = undefined;
      this.isSpyLoading = false;
      this.spyLoadingRequests = 0;
      return;
    }

    if (this.spyGameId !== gameId) {
      this.spyGameId = gameId;
      this.spyKeys = undefined;
      this.spyStat = undefined;
    }

    if (!forceRefresh && (!canLoadKeys || this.spyKeys) && (!canLoadStat || this.spyStat)) {
      return;
    }

    this.spyLoadingRequests = Number(canLoadKeys) + Number(canLoadStat);
    this.isSpyLoading = true;
    if (canLoadKeys) {
      this.http.get<Keys>(`/games/${gameId}/keys`)
        .subscribe({
          next: k => {
            this.spyKeys = k;
            this.completeSpyLoadRequest();
          },
          error: error => {
            this.completeSpyLoadRequest();
            if (!(error instanceof HttpErrorResponse && error.status === 401)) {
              throw error;
            }
          }
        });
    } else {
      this.spyKeys = undefined;
    }

    if (canLoadStat) {
      this.http.get<GameStat>(`/games/${gameId}/stat`)
        .subscribe({
          next: s => {
            this.spyStat = s;
            this.completeSpyLoadRequest();
          },
          error: error => {
            this.completeSpyLoadRequest();
            if (!(error instanceof HttpErrorResponse && error.status === 401)) {
              throw error;
            }
          }
        });
    } else {
      this.spyStat = undefined;
    }
  }

  private completeSpyLoadRequest() {
    this.spyLoadingRequests = Math.max(this.spyLoadingRequests - 1, 0);
    this.isSpyLoading = this.spyLoadingRequests > 0;
  }

  getCurrentHints(): CurrentHints | undefined {
    return this.currentHints;
  }

  getCurrentWaivers(): CurrentWaivers | undefined {
    return this.currentWaivers;
  }

  getMyRole(): MyRoleDto | undefined {
    return this.myRole;
  }

  getSpyKeys(): Keys | undefined {
    return this.spyKeys;
  }

  getSpyStat(): GameStat | undefined {
    return this.spyStat;
  }

  isSpyDataLoading(): boolean {
    return this.isSpyLoading;
  }

  hintsLoading(): boolean {
    return this.isHintsLoading;
  }

  isAuthRequired(): boolean {
    return this.authRequired;
  }

  getActiveGame(forceRefresh: boolean = false): Observable<ActiveGame | undefined> {
    return this.gamesService.getActiveGame(forceRefresh);
  }

  submitKey(text: string): Observable<TypedKeyResult> {
    return this.http.post<TypedKeyResult>(`/games/running/key`, {text}).pipe(
      tap(result => {
        if (result.effects?.some(effect => effect.level_up)) {
          this.snackBar.open("Уровень пройден! Загружаем следующий уровень.", 'Закрыть', {duration: 3000});
          this.loadHints();
        }
      }),
    );
  }
}
