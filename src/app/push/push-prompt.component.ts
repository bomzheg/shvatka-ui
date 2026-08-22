import {Component, Input} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {AppIcon} from '../ui/icons';
import {PushService} from './push.service';
import {PushPromptService} from './push-prompt.service';
import {PushToggleComponent} from './push-toggle.component';

/**
 * The "turn notifications on" invitation shown while a game is running.
 *
 * It can be waved away for good — per {@link scope}, i.e. per game — so a player
 * who plays without notifications is asked once and never again for that game.
 */
@Component({
  selector: 'app-push-prompt',
  standalone: true,
  imports: [PushToggleComponent, MatIcon],
  templateUrl: './push-prompt.component.html',
  styleUrl: './push-prompt.component.scss',
})
export class PushPromptComponent {
  protected readonly AppIcon = AppIcon;

  /** What the dismissal is remembered against, e.g. `game:42`. */
  @Input({required: true}) scope = '';

  constructor(
    public push: PushService,
    private prompts: PushPromptService,
  ) {
  }

  /** Nothing to ask for when it is already on, impossible, or waved away. */
  isVisible(): boolean {
    if (!this.scope || this.prompts.isDismissed(this.scope)) {
      return false;
    }
    const state = this.push.state();
    return state !== 'granted' && state !== 'unsupported' && state !== 'disabled';
  }

  isBlocked(): boolean {
    return this.push.state() === 'denied';
  }

  dismiss(): void {
    this.prompts.dismiss(this.scope);
  }
}
