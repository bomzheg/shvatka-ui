import {Component, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {ConstructorService} from "./constructor.service";
import {AdminService} from "../admin/admin.service";
import {ReleaseEditorComponent} from "./release-editor.component";
import {Breadcrumb, BreadcrumbsComponent} from "../ui/breadcrumbs/breadcrumbs.component";
import {UploadedFile} from "./constructor.models";
import {FullGame} from "../domain/game.models";

/**
 * The release of a game, on a page of its own.
 *
 * It shares nothing with the scenario but the game it belongs to, and having
 * both on one screen put two unrelated "Сохранить" buttons next to each other.
 * The scenario editor links here instead; the crumbs lead back.
 */
@Component({
  selector: "app-release-page",
  standalone: true,
  imports: [ReleaseEditorComponent, BreadcrumbsComponent],
  templateUrl: "./release-page.component.html",
  styleUrl: "./release-page.component.scss",
})
export class ReleasePageComponent implements OnInit, OnDestroy {
  gameId = 0;
  /** Set by the route: an admin edits a complete game's release, nobody else. */
  adminMode = false;
  game: FullGame | undefined;
  files: UploadedFile[] = [];
  /** Local previews of files uploaded here, filled in by the hint editors. */
  objectUrls = new Map<string, string>();
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private constructorService: ConstructorService,
    private adminService: AdminService,
  ) {
  }

  ngOnInit() {
    this.adminMode = this.route.snapshot.data["admin"] === true;
    this.route.paramMap.subscribe((params: ParamMap) => {
      this.gameId = Number(params.get("id"));
      if (!Number.isNaN(this.gameId)) {
        this.load();
      }
    });
  }

  ngOnDestroy() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
  }

  get status(): string {
    return this.game?.status ?? "";
  }

  /** A complete game's release is the admin's alone — see the engine's rules. */
  get canEdit(): boolean {
    return this.adminMode || this.status !== "complete";
  }

  getBreadcrumbs(): Breadcrumb[] {
    const games: Breadcrumb = this.adminMode
      ? {label: "Игры (админ)", link: "/admin/games"}
      : {label: "Мои игры", link: "/games/constructor"};
    return [
      games,
      {label: this.game?.name ?? "Игра", link: this.editorLink()},
      {label: "Релиз"},
    ];
  }

  onFileUploaded(file: UploadedFile) {
    this.files = [...this.files.filter(f => f.guid !== file.guid), file];
  }

  onFileRenamed(file: UploadedFile) {
    this.files = this.files.map(f => (f.guid === file.guid ? {...f, ...file} : f));
  }

  private editorLink(): string {
    return this.adminMode ? `/admin/games/${this.gameId}` : `/games/constructor/${this.gameId}`;
  }

  /**
   * The game is loaded for its name and status only — the release itself is
   * the editor's business. `files` lets "выбрать из загруженных" offer what
   * the game already has.
   */
  private load() {
    this.isLoading = true;
    const source = this.adminMode
      ? this.adminService.getGame(this.gameId)
      : this.constructorService.getGame(this.gameId);
    source.subscribe({
      next: game => {
        this.game = game;
        const provided = (game as unknown as {files?: UploadedFile[]}).files;
        this.files = Array.isArray(provided) ? provided : [];
        this.isLoading = false;
      },
      error: () => this.isLoading = false,
    });
  }
}
