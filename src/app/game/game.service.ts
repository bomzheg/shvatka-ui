import {Injectable} from '@angular/core';
import {HttpAdapter} from "../http/http.adapter";
import {HttpErrorResponse} from "@angular/common/http";
import {MatSnackBar} from "@angular/material/snack-bar";

import {FullGame, GameStat, Keys} from "../domain/game.models";
type GameCacheItem = {
  game?: FullGame;
  keys?: Keys;
  stat?: GameStat;
};

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private game: FullGame | undefined;
  private keys: Keys | undefined;
  private stat: GameStat | undefined;
  private currentGameId: number | undefined;
  private requestVersion = 0;
  private cache = new Map<number, GameCacheItem>();

  private isGameLoading = false;
  private isKeysLoading = false;
  private isStatLoading = false;

  constructor(private http: HttpAdapter, private snackBar: MatSnackBar) { }

  loadGame(id: number) {
    this.currentGameId = id;
    const version = ++this.requestVersion;
    const cached = this.cache.get(id);

    this.game = cached?.game;
    this.keys = cached?.keys;
    this.stat = cached?.stat;

    this.fetchGame(id, version, !cached?.game);
    this.fetchKeys(id, version, !cached?.keys);
    this.fetchStat(id, version, !cached?.stat);
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
            this.snackBar.open("Сценарии игр доступны только авторизованным пользователям", 'Закрыть', {duration: 3000});
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
}
