import {Component, Input} from '@angular/core';
import {HintPart} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";

export interface RenderableEffect {
  id?: string;
  hints_?: HintPart[];
  hints?: HintPart[];
  bonus_minutes?: number;
  level_up?: boolean;
  next_level?: string | null;
}

@Component({
  selector: 'app-effects-part',
  standalone: true,
  imports: [
    HintPartComponent,
  ],
  templateUrl: './effects.part.component.html',
  styleUrl: './effects.part.component.scss'
})
export class EffectsPartComponent {
  @Input() effects: RenderableEffect[] | RenderableEffect | undefined;
  @Input() gameId: number | undefined;

  constructor() {
  }

  getVisibleEffects(): RenderableEffect[] {
    const normalizedEffects = this.normalizeEffects(this.effects);

    return normalizedEffects.filter(effect => {
      return this.getEffectTags(effect).length > 0 || this.getEffectHints(effect).length > 0;
    });
  }

  getEffectTags(effect: RenderableEffect): string[] {
    const tags: string[] = [];
    const bonusMinutes = typeof effect.bonus_minutes === 'number' ? effect.bonus_minutes : 0;

    if (bonusMinutes > 0) {
      tags.push(`💰бонус ${bonusMinutes} мин.`);
    } else if (bonusMinutes < 0) {
      tags.push(`💸штраф ${-bonusMinutes} мин.`);
    }

    if (effect.level_up) {
      if (effect.next_level) {
        tags.push(`🔀переход на ${effect.next_level}`);
      } else {
        tags.push('✅переход на следующий уровень');
      }
    }

    const hintsCount = this.getEffectHints(effect).length;
    if (hintsCount > 0) {
      tags.push(`💡бонусные подсказки (${hintsCount}):`);
    }

    return tags;
  }

  getEffectHints(effect: RenderableEffect): HintPart[] {
    if (Array.isArray(effect.hints_)) {
      return effect.hints_;
    }

    if (Array.isArray(effect.hints)) {
      return effect.hints;
    }

    return [];
  }

  private normalizeEffects(effects: RenderableEffect[] | RenderableEffect | undefined): RenderableEffect[] {
    if (Array.isArray(effects)) {
      return effects;
    }

    if (effects === undefined || effects === null) {
      return [];
    }

    return [effects];
  }
}
