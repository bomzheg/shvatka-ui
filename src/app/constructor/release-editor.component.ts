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
 * The game's release — the promo published before it: a banner, some text
 * about the theme, a map. It is an ordinary list of hint parts, so it is
 * edited with the same hint editors as the scenario.
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

  hints: HintPayload[] = [];
  /** True once it stands in the announcements channel. */
  isPublished = false;
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

  /** What saving will do with the channel, in the game's current status. */
  get announceHint(): string {
    if (this.isPublished) {
      return "Релиз уже в канале — правки обновят те же сообщения.";
    }
    if (this.gameStatus === "getting_waivers") {
      return "Идёт сбор вейверов — релиз уйдёт в канал сразу после сохранения.";
    }
    if (this.gameStatus === "underconstruction" || this.gameStatus === "ready") {
      return "Релиз уйдёт в канал, когда начнётся сбор вейверов.";
    }
    return "Игра уже началась — релиз будет виден на сайте, но в канал не пойдёт.";
  }

  addHint(type: HintType) {
    this.hints.push({type});
  }

  removeHint(index: number) {
    this.hints.splice(index, 1);
  }

  preview() {
    if (!this.hasHints) {
      this.snackbar.error("Релиз пуст — добавьте хотя бы одну часть");
      return;
    }

    this.isPreviewing = true;
  }

  backToEditing() {
    this.isPreviewing = false;
  }

  save() {
    if (!this.hasHints) {
      this.snackbar.error("Релиз пуст — добавьте хотя бы одну часть");
      return;
    }

    this.isSaving = true;
    this.constructorService.saveRelease(this.gameId, this.hints.map(h => cleanHint(h)))
      .pipe(finalize(() => this.isSaving = false))
      .subscribe({
        next: release => {
          this.apply(release);
          this.isPreviewing = false;
          this.snackbar.success(
            release.is_published ? "Релиз сохранён и опубликован" : "Релиз сохранён",
          );
        },
        error: error => this.snackbar.error(`Не удалось сохранить релиз: ${describeError(error)}`),
      });
  }

  remove() {
    this.constructorService.deleteRelease(this.gameId).subscribe({
      next: () => {
        this.hints = [];
        this.hasRelease = false;
        this.isPublished = false;
        this.snackbar.success("Релиз удалён");
      },
      error: error => this.snackbar.error(`Не удалось удалить релиз: ${describeError(error)}`),
    });
  }

  previewHints(): HintPart[] {
    return this.hints as HintPart[];
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
    this.hints = (release?.hints ?? []) as HintPayload[];
    this.hasRelease = release !== undefined;
    this.isPublished = release?.is_published === true;
  }
}
