import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {finalize} from "rxjs";
import {ConstructorService} from "./constructor.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {HintEditorComponent} from "./hint-editor.component";
import {HintTypePickerComponent} from "./hint-type-picker.component";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {cleanHint, describeError, HintPayload, UploadedFile} from "./constructor.models";
import {GameRelease, HintPart, HintType} from "../domain/game.models";
import {HttpAdapter} from "../http/http.adapter";
import {AppIcon} from "../ui/icons";
import {MatIcon} from "@angular/material/icon";

/**
 * The game's release — the promo published before it.
 *
 * It leads with a banner: a wide title picture with a caption, the one part
 * shown above the site's header. After it comes the rest — the theme, a map —
 * as an ordinary list of hint parts. Both are edited with the same hint
 * editors as the scenario; the banner is simply a photo part kept apart.
 *
 * Saving and announcing are separate: the engine decides when a release
 * reaches the announcements channel (with the start of the waivers), and
 * editing an already announced one edits it there. Entirely optional — a game
 * without a release is played exactly as before.
 */
@Component({
  selector: "app-release-editor",
  standalone: true,
  imports: [HintEditorComponent, HintTypePickerComponent, HintPartComponent, MatIcon],
  templateUrl: "./release-editor.component.html",
  styleUrl: "./release-editor.component.scss",
})
export class ReleaseEditorComponent implements OnInit {
  protected readonly AppIcon = AppIcon;

  @Input({required: true}) gameId!: number;
  @Input() files: UploadedFile[] = [];
  @Input() objectUrls?: Map<string, string>;
  /** Status of the game being edited — decides what the release copy says. */
  @Input() gameStatus = "";
  @Input() disabled = false;
  @Output() fileUploaded = new EventEmitter<UploadedFile>();
  @Output() fileRenamed = new EventEmitter<UploadedFile>();

  /** The wide title picture leading the release — a photo part, or nothing. */
  banner?: HintPayload;
  hints: HintPayload[] = [];
  hasRelease = false;
  isPreviewing = false;
  isLoading = false;
  isSaving = false;

  constructor(
    private constructorService: ConstructorService,
    private snackbar: SnackbarService,
    private http: HttpAdapter,
  ) {
  }

  ngOnInit() {
    this.load();
  }

  get hasHints(): boolean {
    return this.hints.length > 0;
  }

  /** Nothing to save while both the banner and the body are missing. */
  get isEmpty(): boolean {
    return !this.banner && !this.hasHints;
  }

  /** What saving will do with the channel, in the game's current status. */
  get announceHint(): string {
    if (this.gameStatus === "getting_waivers") {
      return "Идёт сбор вейверов — релиз в канале, правки обновят те же сообщения.";
    }
    if (this.gameStatus === "underconstruction" || this.gameStatus === "ready") {
      return "Релиз уйдёт в канал, когда начнётся сбор вейверов.";
    }
    return "Игра уже началась — в канал релиз не пойдёт, "
      + "но если он уже там, правки его обновят.";
  }

  addBanner() {
    this.banner = {type: HintType.photo};
  }

  removeBanner() {
    this.banner = undefined;
  }

  addHint(type: HintType) {
    this.hints.push({type});
  }

  removeHint(index: number) {
    this.hints.splice(index, 1);
  }

  preview() {
    if (this.isEmpty) {
      this.snackbar.error("Релиз пуст — добавьте баннер или хотя бы одну часть");
      return;
    }

    this.isPreviewing = true;
  }

  backToEditing() {
    this.isPreviewing = false;
  }

  save() {
    if (this.isEmpty) {
      this.snackbar.error("Релиз пуст — добавьте баннер или хотя бы одну часть");
      return;
    }

    if (this.banner && !this.banner.file_guid) {
      this.snackbar.error("Баннер без картинки — загрузите изображение или уберите баннер");
      return;
    }

    this.isSaving = true;
    const banner = this.banner ? cleanHint(this.banner) : undefined;
    this.constructorService.saveRelease(this.gameId, banner, this.hints.map(h => cleanHint(h)))
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: release => {
          this.apply(release);
          this.isPreviewing = false;
          this.snackbar.success("Релиз сохранён");
        },
        error: error => this.snackbar.error(`Не удалось сохранить релиз: ${describeError(error)}`),
      });
  }

  remove() {
    this.constructorService.deleteRelease(this.gameId).subscribe({
      next: () => {
        this.banner = undefined;
        this.hints = [];
        this.hasRelease = false;
        this.snackbar.success("Релиз удалён");
      },
      error: error => this.snackbar.error(`Не удалось удалить релиз: ${describeError(error)}`),
    });
  }

  /** The release as everyone will see it — the banner leads. */
  previewParts(): HintPart[] {
    const parts = this.banner ? [this.banner, ...this.hints] : this.hints;
    return parts as HintPart[];
  }

  fileUrl(hint: HintPart): string | undefined {
    return hint.file_guid ? this.http.getFileUrl(this.gameId, hint.file_guid) : undefined;
  }

  thumbUrl(hint: HintPart): string | undefined {
    return hint.thumb_guid ? this.http.getFileUrl(this.gameId, hint.thumb_guid) : undefined;
  }

  onHintFileUploaded(file: UploadedFile) {
    this.fileUploaded.emit(file);
  }

  onHintFileRenamed(file: UploadedFile) {
    this.fileRenamed.emit(file);
  }

  private load() {
    this.isLoading = true;
    this.constructorService.getRelease(this.gameId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: release => this.apply(release),
        error: error => this.snackbar.error(`Не удалось загрузить релиз: ${describeError(error)}`),
      });
  }

  private apply(release: GameRelease | undefined) {
    this.banner = release?.banner as HintPayload | undefined;
    this.hints = (release?.hints ?? []) as HintPayload[];
    this.hasRelease = release !== undefined;
  }
}
