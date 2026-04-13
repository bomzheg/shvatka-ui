import {Component, OnDestroy, OnInit} from '@angular/core';
import {GamePlayService, CurrentHints, TypedKeyResult, KeyEffect, TypedKeyLog} from "./game_play.service";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HintPart, KeyType} from "../domain/game.models";
import {FormsModule} from "@angular/forms";
import {finalize} from "rxjs";

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
  keyText: string = "";
  keyResult: string | undefined;
  keyResultData: TypedKeyResult | undefined;
  keySubmitError: string | undefined;
  isSubmitting = false;
  private keyResultTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private gameService: GamePlayService,
    private http: HttpAdapter,
    ) {
  }

  ngOnInit(): void {
    this.gameService.loadHints();
  }

  ngOnDestroy(): void {
    this.clearResultTimer();
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
}
