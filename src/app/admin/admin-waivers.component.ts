import {Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {GameWaivers, WaiverEntry} from './admin.models';
import {Game} from '../games/games.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {TeamDetails} from '../team/team.models';

@Component({
  selector: 'app-admin-waivers',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-waivers.component.html',
  styleUrl: './admin-waivers.component.scss',
})
export class AdminWaiversComponent implements OnInit {
  games: Game[] = [];
  selectedGameId: number | null = null;
  waivers: GameWaivers | null = null;
  isLoading = false;
  loadFailed = false;

  constructor(
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.adminService.listGames().subscribe({
      next: (page) => {
        // Latest games first, they are the usual moderation target.
        this.games = [...page.content].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
      },
      error: () => {
        this.snackbar.error('Не удалось загрузить список игр');
      },
    });
  }

  onGameChange(): void {
    if (this.selectedGameId === null) {
      this.waivers = null;
      return;
    }
    this.load(this.selectedGameId);
  }

  teamWaivers(team: TeamDetails): WaiverEntry[] {
    return this.waivers?.waivers[String(team.id)] ?? [];
  }

  private load(gameId: number): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.waivers = null;
    this.adminService.getGameWaivers(gameId)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (waivers) => { this.waivers = waivers; },
        error: (err) => {
          this.loadFailed = true;
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.snackbar.error('Игра не найдена');
            return;
          }
          this.snackbar.error('Не удалось загрузить вейверы');
        },
      });
  }
}
