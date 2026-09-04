import {Component, OnInit} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminGame} from './admin.models';
import {TeamDetails} from '../team/team.models';
import {STATUS_LABELS} from '../constructor/constructor.models';
import {SnackbarService} from '../snackbar/snackbar.service';

/**
 * Games in the admin panel — statuses, and only statuses. A game moved back to
 * «в процессе создания» is its author's again and leaves the list for good.
 *
 * What the two extra controls do is the engine's business, documented on
 * {@link AdminService.changeGameStatus} (purging a false start's run) and
 * {@link AdminService.resendCurrentLevel}.
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

  /** Statuses a game only reaches by having been played — the ones with a run. */
  private readonly playedStatuses = ['started', 'finished', 'complete'];

  /** Statuses that put a game back before its run. */
  private readonly rewoundStatuses = ['getting_waivers', 'ready', 'underconstruction'];

  /** Games whose run the admin ticked to purge along with the status change. */
  purgeRuntime: Record<number, boolean> = {};

  /** Teams playing the running game, offered as the resend target. */
  resendTeams: TeamDetails[] = [];
  /** Team picked for the resend; `null` means every team at once. */
  resendTarget: number | null = null;
  isResending = false;

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

  /** The one game being played, if any — only it has messages to resend. */
  get runningGame(): AdminGame | undefined {
    return this.games.find(game => game.status === 'started');
  }

  onResendTargetChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resendTarget = value === '' ? null : Number(value);
  }

  /**
   * Ask the engine to send the level's messages to the team (or to all of
   * them) again. Nothing of the level comes back here — the answer is the
   * teams it went to, which is all the button needs to report.
   */
  resend(): void {
    if (this.isResending) {
      return;
    }
    const team = this.resendTeams.find(t => t.id === this.resendTarget);
    const target = team ? `команде «${team.name}»` : 'всем командам';
    if (!confirm(`Переотправить сообщения текущего уровня ${target}?`)) {
      return;
    }
    this.isResending = true;
    this.adminService.resendCurrentLevel(this.resendTarget ?? undefined)
      .pipe(finalize(() => { this.isResending = false; }))
      .subscribe({
        next: sent => {
          this.snackbar.success(
            `Сообщения уровня отправлены заново: ${sent.items.length === 1
              ? sent.items[0].name
              : `команд — ${sent.items.length}`}`,
          );
        },
        error: err => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось переотправить сообщения уровня'));
        },
      });
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
    if (!this.canPurge(game)) {
      // the checkbox is gone from the form — don't let a stale tick ride along
      delete this.purgeRuntime[game.id];
    }
  }

  /**
   * Whether the move being set up is a rewind — a played game going back to a
   * status before its run. Only then is there a run to sweep, and only then
   * does the backend allow it.
   */
  canPurge(game: AdminGame): boolean {
    const target = this.targets[game.id];
    return !!target
      && this.playedStatuses.includes(game.status)
      && this.rewoundStatuses.includes(target);
  }

  onPurgeChange(game: AdminGame, event: Event): void {
    this.purgeRuntime[game.id] = (event.target as HTMLInputElement).checked;
  }

  save(game: AdminGame): void {
    const target = this.targets[game.id];
    if (!target || target === game.status) {
      return;
    }
    const purge = this.canPurge(game) && !!this.purgeRuntime[game.id];
    if (!confirm(this.confirmText(game, target, purge))) {
      return;
    }
    this.savingId = game.id;
    this.adminService.changeGameStatus(game.id, target, purge)
      .pipe(finalize(() => { this.savingId = null; }))
      .subscribe({
        next: updated => {
          if (this.visibleStatuses.includes(updated.status)) {
            this.games = this.games.map(g => (g.id === updated.id ? updated : g));
            delete this.targets[game.id];
            delete this.purgeRuntime[game.id];
            // a game that started (or stopped) changes who the resend may reach
            this.loadResendTeams();
            this.snackbar.success(
              `Статус игры «${game.name}» — ${this.statusLabel(updated.status)}`
              + (purge ? ', ход игры очищен' : ''),
            );
          } else {
            // the game is its author's again, and the panel loses sight of it
            this.games = this.games.filter(g => g.id !== updated.id);
            delete this.targets[game.id];
            delete this.purgeRuntime[game.id];
            this.loadResendTeams();
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

  private confirmText(game: AdminGame, target: string, purge: boolean): string {
    const move = `Изменить статус игры «${game.name}»`
      + ` с «${this.statusLabel(game.status)}» на «${this.statusLabel(target)}»?`;
    const parts = [move];
    if (!this.visibleStatuses.includes(target)) {
      parts.push('Игра вернётся автору: она пропадёт из админки, и поменять её статус'
        + ' обратно будет уже нельзя. Запланированный старт при этом отменяется.');
    }
    if (purge) {
      parts.push('ВНИМАНИЕ: весь ход игры будет удалён безвозвратно — время на уровнях,'
        + ' введённые ключи, бонусы и таймеры. Вейверы останутся.');
    }
    return parts.join('\n\n');
  }

  private load(): void {
    this.isLoading = true;
    this.adminService.listAdminGames()
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: page => {
          this.games = [...page.content];
          this.loadResendTeams();
        },
        error: err => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось загрузить список игр'));
        },
      });
  }

  /**
   * Who to offer the resend to. The waivers are what the panel already sees of
   * a running game — the teams that signed up — so the picker costs no new
   * sight of it.
   */
  private loadResendTeams(): void {
    const running = this.runningGame;
    this.resendTeams = [];
    this.resendTarget = null;
    if (!running) {
      return;
    }
    this.adminService.getGameWaivers(running.id).subscribe({
      next: waivers => {
        this.resendTeams = [...waivers.teams].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      },
      error: () => {
        // the button still works for everybody at once; only the picker is lost
        this.snackbar.error('Не удалось загрузить список команд идущей игры');
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
