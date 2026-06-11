import {Component, EventEmitter, Input, Output} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {HintType} from "../domain/game.models";
import {
  ALL_HINT_TYPES,
  CAPTION_ABOVE_HINT_TYPES,
  CAPTION_HINT_TYPES,
  FILE_HINT_TYPES,
  HINT_TYPE_LABELS,
  HintPayload,
  THUMB_HINT_TYPES,
  UploadedFile,
} from "./constructor.models";

@Component({
  selector: "app-hint-editor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./hint-editor.component.html",
  styleUrl: "./hint-editor.component.scss",
})
export class HintEditorComponent {
  @Input({required: true}) hint!: HintPayload;
  @Input() files: UploadedFile[] = [];
  @Input() index = 0;
  @Output() remove = new EventEmitter<void>();

  protected readonly HintType = HintType;
  protected readonly allTypes = ALL_HINT_TYPES;
  protected readonly typeLabels = HINT_TYPE_LABELS;

  onTypeChange() {
    // Reset type-specific fields so we never send stale data for the new type.
    const type = this.hint.type;
    Object.keys(this.hint).forEach(key => {
      if (key !== "type") {
        delete (this.hint as any)[key];
      }
    });
    this.hint.type = type;
  }

  fileLabel(file: UploadedFile): string {
    return `${file.original_filename}${file.extension || ""}`;
  }

  needsFile(): boolean {
    return FILE_HINT_TYPES.includes(this.hint.type);
  }

  needsThumb(): boolean {
    return THUMB_HINT_TYPES.includes(this.hint.type);
  }

  needsCaption(): boolean {
    return CAPTION_HINT_TYPES.includes(this.hint.type);
  }

  needsCaptionAbove(): boolean {
    return CAPTION_ABOVE_HINT_TYPES.includes(this.hint.type);
  }

  onRemove() {
    this.remove.emit();
  }
}
