import {Component, OnDestroy, OnInit} from '@angular/core';
import {GamePlayService, CurrentHints, TypedKeyResult, KeyEffect} from "./game_play.service";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HintPart} from "../domain/game.models";
import {FormsModule} from "@angular/forms";

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

  toLocal(dt: string): any {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  onKeyTextChange(text: string) {
    this.keyText = text.toUpperCase();
  }

  submitKey() {
    if (!this.hasHints()) {
      return;
    }

    const key = this.keyText.trim();
    if (!key) {
      return;
    }

    this.gameService.submitKey(key).subscribe(result => {
      this.keyResult = this.mapResult(result);
      this.keyResultData = result;
      this.startResultTimer();
      this.keyText = "";
    });
  }

  isLevelCompleted(result: TypedKeyResult): boolean {
    return result.effects?.some(effect => effect.level_up) ?? false;
  }

  getEffectTags(effect: KeyEffect): string[] {
    const tags: string[] = [];

    if (effect.bonus_minutes) {
      tags.push(`bonus +${effect.bonus_minutes} min`);
    }
    if (effect.level_up) {
      tags.push('level up');
    }
    if (effect.next_level) {
      tags.push(`next level: ${effect.next_level}`);
    }

    if (Array.isArray(effect.hints_) && effect.hints_.length > 0) {
      tags.push(`bonus hints: ${effect.hints_.length}`);
    }

    return tags;
  }

  getTypedKeyEffects(typedKey: any): string[] {
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

  private mapResult(result: TypedKeyResult): string {
    if (result.is_duplicate && result.wrong) {
      return "duplicate (and wrong)";
    }
    if (result.is_duplicate) {
      return "duplicate (but ok)";
    }
    if (result.wrong) {
      return "wrong";
    }
    return "ok";
  }

  private startResultTimer() {
    this.clearResultTimer();
    this.keyResultTimer = setTimeout(() => {
      this.keyResult = undefined;
      this.keyResultData = undefined;
    }, 60_000);
  }

  private clearResultTimer() {
    if (this.keyResultTimer) {
      clearTimeout(this.keyResultTimer);
      this.keyResultTimer = undefined;
    }
  }

  protected readonly Object = Object;
}
