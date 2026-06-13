import {Component, HostListener, Input} from "@angular/core";

/**
 * Image thumbnail that opens a full-size overlay on click.
 * Used for media previews in the constructor.
 */
@Component({
  selector: "app-image-lightbox",
  standalone: true,
  imports: [],
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
