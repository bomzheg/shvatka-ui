import {Component, Input} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {HintPart, HintType} from "../domain/game.models";
import {AppIcon} from "../ui/icons";


@Component({
  selector: 'app-hint-part',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './hint.part.component.html',
  styleUrl: './hint.part.component.scss'
})
export class HintPartComponent {
  @Input()
  hint!: HintPart;
  @Input()
  fileUrl: string | undefined;

    protected readonly HintType = HintType;
    protected readonly AppIcon = AppIcon;
    protected readonly JSON = JSON;

  /** Full name assembled from the contact's first/last name. */
  contactName(): string {
    return [this.hint.first_name, this.hint.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /** Link to the location on an external map service. */
  mapUrl(): string {
    return `https://maps.yandex.ru/?ll=${this.hint.longitude},${this.hint.latitude}&z=18`;
  }

  /**
   * Prepares an HTML hint for rendering: normalizes line endings and turns
   * text line breaks into <br>. Newlines that sit inside a tag (e.g. between
   * attributes) are left untouched so the markup is not broken.
   */
  toHtml(value: string | undefined | null): string {
    if (!value) {
      return '';
    }

    return value
      .replace(/\r\n?/g, '\n')
      .replace(/\n(?![^<]*>)/g, '<br>');
  }
}
