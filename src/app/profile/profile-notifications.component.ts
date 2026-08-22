import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {PushService} from '../push/push.service';
import {PushPromptService} from '../push/push-prompt.service';
import {PushToggleComponent} from '../push/push-toggle.component';

/** Push notifications: the switch itself, plus what was silenced during games. */
@Component({
  selector: 'app-profile-notifications',
  standalone: true,
  imports: [PushToggleComponent, RouterLink],
  templateUrl: './profile-notifications.component.html',
  styleUrl: './profile-notifications.component.scss',
})
export class ProfileNotificationsComponent {
  constructor(
    public push: PushService,
    private prompts: PushPromptService,
  ) {
  }

  get isEnabled(): boolean {
    return this.push.state() === 'granted';
  }

  hasDismissedPrompts(): boolean {
    return this.prompts.hasDismissed();
  }

  restorePrompts(): void {
    this.prompts.clearDismissed();
  }
}
