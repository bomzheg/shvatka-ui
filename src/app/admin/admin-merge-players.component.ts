import {Component, OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {catchError, forkJoin, of} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminPlayerDetails, AdminPlayerListItem} from './admin.models';
import {TeamService} from '../team/team.service';
import {PlayerStat, PlayerTg, TeamPlayerHistory} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';

/** One side (primary or secondary) of the player merge preview. */
interface MergeSide {
  query: string;
  results: AdminPlayerListItem[];
  searching: boolean;
  detail: AdminPlayerDetails | null;
  stat: PlayerStat | null;
  loading: boolean;
}

function emptySide(): MergeSide {
  return {query: '', results: [], searching: false, detail: null, stat: null, loading: false};
}

@Component({
  selector: 'app-admin-merge-players',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-merge-players.component.html',
  styleUrl: './admin-merge-players.component.scss',
})
export class AdminMergePlayersComponent implements OnDestroy {
  primary: MergeSide = emptySide();
  secondary: MergeSide = emptySide();

  confirmChecked = false;
  isMerging = false;

  private searchTimers: {primary?: ReturnType<typeof setTimeout>; secondary?: ReturnType<typeof setTimeout>} = {};

  constructor(
    private adminService: AdminService,
    private teamService: TeamService,
    private snackbar: SnackbarService,
    private router: Router,
  ) {}

  ngOnDestroy(): void {
    if (this.searchTimers.primary) clearTimeout(this.searchTimers.primary);
    if (this.searchTimers.secondary) clearTimeout(this.searchTimers.secondary);
  }

  side(role: 'primary' | 'secondary'): MergeSide {
    return role === 'primary' ? this.primary : this.secondary;
  }

  onQueryChange(role: 'primary' | 'secondary', value: string): void {
    const side = this.side(role);
    side.query = value;
    if (this.searchTimers[role]) clearTimeout(this.searchTimers[role]);
    const query = value.trim();
    if (!query) {
      side.results = [];
      return;
    }
    this.searchTimers[role] = setTimeout(() => this.search(role, query), 350);
  }

  select(role: 'primary' | 'secondary', player: AdminPlayerListItem): void {
    const side = this.side(role);
    side.results = [];
    side.query = player.username || player.name_mention;
    side.loading = true;
    side.detail = null;
    side.stat = null;
    this.confirmChecked = false;

    forkJoin({
      detail: this.adminService.getPlayer(player.id),
      stat: this.teamService.getPlayerStat(player.id).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({detail, stat}) => {
        side.loading = false;
        side.detail = detail;
        side.stat = stat;
      },
      error: () => {
        side.loading = false;
        this.snackbar.error('Не удалось загрузить данные игрока');
      },
    });
  }

  clear(role: 'primary' | 'secondary'): void {
    if (role === 'primary') {
      this.primary = emptySide();
    } else {
      this.secondary = emptySide();
    }
    this.confirmChecked = false;
  }

  get bothSelected(): boolean {
    return this.primary.detail !== null && this.secondary.detail !== null;
  }

  get sameId(): boolean {
    return this.bothSelected && this.primary.detail!.id === this.secondary.detail!.id;
  }

  /** Pre-merge hints for conditions the server is known to reject or trip over. */
  get warnings(): string[] {
    if (!this.bothSelected || this.sameId) return [];
    const warnings: string[] = [];
    if (this.secondary.detail!.tg) {
      warnings.push('У вливаемого игрока привязан telegram — сервер отклонит слияние. Сначала перепривяжите его telegram другому игроку или этому основному.');
    }
    if (this.primary.detail!.forum && this.secondary.detail!.forum) {
      warnings.push('У обоих игроков есть форумный аккаунт — сервер отклонит слияние.');
    }
    if (this.historiesOverlap()) {
      warnings.push('Истории команд пересекаются по времени — автоматическое слияние может не сработать (сервер вернёт ошибку).');
    }
    return warnings;
  }

  tgLabel(tg: PlayerTg): string {
    if (tg.username) return '@' + tg.username;
    const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ');
    return name || String(tg.tg_id);
  }

  historyLabel(entry: TeamPlayerHistory): string {
    const team = entry.team?.name ?? 'команда удалена';
    const from = entry.date_joined?.slice(0, 10) ?? '?';
    const to = entry.date_left ? entry.date_left.slice(0, 10) : 'по настоящее время';
    return `${team}: ${from} — ${to}${entry.role ? `, ${entry.role}` : ''}`;
  }

  merge(): void {
    if (!this.bothSelected || this.sameId || !this.confirmChecked || this.isMerging) return;
    const primaryId = this.primary.detail!.id;
    const secondaryId = this.secondary.detail!.id;

    this.isMerging = true;
    this.adminService.mergePlayers(primaryId, secondaryId).subscribe({
      next: () => {
        this.isMerging = false;
        this.snackbar.success('Игроки объединены');
        this.router.navigate(['/admin/players', primaryId]);
      },
      error: (err) => {
        this.isMerging = false;
        this.snackbar.error(this.mergeErrorMessage(err));
      },
    });
  }

  private search(role: 'primary' | 'secondary', query: string): void {
    const side = this.side(role);
    side.searching = true;
    // Merge candidates are often archived players (no tg/email), so search both.
    this.adminService.listPlayers({username: query, active: true, archive: true}).subscribe({
      next: (res) => {
        side.searching = false;
        side.results = res.items;
      },
      error: () => {
        side.searching = false;
        this.snackbar.error('Не удалось выполнить поиск игроков');
      },
    });
  }

  private historiesOverlap(): boolean {
    const a = this.primary.stat?.team_history ?? [];
    const b = this.secondary.stat?.team_history ?? [];
    for (const x of a) {
      const xStart = Date.parse(x.date_joined);
      const xEnd = x.date_left ? Date.parse(x.date_left) : Infinity;
      for (const y of b) {
        const yStart = Date.parse(y.date_joined);
        const yEnd = y.date_left ? Date.parse(y.date_left) : Infinity;
        if (xStart < yEnd && yStart < xEnd) {
          return true;
        }
      }
    }
    return false;
  }

  private mergeErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const description = typeof err.error === 'object' ? String(err.error?.description ?? '') : '';
      if (err.status === 422) {
        return description || 'Сервер отклонил слияние: проверьте telegram вливаемого и форумные аккаунты';
      }
      if (err.status === 404) {
        return 'Игрок не найден';
      }
      if (err.status === 500) {
        return description || 'Не удалось объединить автоматически (истории команд пересекаются)';
      }
    }
    return 'Не удалось объединить игроков';
  }
}
