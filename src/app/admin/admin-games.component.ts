import {Component, OnInit} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminGame} from './admin.models';
import {STATUS_LABELS} from '../constructor/constructor.models';
import {SnackbarService} from '../snackbar/snackbar.service';

/**
 * Games in the admin panel — statuses, and only statuses.
 *
 * The panel shows the games that stopped being drafts: the active ones
 * (collecting waivers, running, finished) and the completed ones. Of an active
 * game an admin sees the name, the author and the status and can change the
 * status; its scenario stays with the author and the orgs. Only a completed
 * game — public to everybody anyway — also links to the editor.
 *
 * Moving a game back to «в процессе создания» hands it to its author and is the
 * end of the admin's part in it: the game leaves this list, and the status of a
 * game that is not here cannot be changed again.
 */
@Component({
  selector: 'app-admin-games',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-games.component.html',
  styleUrl: './admin-games.component.scss',
})
export class AdminGamesComponent implements OnInit {
  games: AdminGame[] = [];
  isLoading = false;
  /** id of the game whose status is being saved right now */
  savingId: number | null = null;
  /** status picked in the select of each game, keyed by game id */
  targets: Record<number, string> = {};

  /** Every status a game may be moved to, in lifecycle order. */
  readonly statuses = [
    'underconstruction',
    'ready',
    'getting_waivers',
    'started',
    'finished',
    'complete',
  ];

  /** Statuses that keep a game in the panel — the rest hand it to its author. */
  private readonly visibleStatuses = ['getting_waivers', 'started', 'finished', 'complete'];

  constructor(
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Games still in play, waivers first — the usual reason to open this page. */
  get activeGames(): AdminGame[] {
    const order = ['getting_waivers', 'started', 'finished'];
    return this.games
      .filter(game => order.includes(game.status))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  }

  /** The archive, newest first. */
  get completedGames(): AdminGame[] {
    return this.games
      .filter(game => game.status === 'complete')
      .sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  startYear(game: AdminGame): string | null {
    if (!game.start_at) {
      return null;
    }
    const year = new Date(game.start_at).getFullYear();
    return Number.isNaN(year) ? null : String(year);
  }

  startedAt(game: AdminGame): string | null {
    if (!game.start_at) {
      return null;
    }
    const at = new Date(game.start_at);
    return Number.isNaN(at.getTime()) ? null : at.toLocaleString('ru-RU');
  }

  /** A status change is only worth saving when it is really a change. */
  canSave(game: AdminGame): boolean {
    const target = this.targets[game.id];
    return !!target && target !== game.status && this.savingId === null;
  }

  onTargetChange(game: AdminGame, event: Event): void {
    this.targets[game.id] = (event.target as HTMLSelectElement).value;
  }

  save(game: AdminGame): void {
    const target = this.targets[game.id];
    if (!target || target === game.status) {
      return;
    }
    if (!confirm(this.confirmText(game, target))) {
      return;
    }
    this.savingId = game.id;
    this.adminService.changeGameStatus(game.id, target)
      .pipe(finalize(() => { this.savingId = null; }))
      .subscribe({
        next: updated => {
          if (this.visibleStatuses.includes(updated.status)) {
            this.games = this.games.map(g => (g.id === updated.id ? updated : g));
            delete this.targets[game.id];
            this.snackbar.success(`Статус игры «${game.name}» — ${this.statusLabel(updated.status)}`);
          } else {
            // the game is its author's again, and the panel loses sight of it
            this.games = this.games.filter(g => g.id !== updated.id);
            delete this.targets[game.id];
            this.snackbar.success(
              `Игра «${game.name}» возвращена автору (${this.statusLabel(updated.status)})`
              + ' и больше не видна в админке',
            );
          }
        },
        error: err => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось изменить статус игры'));
        },
      });
  }

  private confirmText(game: AdminGame, target: string): string {
    const move = `Изменить статус игры «${game.name}»`
      + ` с «${this.statusLabel(game.status)}» на «${this.statusLabel(target)}»?`;
    if (this.visibleStatuses.includes(target)) {
      return move;
    }
    return `${move}\n\nИгра вернётся автору: она пропадёт из админки, и поменять её статус`
      + ' обратно будет уже нельзя. Запланированный старт при этом отменяется.';
  }

  private load(): void {
    this.isLoading = true;
    this.adminService.listAdminGames()
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: page => {
          this.games = [...page.content];
        },
        error: err => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось загрузить список игр'));
        },
      });
  }

  private errorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const description = typeof err.error === 'object' ? String(err.error?.description ?? '') : '';
      if (description) return description;
      if (err.status === 403) return 'Нужны права администратора движка';
    }
    return fallback;
  }
}
