import {Injectable} from '@angular/core';
import {Observable} from "rxjs";
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {SnackbarService} from "../snackbar/snackbar.service";

import {FullGame, GameRelease, GameStat, GameWaivers, Keys} from "../domain/game.models";
type GameCacheItem = {
  game?: FullGame;
  keys?: Keys;
  stat?: GameStat;
  waivers?: GameWaivers;
  release?: GameRelease;
};

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;
  private keys: Keys | undefined;
  private stat: GameStat | undefined;
  private waivers: GameWaivers | undefined;
  private release: GameRelease | undefined;
  private currentGameId: number | undefined;
  private requestVersion = 0;
  private cache = new Map<number, GameCacheItem>();

  private isGameLoading = false;
  private isKeysLoading = false;
  private isStatLoading = false;
  private isWaiversLoadingFlag = false;
  private waiversErrorFlag = false;

  constructor(private http: HttpAdapter, private snackbar: SnackbarService) { }

  loadGame(id: number) {
    this.currentGameId = id;
    const version = ++this.requestVersion;
    const cached = this.cache.get(id);

    this.game = cached?.game;
    this.keys = cached?.keys;
    this.stat = cached?.stat;
    this.waivers = cached?.waivers;
    this.isWaiversLoadingFlag = false;
    this.waiversErrorFlag = false;

    this.release = cached?.release;

    this.fetchGame(id, version, !cached?.game);
    this.fetchKeys(id, version, !cached?.keys);
    this.fetchStat(id, version, !cached?.stat);
    this.fetchRelease(id, version, !cached?.release);
  }

  loadWaivers() {
    const id = this.currentGameId;
    if (id === undefined || this.waivers || this.isWaiversLoadingFlag) {
      return;
    }

    const version = this.requestVersion;
    this.isWaiversLoadingFlag = true;
    this.waiversErrorFlag = false;
    this.http.get<GameWaivers>(`/waivers/game/${id}`)
      .subscribe({
        next: w => {
          this.upsertCache(id, {waivers: w});
          if (this.shouldApply(id, version)) {
            this.waivers = w;
            this.isWaiversLoadingFlag = false;
          }
        },
        error: error => {
          if (this.shouldApply(id, version)) {
            this.isWaiversLoadingFlag = false;
            this.waiversErrorFlag = true;
          }

          if (!(error instanceof HttpErrorResponse && error.status === 401)) {
            throw error;
          }
        }
      });
  }

  /**
   * Downloads the results workbook (.xlsx) for a game — the same table the
   * Telegram bot exports (team level times / timedeltas / raw stat).
   */
  exportStat(id: number): Observable<Blob> {
    return this.http.getBlob(`/games/${id}/stat/export`);
  }

  private fetchGame(id: number, version: number, shouldFetch: boolean) {
    if (!shouldFetch) {
      this.isGameLoading = false;
      return;
    }

    this.isGameLoading = true;
    this.http.get<FullGame>(`/games/${id}`)
      .subscribe({
        next: g => {
          this.upsertCache(id, {game: g});
          if (this.shouldApply(id, version)) {
            this.game = g;
            this.isGameLoading = false;
          }
        },
        error: error => {
          if (this.shouldApply(id, version)) {
            this.isGameLoading = false;
          }

          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.snackbar.error("Сценарии игр доступны только авторизованным пользователям", 'Закрыть', 3000);
          } else {
            throw error;
          }
        }
      });
  }

  private fetchKeys(id: number, version: number, shouldFetch: boolean) {
    if (!shouldFetch) {
      this.isKeysLoading = false;
      return;
    }

    this.isKeysLoading = true;
    this.http.get<Keys>(`/games/${id}/keys`)
      .subscribe({
        next: k => {
          this.upsertCache(id, {keys: k});
          if (this.shouldApply(id, version)) {
            this.keys = k;
            this.isKeysLoading = false;
          }
        },
        error: error => {
          if (this.shouldApply(id, version)) {
            this.isKeysLoading = false;
          }

          if (!(error instanceof HttpErrorResponse && error.status === 401)) {
            throw error;
          }
        }
      });
  }

  /** A release is optional and public — a game without one shows no spoiler. */
  private fetchRelease(id: number, version: number, shouldFetch: boolean) {
    if (!shouldFetch) {
      return;
    }

    this.http.get<GameRelease | null>(`/games/${id}/release`)
      .subscribe({
        next: r => {
          const release = r ?? undefined;
          if (release) {
            this.upsertCache(id, {release});
          }
          if (this.shouldApply(id, version)) {
            this.release = release;
          }
        },
        error: () => {
          if (this.shouldApply(id, version)) {
            this.release = undefined;
          }
        }
      });
  }

  private fetchStat(id: number, version: number, shouldFetch: boolean) {
    if (!shouldFetch) {
      this.isStatLoading = false;
      return;
    }

    this.isStatLoading = true;
    this.http.get<GameStat>(`/games/${id}/stat`)
      .subscribe({
        next: s => {
          this.upsertCache(id, {stat: s});
          if (this.shouldApply(id, version)) {
            this.stat = s;
            this.isStatLoading = false;
          }
        },
        error: error => {
          if (this.shouldApply(id, version)) {
            this.isStatLoading = false;
          }

          if (!(error instanceof HttpErrorResponse && error.status === 401)) {
            throw error;
          }
        }
      });
  }

  private shouldApply(id: number, version: number): boolean {
    return this.currentGameId === id && this.requestVersion === version;
  }

  private upsertCache(id: number, patch: GameCacheItem) {
    const existing = this.cache.get(id) ?? {};
    this.cache.set(id, {...existing, ...patch});
  }

  isLoading(): boolean {
    return this.isGameLoading || this.isKeysLoading || this.isStatLoading;
  }

  hasLoadedCurrentGameData(): boolean {
    return !!this.game && !!this.keys && !!this.stat;
  }

  getGame(): FullGame | undefined {
    return this.game;
  }

  getKeys(): Keys | undefined {
    return this.keys;
  }

  getStat(): GameStat | undefined {
    return this.stat;
  }

  getRelease(): GameRelease | undefined {
    return this.release;
  }

  getWaivers(): GameWaivers | undefined {
    return this.waivers;
  }

  isWaiversLoading(): boolean {
    return this.isWaiversLoadingFlag;
  }

  hasWaiversError(): boolean {
    return this.waiversErrorFlag;
  }
}
