import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {HintPart, HintType} from "../domain/game.models";
import {AppIcon} from "../ui/icons";
import {VideoNoteComponent} from "../ui/video-note.component";


@Component({
  selector: 'app-hint-part',
  standalone: true,
  imports: [MatIcon, VideoNoteComponent],
  templateUrl: './hint.part.component.html',
  styleUrl: './hint.part.component.scss'
})
export class HintPartComponent implements OnChanges {
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

  /** Briefly true right after the coordinates are copied, for UI feedback. */
  coordsCopied = false;
  /** Set when the thumbnail fails to load, so we fall back to a placeholder. */
  thumbBroken = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['thumbUrl']) {
      this.thumbBroken = false;
    }
  }

  /** Whether a usable thumbnail is available (present and not broken). */
  hasThumb(): boolean {
    return !!this.thumbUrl && !this.thumbBroken;
  }

  /** Fall back to the icon placeholder when the thumbnail can't be loaded. */
  onThumbError(): void {
    this.thumbBroken = true;
  }

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
