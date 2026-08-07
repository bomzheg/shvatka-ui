import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {NgTemplateOutlet} from "@angular/common";
import {MatIcon} from "@angular/material/icon";
import {HintPart, HintType, RichFormat} from "../domain/game.models";
import {AppIcon} from "../ui/icons";
import {VideoNoteComponent} from "../ui/video-note.component";
import {FileUrlResolver, resolveRichMedia} from "./rich-hint";

/** What the cover of a spoiler announces, per hidden media type. */
const SPOILER_REVEAL_LABELS: Partial<Record<HintType, string>> = {
  [HintType.photo]: "Показать скрытое фото",
  [HintType.video]: "Показать скрытое видео",
  [HintType.animation]: "Показать скрытую анимацию",
};


@Component({
  selector: 'app-hint-part',
  standalone: true,
  imports: [MatIcon, NgTemplateOutlet, VideoNoteComponent],
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
  /**
   * Resolves any file of the game by guid. A rich hint embeds several files at
   * once, so the single `fileUrl` above is not enough for it. Pass a stable
   * (bound) function — a fresh closure on every check would churn the view.
   */
  @Input()
  fileUrlFor: FileUrlResolver | undefined;

    protected readonly HintType = HintType;
    protected readonly AppIcon = AppIcon;
    protected readonly JSON = JSON;

  /** Briefly true right after the coordinates are copied, for UI feedback. */
  coordsCopied = false;
  /** Set when the thumbnail fails to load, so we fall back to a placeholder. */
  thumbBroken = false;
  /** Spoilered media stays covered until the player asks to see it. */
  spoilerRevealed = false;
  /** Set when the still behind the blur can't be loaded (plain cover instead). */
  spoilerCoverBroken = false;
  /** Rendered rich markup, kept until the markup or its media change. */
  private renderedRich: {key: string; html: string} | undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['thumbUrl']) {
      this.thumbBroken = false;
    }
    // A different hint (or a different file) must be covered again.
    if (changes['hint'] || changes['fileUrl'] || changes['thumbUrl']) {
      this.spoilerRevealed = false;
      this.spoilerCoverBroken = false;
    }
  }

  /** Whether the markup of this rich hint can be rendered as HTML. Markdown
   *  is shown as the source text instead — the web has no renderer for it. */
  isRichHtml(): boolean {
    return this.hint.format !== RichFormat.markdown;
  }

  /** The rich markup with every embedded media id resolved to a file url. */
  richHtml(): string {
    const media = HintPart.richMedia(this.hint);
    const key = [this.hint.text ?? "", ...media.map(m => `${m.id}:${m.file_guid}`)].join("\u0000");
    if (this.renderedRich?.key !== key) {
      this.renderedRich = {key, html: resolveRichMedia(this.hint.text, media, this.fileUrlFor)};
    }
    return this.renderedRich.html;
  }

  /** Whether this part is media the author hid behind a spoiler. */
  isSpoilered(): boolean {
    return HintPart.isSpoilered(this.hint);
  }

  /** Whether the media is spoilered *and* still hidden. */
  isCovered(): boolean {
    return this.isSpoilered() && !this.spoilerRevealed;
  }

  /**
   * The still shown blurred under the cover: a photo blurs itself, video and
   * animation blur their thumbnail. Undefined means a plain cover instead.
   */
  spoilerCoverUrl(): string | undefined {
    if (this.spoilerCoverBroken) {
      return undefined;
    }
    return this.hint.type === HintType.photo ? this.fileUrl : this.thumbUrl;
  }

  /** Fall back to a plain cover when the blurred still can't be loaded. */
  onSpoilerCoverError(): void {
    this.spoilerCoverBroken = true;
  }

  /** Uncover the media. There is no way back — same as in Telegram. */
  revealSpoiler(): void {
    this.spoilerRevealed = true;
  }

  /** Screen-reader label of the cover, naming what is hidden behind it. */
  spoilerLabel(): string {
    return SPOILER_REVEAL_LABELS[this.hint.type] ?? "Показать скрытое вложение";
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
