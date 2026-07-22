import {Component, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AdminService} from './admin.service';
import {Game} from '../games/games.service';
import {SnackbarService} from '../snackbar/snackbar.service';

@Component({
  selector: 'app-admin-games',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-games.component.html',
  styleUrl: './admin-games.component.scss',
})
export class AdminGamesComponent implements OnInit {
  games: Game[] = [];
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.adminService.listGames().subscribe({
      next: (page) => {
        // Latest games first, they are the usual moderation target.
        this.games = [...page.content].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackbar.error('Не удалось загрузить список игр');
      },
    });
  }

  startYear(game: Game): string | null {
    if (!game.start_at) {
      return null;
    }
    const year = new Date(game.start_at).getFullYear();
    return Number.isNaN(year) ? null : String(year);
  }
}
