import {Component, OnInit} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {RouterLink} from "@angular/router";
import {ActiveGame, GamesService} from "../games/games.service";
import {GameRelease, HintPart} from "../domain/game.models";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HttpAdapter} from "../http/http.adapter";

/**
 * The main page. Besides the welcome, it carries the full release of the
 * active game — the header only has room for its banner — and the link on to
 * the waivers.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgOptimizedImage,
    RouterLink,
    HintPartComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  activeGame: ActiveGame | undefined;
  release: GameRelease | undefined;

  constructor(
    private gamesService: GamesService,
    private http: HttpAdapter,
  ) {
  }

  ngOnInit() {
    this.gamesService.getActiveGame().subscribe({
      next: game => {
        this.activeGame = game;
        this.loadRelease(game);
      },
      error: () => this.release = undefined,
    });
  }

  hasRelease(): boolean {
    return this.releaseParts().length > 0;
  }

  /** The release as it was written — the banner leads. */
  releaseParts(): HintPart[] {
    if (!this.release) {
      return [];
    }

    return this.release.banner ? [this.release.banner, ...this.release.hints] : this.release.hints;
  }

  gameName(): string {
    return this.activeGame?.name ?? "";
  }

  /** Waivers are still open — worth sending a reader of the release there. */
  isGettingWaivers(): boolean {
    return this.activeGame?.status === "getting_waivers";
  }

  fileUrl(hint: HintPart): string | undefined {
    return this.urlFor(hint.file_guid);
  }

  thumbUrl(hint: HintPart): string | undefined {
    return this.urlFor(hint.thumb_guid);
  }

  /** A release is optional — a game without one just shows the welcome. */
  private loadRelease(game: ActiveGame | undefined) {
    if (!game) {
      this.release = undefined;
      return;
    }

    this.gamesService.getRelease(game.id).subscribe({
      next: release => this.release = release,
      error: () => this.release = undefined,
    });
  }

  private urlFor(guid: string | undefined): string | undefined {
    if (!guid || !this.release) {
      return undefined;
    }

    return this.http.getFileUrl(this.release.game_id, guid);
  }
}
