import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  GamePlayService,
  CurrentHints,
  TypedKeyResult,
  KeyEffect,
  TypedKeyLog,
  CurrentWaivers,
  WaiversTeam
} from "./game_play.service";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HintPart, KeyType} from "../domain/game.models";
import {FormsModule} from "@angular/forms";
import {finalize, Subscription} from "rxjs";
import {ActiveGame} from "../games/games.service";

@Component({
  selector: 'app-game-play',
  standalone: true,
  imports: [
    HintPartComponent,
    FormsModule,
  ],
  templateUrl: './game_play.component.html',
  styleUrl: './game_play.component.scss'
})
export class GamePlayComponent implements OnInit, OnDestroy {
  activeGame: ActiveGame | undefined;
  countdownToStart: string | undefined;
  keyText: string = "";
  keyResult: string | undefined;
  keyResultData: TypedKeyResult | undefined;
  keySubmitError: string | undefined;
  isSubmitting = false;
  private activeGameSubscription: Subscription | undefined;
  private countdownInterval: ReturnType<typeof setInterval> | undefined;
  private keyResultTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private gameService: GamePlayService,
    private http: HttpAdapter,
    ) {
  }

  ngOnInit(): void {
    this.activeGameSubscription = this.gameService.getActiveGame(true).subscribe(game => {
      this.activeGame = game;
      this.startCountdownTicker();
    });
    this.gameService.loadHints();
  }

  ngOnDestroy(): void {
    this.clearResultTimer();
    this.activeGameSubscription?.unsubscribe();
    this.clearCountdownTicker();
  }

  getCurrentHints(): CurrentHints | undefined {
    return this.gameService.getCurrentHints()
  }

  isLoading(): boolean {
    return this.gameService.hintsLoading();
  }

  isAuthRequired(): boolean {
    return this.gameService.isAuthRequired();
  }

  hasHints(): boolean {
    return this.getCurrentHints() !== undefined;
  }

  hasWaivers(): boolean {
    return this.getCurrentWaivers() !== undefined;
  }

  getActiveGameName(): string {
    return this.activeGame?.name ?? "Текущая игра";
  }

  getCountdownToStart(): string | undefined {
    return this.countdownToStart;
  }

  getCurrentWaivers(): CurrentWaivers | undefined {
    return this.gameService.getCurrentWaivers();
  }

  getTeamWaivers(teamId: number): string[] {
    const waiversMap = this.getCurrentWaivers()?.waivers;
    if (!waiversMap) {
      return [];
    }

    const waivers = waiversMap[String(teamId)] ?? [];
    return waivers.map(waiver => waiver.player.name_mention);
  }

  hasTeamWaivers(team: WaiversTeam): boolean {
    return this.getTeamWaivers(team.id).length > 0;
  }

  getTeamWaiversCount(team: WaiversTeam): number {
    return this.getTeamWaivers(team.id).length;
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.getCurrentHints()!.game_id, hint.file_guid)
  }

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  onKeyTextChange(text: string) {
    this.keyText = text.toUpperCase();
  }

  submitKey() {
    if (!this.hasHints() || this.isSubmitting) {
      return;
    }

    const key = this.keyText.trim();
    if (!key) {
      return;
    }

    this.isSubmitting = true;
    this.keySubmitError = undefined;

    this.gameService.submitKey(key)
      .pipe(finalize(() => {
        this.isSubmitting = false;
      }))
      .subscribe({
        next: result => {
          this.keyResult = this.mapResult(result);
          this.keyResultData = result;
          this.startResultTimer();
          this.keyText = "";
        },
        error: () => {
          this.keySubmitError = "Не удалось отправить ключ";
        }
      });
  }

  isLevelCompleted(result: TypedKeyResult): boolean {
    return result.effects?.some(effect => effect.level_up) ?? false;
  }

  hasVisibleEffects(result: TypedKeyResult): boolean {
    return this.getVisibleEffects(result).length > 0;
  }

  getVisibleEffects(result: TypedKeyResult): Array<{tags: string[], hints: any[]}> {
    if (!Array.isArray(result.effects)) {
      return [];
    }

    return result.effects
      .map(effect => ({
        tags: this.getEffectTags(effect),
        hints: Array.isArray(effect.hints_) ? effect.hints_ : [],
      }))
      .filter(effect => effect.tags.length > 0 || effect.hints.length > 0);
  }

  getEffectTags(effect: KeyEffect): string[] {
    const tags: string[] = [];

    if (effect.bonus_minutes > 0) {
      tags.push(`бонус ${effect.bonus_minutes} мин.`);
    } else if (effect.bonus_minutes < 0) {
      tags.push(`штраф ${-effect.bonus_minutes} мин.`);
    }
    if (effect.level_up) {
      if (effect.next_level) {
        tags.push(`переход на ${effect.next_level}`);
      } else {
        tags.push('переход на следующий уровень');
      }
    }

    if (Array.isArray(effect.hints_) && effect.hints_.length > 0) {
      tags.push(`бонусные подсказки: ${effect.hints_.length}`);
    }

    return tags;
  }

  getTypedKeyEffects(typedKey: TypedKeyLog): string[] {
    const effects = typedKey?.effects;
    if (!Array.isArray(effects)) {
      return [];
    }

    return effects
      .flatMap((effect: KeyEffect) => this.getEffectTags(effect))
      .filter((tag, idx, arr) => arr.indexOf(tag) === idx);
  }

  hasAnyTypedKeys(): boolean {
    const typedKeys = this.getCurrentHints()?.typed_keys;
    return Array.isArray(typedKeys) && typedKeys.length > 0;
  }

  typedKeyStatusClass(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return 'typed-key-bad-duplicate';
    }
    if (isWrong) {
      return 'typed-key-wrong';
    }
    if (typedKey?.is_duplicate) {
      return 'typed-key-duplicate';
    }
    return 'typed-key-ok';
  }

  typedKeyEmoji(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return '⚠️🔁';
    }
    if (isWrong) {
      return '❌';
    }
    if (typedKey?.is_duplicate) {
      return '🔁';
    }
    return '✅';
  }

  typedKeyStatusText(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return 'дубликат + ошибка';
    }
    if (isWrong) {
      return 'ошибка';
    }
    if (typedKey?.is_duplicate) {
      return 'дубликат';
    }
    return 'корректный';
  }

  private mapResult(result: TypedKeyResult): string {
    if (result.is_duplicate && result.wrong) {
      return "дубликат + ошибка";
    }
    if (result.is_duplicate) {
      return "дубликат";
    }
    if (result.wrong) {
      return "ошибка";
    }
    return "корректный";
  }

  private isWrongTypedKey(typedKey: TypedKeyLog): boolean {
    return typedKey?.type_ === KeyType.wrong;
  }

  private startResultTimer() {
    this.clearResultTimer();
    this.keyResultTimer = setTimeout(() => {
      this.keyResult = undefined;
      this.keyResultData = undefined;
      this.keySubmitError = undefined;
    }, 60_000);
  }

  private clearResultTimer() {
    if (this.keyResultTimer) {
      clearTimeout(this.keyResultTimer);
      this.keyResultTimer = undefined;
    }
  }

  private startCountdownTicker() {
    this.clearCountdownTicker();
    this.countdownToStart = this.buildCountdown();

    if (!this.activeGame?.start_at || this.isStartTimeReached()) {
      return;
    }

    this.countdownInterval = setInterval(() => {
      this.countdownToStart = this.buildCountdown();
      if (!this.countdownToStart) {
        this.clearCountdownTicker();
      }
    }, 1000);
  }

  private clearCountdownTicker() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  private isStartTimeReached(): boolean {
    if (!this.activeGame?.start_at) {
      return true;
    }

    return Date.parse(this.activeGame.start_at) <= Date.now();
  }

  private buildCountdown(): string | undefined {
    if (!this.activeGame?.start_at) {
      return undefined;
    }

    const startAtMs = Date.parse(this.activeGame.start_at);
    const totalSeconds = Math.floor(Math.max(startAtMs - Date.now(), 0) / 1000);

    if (totalSeconds <= 0) {
      return undefined;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days} дн. ${hours} ч.`;
    }

    if (hours > 0) {
      return `${hours} ч. ${minutes} мин.`;
    }

    return `${minutes} мин. ${seconds} сек.`;
  }
}
