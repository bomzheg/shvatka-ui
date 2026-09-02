import {Component, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {Router, RouterLink} from "@angular/router";
import {ConstructorService} from "./constructor.service";
import {MyGame, STATUS_LABELS} from "./constructor.models";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";

@Component({
  selector: "app-constructor",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./constructor.component.html",
  styleUrl: "./constructor.component.scss",
})
export class ConstructorComponent implements OnInit {
  games: MyGame[] | undefined;
  isLoading = false;
  newGameName = "";
  isCreating = false;
  isImporting = false;

  constructor(
    private constructorService: ConstructorService,
    private userService: UserService,
    private snackbar: SnackbarService,
    private router: Router,
  ) {
  }

  async ngOnInit() {
    if (!this.userService.isUserLoaded()) {
      await this.userService.loadMe();
    }
    if (this.isAuthenticated) {
      this.loadGames();
    }
  }

  get isAuthenticated(): boolean {
    return this.userService.isUserLoaded();
  }

  loadGames() {
    this.isLoading = true;
    this.constructorService.listMyGames().subscribe({
      next: page => {
        this.games = page.content ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.games = [];
        this.isLoading = false;
      },
    });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  /**
   * Write a whole game from a zip package — the scenario with its media.
   *
   * The package names the game, so what lands where is the server's call: a new
   * draft, or the author's own game of that name rewritten. Either way the
   * editor of that game is where the author continues.
   */
  onZipSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    this.isImporting = true;
    this.constructorService.importZip(file).subscribe({
      next: game => {
        this.isImporting = false;
        this.snackbar.success(`Игра «${game.name}» загружена`);
        this.router.navigate(["/games/constructor", game.id]);
      },
      error: () => {
        this.isImporting = false;
      },
    });
  }

  createGame() {
    const name = this.newGameName.trim();
    if (!name) {
      this.snackbar.error("Введите название игры");
      return;
    }

    this.isCreating = true;
    this.constructorService.createGame(name).subscribe({
      next: game => {
        this.isCreating = false;
        this.newGameName = "";
        this.snackbar.success("Игра создана");
        this.router.navigate(["/games/constructor", game.id]);
      },
      error: () => {
        this.isCreating = false;
      },
    });
  }
}
