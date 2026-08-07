import {Component, EventEmitter, Input, Output} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {HintType, RichFormat, RichMedia} from "../domain/game.models";
import {
  CAPTION_ABOVE_HINT_TYPES,
  CAPTION_HINT_TYPES,
  CONTENT_TYPE_LABELS,
  FILE_HINT_TYPES,
  HINT_TYPE_LABELS,
  HintPayload,
  SPOILER_HINT_TYPES,
  THUMB_HINT_TYPES,
  UploadedFile,
  UploadOptions,
  describeError,
  isHeicFile,
} from "./constructor.models";
import {ConstructorService} from "./constructor.service";
import {HeicUploadService} from "./heic-upload.service";
import {finalize} from "rxjs";
import {AdminService} from "../admin/admin.service";
import {HttpAdapter} from "../http/http.adapter";
import {SnackbarService} from "../snackbar/snackbar.service";
import {AppIcon, HINT_TYPE_ICON} from "../ui/icons";
import {ImageLightboxComponent} from "../ui/image-lightbox.component";
import {VideoNoteComponent} from "../ui/video-note.component";
import {MatIcon} from "@angular/material/icon";
import {HintTextEditorComponent} from "./hint-text-editor.component";

type PreviewKind = "image" | "video" | "video_note" | "audio" | "none";

@Component({
  selector: "app-hint-editor",
  standalone: true,
  imports: [FormsModule, ImageLightboxComponent, VideoNoteComponent, MatIcon, HintTextEditorComponent],
  templateUrl: "./hint-editor.component.html",
  styleUrl: "./hint-editor.component.scss",
})
export class HintEditorComponent {
  @Input({required: true}) hint!: HintPayload;
  @Input() files: UploadedFile[] = [];
  @Input() gameId: number | undefined;
  @Input() objectUrls?: Map<string, string>;
  @Input() disabled = false;
  /** Upload through the superuser endpoint (completed-game editing).
   *  Renaming is hidden in this mode — there is no admin rename endpoint. */
  @Input() adminUpload = false;
  @Output() remove = new EventEmitter<void>();
  @Output() fileUploaded = new EventEmitter<UploadedFile>();
  @Output() fileRenamed = new EventEmitter<UploadedFile>();

  protected readonly HintType = HintType;
  protected readonly AppIcon = AppIcon;
  protected readonly RichFormat = RichFormat;

  isUploading = false;
  /** "выбрать из загруженных" toggles the file/thumb picker dropdowns. */
  showFileBrowser = false;
  showThumbBrowser = false;

  /** Inline rename of the current main file. */
  isRenaming = false;
  showRename = false;
  renameValue = "";

  constructor(
    private constructorService: ConstructorService,
    private adminService: AdminService,
    private http: HttpAdapter,
    private snackbar: SnackbarService,
    private heicUpload: HeicUploadService,
  ) {
  }

  get typeIcon(): AppIcon {
    return HINT_TYPE_ICON[this.hint.type];
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
    return contentType ? `${name} (${contentType})` : name;
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

  needsSpoiler(): boolean {
    return SPOILER_HINT_TYPES.includes(this.hint.type);
  }

  /** Checkbox state: a stored `null` (no spoiler) has to read as unchecked. */
  get hasSpoiler(): boolean {
    return this.hint.has_spoiler === true;
  }

  set hasSpoiler(value: boolean) {
    this.hint.has_spoiler = value;
  }

  onRemove() {
    this.remove.emit();
  }

  // ---------------------------------------------------------------------
  // Rich message: markup plus the files it embeds
  // ---------------------------------------------------------------------

  /** Markup language of the hint; html unless the author says otherwise. */
  get richFormat(): RichFormat {
    return this.hint.format ?? RichFormat.html;
  }

  set richFormat(value: RichFormat) {
    this.hint.format = value;
  }

  richMedia(): RichMedia[] {
    if (!this.hint.media) {
      this.hint.media = [];
    }
    return this.hint.media;
  }

  /** A new media row, pre-named so the markup has something to refer to. */
  addRichMedia(): void {
    const media = this.richMedia();
    media.push({id: this.nextMediaId(media), file_guid: ""});
  }

  removeRichMedia(index: number): void {
    this.richMedia().splice(index, 1);
  }

  /** How the markup refers to this file: `<img src="id">` / `![](id)`. */
  richMediaReference(media: RichMedia): string {
    return this.richFormat === RichFormat.markdown
      ? `![](${media.id})`
      : `<img src="${media.id}">`;
  }

  copyRichMediaReference(media: RichMedia): void {
    navigator.clipboard?.writeText(this.richMediaReference(media)).then(() => {
      this.snackbar.success("Ссылка на вложение скопирована");
    });
  }

  /** Upload straight into a media row of the rich markup. */
  onRichMediaSelected(event: Event, media: RichMedia): void {
    this.upload(event, uploaded => {
      media.file_guid = uploaded.guid;
    });
  }

  /** Preview url of an embedded image; other media types have none here. */
  richMediaImageUrl(media: RichMedia): string | undefined {
    const file = this.files.find(f => f.guid === media.file_guid);
    return file?.content_type === "photo" ? this.fileUrlFor(media.file_guid) : undefined;
  }

  private nextMediaId(media: RichMedia[]): string {
    const taken = new Set(media.map(item => item.id));
    for (let i = 1; ; i++) {
      const id = `media${i}`;
      if (!taken.has(id)) {
        return id;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Upload (for an empty hint or to replace the current file)
  // ---------------------------------------------------------------------

  onUploadSelected(event: Event, target: "file" | "thumb") {
    this.upload(event, uploaded => {
      if (target === "file") {
        this.hint.file_guid = uploaded.guid;
        this.showFileBrowser = false;
      } else {
        this.hint.thumb_guid = uploaded.guid;
        this.showThumbBrowser = false;
      }
    });
  }

  /** Upload the picked file and hand the stored file to `apply`. */
  private upload(event: Event, apply: (uploaded: UploadedFile) => void) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.gameId === undefined) {
      return;
    }

    const gameId = this.gameId;
    this.isUploading = true;
    const uploadFn = (options?: UploadOptions) => this.adminUpload
      ? this.adminService.uploadGameFile(gameId, file, options)
      : this.constructorService.uploadFile(gameId, file, options);
    this.heicUpload.upload(file, uploadFn).pipe(
      finalize(() => {
        this.isUploading = false;
        input.value = "";
      }),
    ).subscribe({
      next: uploaded => {
        if (!uploaded || !uploaded.guid) {
          this.snackbar.error("Сервер вернул файл без идентификатора");
          return;
        }
        // A HEIC source can't render locally (converted → server JPEG previews
        // instead; kept as-is → no preview), so skip the object URL for it.
        if (!isHeicFile(file)) {
          this.objectUrls?.set(uploaded.guid, URL.createObjectURL(file));
        }
        this.fileUploaded.emit(uploaded);
        apply(uploaded);
        this.snackbar.success(`Файл загружен: ${uploaded.original_filename}${uploaded.extension}`);
      },
      error: err => {
        this.snackbar.error(`Не удалось загрузить файл: ${describeError(err)}`);
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
        return "video";
      case HintType.video_note:
        return "video_note";
      case HintType.audio:
      case HintType.voice:
        return "audio";
      default:
        return "none";
    }
  }

  previewUrl(): string | undefined {
    return this.fileUrlFor(this.hint.file_guid);
  }

  /** Thumbnails are always images, so they get an image preview when set. */
  thumbPreviewUrl(): string | undefined {
    return this.fileUrlFor(this.hint.thumb_guid);
  }

  private fileUrlFor(guid: string | undefined): string | undefined {
    if (!guid) {
      return undefined;
    }
    const local = this.objectUrls?.get(guid);
    if (local) {
      return local;
    }
    if (this.gameId === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.gameId, guid);
  }

  toggleFileBrowser() {
    this.showFileBrowser = !this.showFileBrowser;
  }

  toggleThumbBrowser() {
    this.showThumbBrowser = !this.showThumbBrowser;
  }

  currentFileLabel(): string | undefined {
    const f = this.files.find(file => file.guid === this.hint.file_guid);
    return f ? this.fileLabel(f) : undefined;
  }

  currentThumbLabel(): string | undefined {
    const f = this.files.find(file => file.guid === this.hint.thumb_guid);
    return f ? this.fileLabel(f) : undefined;
  }

  // ---------------------------------------------------------------------
  // Rename the current main file
  // ---------------------------------------------------------------------

  /** The uploaded-file entry the main hint file points at, if known. */
  currentFile(): UploadedFile | undefined {
    return this.files.find(file => file.guid === this.hint.file_guid);
  }

  /** Editable base name (without the server-managed extension). */
  private baseName(file: UploadedFile): string {
    const hasName = file.original_filename && file.original_filename !== file.guid;
    return hasName ? file.original_filename : "";
  }

  startRename() {
    const file = this.currentFile();
    if (!file) {
      return;
    }
    this.renameValue = this.baseName(file);
    this.showRename = true;
  }

  cancelRename() {
    this.showRename = false;
    this.renameValue = "";
  }

  confirmRename() {
    const file = this.currentFile();
    if (!file || this.gameId === undefined) {
      return;
    }
    const filename = this.renameValue.trim();
    if (!filename) {
      this.snackbar.error("Имя файла не может быть пустым");
      return;
    }
    if (filename === this.baseName(file)) {
      this.cancelRename();
      return;
    }

    this.isRenaming = true;
    this.constructorService.renameFile(this.gameId, file.guid, filename).subscribe({
      next: updated => {
        // Prefer the server echo; fall back to the entered base name, keeping
        // the existing extension (the server stores it as a separate field).
        const result: UploadedFile = updated && updated.guid
          ? {...file, ...updated}
          : {...file, original_filename: filename};
        this.isRenaming = false;
        this.cancelRename();
        this.fileRenamed.emit(result);
        this.snackbar.success("Файл переименован");
      },
      error: err => {
        this.isRenaming = false;
        this.snackbar.error(`Не удалось переименовать файл: ${describeError(err)}`);
      },
    });
  }
}
