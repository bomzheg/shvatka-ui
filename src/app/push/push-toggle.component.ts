import {Component, Input} from '@angular/core';
import {PushService} from './push.service';

@Component({
  selector: 'app-push-toggle',
  standalone: true,
  imports: [],
  templateUrl: './push-toggle.component.html',
  styleUrl: './push-toggle.component.scss',
})
export class PushToggleComponent {
  @Input() allowDisable = true;

  constructor(public push: PushService) {
  }

  enable(): void {
    this.push.enable();
  }

  disable(): void {
    this.push.disable();
  }
}
