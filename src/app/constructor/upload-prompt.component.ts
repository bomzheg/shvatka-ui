import {Component, HostListener} from "@angular/core";
import {CommonModule} from "@angular/common";
import {UploadPromptService} from "./upload-prompt.service";

/**
 * Modal shown when the server refuses an upload: an unsupported image
 * (HEIC/HEIF) offers converting or keeping it, a file Telegram would not take
 * offers uploading it anyway. Rendered once near the app root; its visibility
 * is driven entirely by {@link UploadPromptService.prompt$}.
 */
@Component({
  selector: "app-upload-prompt",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./upload-prompt.component.html",
  styleUrl: "./upload-prompt.component.scss",
})
export class UploadPromptComponent {
  constructor(protected prompt: UploadPromptService) {}

  convert() {
    this.prompt.choose("convert");
  }

  keep() {
    this.prompt.choose("keep");
  }

  force() {
    this.prompt.choose("force");
  }

  cancel() {
    this.prompt.choose("cancel");
  }

  @HostListener("document:keydown.escape")
  onEscape() {
    if (this.prompt.prompt$.value) {
      this.cancel();
    }
  }
}
