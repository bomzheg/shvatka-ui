import {Component, Input} from '@angular/core';
import {EffectLike, Effects, HintPart} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HttpAdapter} from "../http/http.adapter";
import {MatIcon} from "@angular/material/icon";
import {AppIcon, IconTag} from "../ui/icons";

@Component({
  selector: 'app-effects-part',
  standalone: true,
  imports: [
    HintPartComponent,
    MatIcon,
  ],
  templateUrl: './effects.part.component.html',
  styleUrl: './effects.part.component.scss'
})
export class EffectsPartComponent {
  @Input() effects: EffectLike[] | EffectLike | undefined;
  @Input() gameId: number | undefined;
  /** Blob URLs by file guid, winning over the CDN copy — see the same input
   *  on the scenario view. */
  @Input() localUrls?: Map<string, string>;

  constructor(private http: HttpAdapter) {
  }

  getVisibleEffects(): EffectLike[] {
    return Effects.normalize(this.effects).filter(effect => Effects.hasVisiblePayload(effect));
  }

  getEffectTags(effect: EffectLike): IconTag[] {
    const tags: IconTag[] = [];
    const bonusMinutes = typeof effect.bonus_minutes === 'number' ? effect.bonus_minutes : 0;

    if (bonusMinutes > 0) {
      tags.push({icon: AppIcon.bonus, text: `бонус ${bonusMinutes} мин.`});
    } else if (bonusMinutes < 0) {
      tags.push({icon: AppIcon.penalty, text: `штраф ${-bonusMinutes} мин.`});
    }

    if (effect.level_up) {
      if (typeof effect.next_level === 'number') {
        tags.push({icon: AppIcon.jump, text: `переход на уровень ${effect.next_level + 1}`});
      } else if (typeof effect.next_level === 'string' && effect.next_level) {
        tags.push({icon: AppIcon.jump, text: `переход на уровень ${effect.next_level}`});
      } else {
        tags.push({icon: AppIcon.levelUp, text: `переход на следующий уровень`});
      }
    }

    const hintsCount = Effects.hints(effect).length;
    if (hintsCount > 0) {
      tags.push({icon: AppIcon.bonusHint, text: `бонусные подсказки (${hintsCount}):`});
    }

    return tags;
  }

  getEffectHints(effect: EffectLike): HintPart[] {
    return Effects.hints(effect);
  }

  getHintFileUrl(hint: HintPart): string | undefined {
    if (hint.file_guid === undefined) {
      return undefined;
    }

    const local = this.localUrls?.get(hint.file_guid);
    if (local || this.gameId === undefined) {
      return local;
    }

    return this.http.getFileUrl(this.gameId, hint.file_guid);
  }

  getHintThumbUrl(hint: HintPart): string | undefined {
    if (!hint.thumb_guid) {
      return undefined;
    }

    const local = this.localUrls?.get(hint.thumb_guid);
    if (local || this.gameId === undefined) {
      return local;
    }

    return this.http.getFileUrl(this.gameId, hint.thumb_guid);
  }

}
