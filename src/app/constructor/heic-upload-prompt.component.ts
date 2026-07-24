import {Component, HostListener} from "@angular/core";
import {CommonModule} from "@angular/common";
import {HeicUploadService} from "./heic-upload.service";

/**
 * Modal shown when an upload hits an unsupported image (HEIC/HEIF), offering to
 * convert it to JPEG or keep the original. Rendered once near the app root; its
 * visibility is driven entirely by {@link HeicUploadService.prompt$}.
 */
@Component({
  selector: "app-heic-upload-prompt",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./heic-upload-prompt.component.html",
  styleUrl: "./heic-upload-prompt.component.scss",
})
export class HeicUploadPromptComponent {
  constructor(protected heic: HeicUploadService) {}

  convert() {
    this.heic.choose("convert");
  }

  keep() {
    this.heic.choose("keep");
  }

  cancel() {
    this.heic.choose("cancel");
  }

  @HostListener("document:keydown.escape")
  onEscape() {
    if (this.heic.prompt$.value) {
      this.cancel();
    }
  }
}
