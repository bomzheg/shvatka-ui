import {Component, Input} from "@angular/core";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "./icons";

/**
 * Telegram-style circular video note. The native controls would be clipped by
 * the circle, so they are hidden and replaced with a custom centered
 * play/pause button. Each instance manages its own playback state, so several
 * can coexist (e.g. in the files list).
 */
@Component({
  selector: "app-video-note",
  standalone: true,
  imports: [MatIcon],
  template: `
    <div class="video-note-wrap" [style.width.px]="size">
      <video
        #videoEl
        class="video-note"
        [src]="src || null"
        [poster]="poster || null"
        (click)="toggle(videoEl)"
        (play)="playing = true"
        (pause)="playing = false"
        (ended)="playing = false"
        playsinline>
      </video>
      <button
        type="button"
        class="video-note-btn"
        [class.playing]="playing"
        (click)="toggle(videoEl)"
        [attr.aria-label]="playing ? 'Пауза' : 'Воспроизвести'">
        <mat-icon [svgIcon]="playing ? AppIcon.pause : AppIcon.play"/>
      </button>
    </div>
  `,
  styleUrl: "./video-note.component.scss",
})
export class VideoNoteComponent {
  @Input() src: string | undefined;
  @Input() poster: string | undefined;
  /** Diameter of the circle in px. */
  @Input() size = 200;

  protected readonly AppIcon = AppIcon;
  playing = false;

  toggle(video: HTMLVideoElement): void {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }
}
