import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {PushService} from '../push/push.service';
import {PushPromptService} from '../push/push-prompt.service';
import {PushSettingsService} from '../push/push-settings.service';
import {PUSH_CATEGORIES, PushCategory} from '../push/push-settings';
import {PushToggleComponent} from '../push/push-toggle.component';

/** Push notifications: the switch itself, what this browser wants, and what was silenced during games. */
@Component({
  selector: 'app-profile-notifications',
  standalone: true,
  imports: [PushToggleComponent, RouterLink],
  templateUrl: './profile-notifications.component.html',
  styleUrl: './profile-notifications.component.scss',
})
export class ProfileNotificationsComponent {
  readonly categories = PUSH_CATEGORIES;

  constructor(
    public push: PushService,
    public settings: PushSettingsService,
    private prompts: PushPromptService,
  ) {
  }

  get isEnabled(): boolean {
    return this.push.state() === 'granted';
  }

  isCategoryEnabled(category: PushCategory): boolean {
    return this.settings.isCategoryEnabled(category);
  }

  toggleCategory(category: PushCategory, event: Event): void {
    this.settings.setCategoryEnabled(category, (event.target as HTMLInputElement).checked);
  }

  toggleVibrate(event: Event): void {
    this.settings.setVibrate((event.target as HTMLInputElement).checked);
  }

  hasDismissedPrompts(): boolean {
    return this.prompts.hasDismissed();
  }

  restorePrompts(): void {
    this.prompts.clearDismissed();
  }
}
