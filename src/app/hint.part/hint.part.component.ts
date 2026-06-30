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
  /** Optional thumbnail (Telegram `thumb`) used as a poster/preview. */
  @Input()
  thumbUrl: string | undefined;

    protected readonly HintType = HintType;
    protected readonly AppIcon = AppIcon;
    protected readonly JSON = JSON;

  /** Whether the circular video-note is currently playing. */
  videoNotePlaying = false;
  /** Briefly true right after the coordinates are copied, for UI feedback. */
  coordsCopied = false;

  /** Full name assembled from the contact's first/last name. */
  contactName(): string {
    return [this.hint.first_name, this.hint.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /** "lat, lon" string, used both for display and clipboard copy. */
  coords(): string {
    return `${this.hint.latitude}, ${this.hint.longitude}`;
  }

  /**
   * Link to the exact location on an external map service. `ll` centres the
   * map on the point and `pt` drops a marker right on the coordinates.
   */
  mapUrl(): string {
    const ll = `${this.hint.longitude},${this.hint.latitude}`;
    return `https://yandex.ru/maps/?ll=${ll}&z=18&pt=${ll},pm2rdm`;
  }

  /** Copy the coordinates to the clipboard, with a short visual confirmation. */
  copyCoords(): void {
    navigator.clipboard?.writeText(this.coords()).then(() => {
      this.coordsCopied = true;
      setTimeout(() => (this.coordsCopied = false), 1500);
    });
  }

  /** Toggle playback of the circular video-note (it has no native controls). */
  toggleVideoNote(video: HTMLVideoElement): void {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
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
