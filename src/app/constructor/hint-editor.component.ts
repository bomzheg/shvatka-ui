import {Component, EventEmitter, Input, Output} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {HintType} from "../domain/game.models";
import {
  CAPTION_ABOVE_HINT_TYPES,
  CAPTION_HINT_TYPES,
  CONTENT_TYPE_LABELS,
  FILE_HINT_TYPES,
  HINT_TYPE_LABELS,
  HintPayload,
  THUMB_HINT_TYPES,
  UploadedFile,
} from "./constructor.models";
import {ConstructorService} from "./constructor.service";
import {HttpAdapter} from "../http/http.adapter";
import {SnackbarService} from "../snackbar/snackbar.service";
import {CONTENT_TYPE_EMOJI, HINT_TYPE_EMOJI} from "../ui/emoji";
import {ImageLightboxComponent} from "../ui/image-lightbox.component";

type PreviewKind = "image" | "video" | "audio" | "none";

@Component({
  selector: "app-hint-editor",
  standalone: true,
  imports: [FormsModule, ImageLightboxComponent],
  templateUrl: "./hint-editor.component.html",
  styleUrl: "./hint-editor.component.scss",
})
export class HintEditorComponent {
  @Input({required: true}) hint!: HintPayload;
  @Input() files: UploadedFile[] = [];
  @Input() gameId: number | undefined;
  @Input() disabled = false;
  @Output() remove = new EventEmitter<void>();
  @Output() fileUploaded = new EventEmitter<UploadedFile>();

  protected readonly HintType = HintType;

  isUploading = false;

  constructor(
    private constructorService: ConstructorService,
    private http: HttpAdapter,
    private snackbar: SnackbarService,
  ) {
  }

  get typeEmoji(): string {
    return HINT_TYPE_EMOJI[this.hint.type];
  }

  get typeLabel(): string {
    return HINT_TYPE_LABELS[this.hint.type];
  }

  /** Single "lat, lon" field — matches what users paste from map apps. */
  get coords(): string {
    const lat = this.hint.latitude;
    const lon = this.hint.longitude;
    if (lat === undefined && lon === undefined) {
      return "";
    }
    return `${lat ?? ""}, ${lon ?? ""}`;
  }

  set coords(value: string) {
    const parts = value.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
    const lat = parts[0] !== undefined ? Number(parts[0]) : NaN;
    const lon = parts[1] !== undefined ? Number(parts[1]) : NaN;
    this.hint.latitude = Number.isFinite(lat) ? lat : undefined;
    this.hint.longitude = Number.isFinite(lon) ? lon : undefined;
  }

  fileLabel(file: UploadedFile): string {
    const hasName = file.original_filename && file.original_filename !== file.guid;
    const name = hasName
      ? `${file.original_filename}${file.extension || ""}`
      : `файл ${file.guid.slice(0, 8)}…`;
    const contentType = file.content_type ? CONTENT_TYPE_LABELS[file.content_type] ?? file.content_type : undefined;
    const emoji = file.content_type ? CONTENT_TYPE_EMOJI[file.content_type] ?? "" : "";
    return contentType ? `${emoji} ${name} (${contentType})` : name;
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

  // ---------------------------------------------------------------------
  // Upload (for an empty hint or to replace the current file)
  // ---------------------------------------------------------------------

  onUploadSelected(event: Event, target: "file" | "thumb") {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.gameId === undefined) {
      return;
    }

    this.isUploading = true;
    this.constructorService.uploadFile(this.gameId, file).subscribe({
      next: uploaded => {
        this.isUploading = false;
        input.value = "";
        this.fileUploaded.emit(uploaded);
        if (target === "file") {
          this.hint.file_guid = uploaded.guid;
        } else {
          this.hint.thumb_guid = uploaded.guid;
        }
        this.snackbar.success(`Файл загружен: ${uploaded.original_filename}${uploaded.extension}`);
      },
      error: () => {
        this.isUploading = false;
        input.value = "";
      },
    });
  }

  // ---------------------------------------------------------------------
  // Preview of the selected file
  // ---------------------------------------------------------------------

  previewKind(): PreviewKind {
    if (!this.hint.file_guid) {
      return "none";
    }
    switch (this.hint.type) {
      case HintType.photo:
      case HintType.sticker:
        return "image";
      case HintType.video:
      case HintType.animation:
      case HintType.video_note:
        return "video";
      case HintType.audio:
      case HintType.voice:
        return "audio";
      default:
        return "none";
    }
  }

  previewUrl(): string | undefined {
    if (!this.hint.file_guid || this.gameId === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.gameId, this.hint.file_guid);
  }
}
