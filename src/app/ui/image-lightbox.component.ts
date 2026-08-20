import {Component, HostListener, Input} from "@angular/core";
import {MediaErrorDirective} from "./media-error.directive";

/**
 * Image thumbnail that opens a full-size overlay on click.
 * Used for media previews in the constructor.
 */
@Component({
  selector: "app-image-lightbox",
  standalone: true,
  imports: [MediaErrorDirective],
  templateUrl: "./image-lightbox.component.html",
  styleUrl: "./image-lightbox.component.scss",
})
export class ImageLightboxComponent {
  @Input({required: true}) src!: string;
  @Input() alt = "превью";

  isOpen = false;

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  @HostListener("document:keydown.escape")
  onEscape() {
    this.close();
  }
}
