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
