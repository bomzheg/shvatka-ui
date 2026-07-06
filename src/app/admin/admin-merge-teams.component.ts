import {Component, OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {catchError, forkJoin, of} from 'rxjs';
import {AdminService} from './admin.service';
import {TeamService} from '../team/team.service';
import {PlayedGame, TeamDetails, TeamMember} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';

/** One side (primary or secondary) of the team merge preview. */
interface MergeSide {
  query: string;
  results: TeamDetails[];
  searching: boolean;
  team: TeamDetails | null;
  players: TeamMember[];
  playedGames: PlayedGame[] | null;
  loading: boolean;
}

function emptySide(): MergeSide {
  return {query: '', results: [], searching: false, team: null, players: [], playedGames: null, loading: false};
}

@Component({
  selector: 'app-admin-merge-teams',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-merge-teams.component.html',
  styleUrl: './admin-merge-teams.component.scss',
})
export class AdminMergeTeamsComponent implements OnDestroy {
  primary: MergeSide = emptySide();
  secondary: MergeSide = emptySide();

  confirmChecked = false;
  isMerging = false;

  private searchTimers: {primary?: ReturnType<typeof setTimeout>; secondary?: ReturnType<typeof setTimeout>} = {};

  constructor(
    private adminService: AdminService,
    private teamService: TeamService,
    private snackbar: SnackbarService,
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

  select(role: 'primary' | 'secondary', team: TeamDetails): void {
    const side = this.side(role);
    side.results = [];
    side.query = team.name;
    side.loading = true;
    side.team = null;
    side.players = [];
    side.playedGames = null;
    this.confirmChecked = false;

    forkJoin({
      players: this.teamService.getTeamPlayers(team.id).pipe(catchError(() => of({items: [] as TeamMember[]}))),
      stat: this.teamService.getTeamStat(team.id).pipe(catchError(() => of(null))),
    }).subscribe(({players, stat}) => {
      side.loading = false;
      side.team = team;
      side.players = players.items;
      side.playedGames = stat?.items ?? null;
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
    return this.primary.team !== null && this.secondary.team !== null;
  }

  get sameId(): boolean {
    return this.bothSelected && this.primary.team!.id === this.secondary.team!.id;
  }

  memberLabel(member: TeamMember): string {
    const name = member.username || `#${member.id}`;
    const emoji = member.emoji ? `${member.emoji} ` : '';
    return member.role ? `${emoji}${name} — ${member.role}` : `${emoji}${name}`;
  }

  merge(): void {
    if (!this.bothSelected || this.sameId || !this.confirmChecked || this.isMerging) return;
    const primary = this.primary.team!;
    const secondaryName = this.secondary.team!.name;

    this.isMerging = true;
    this.adminService.mergeTeams(primary.id, this.secondary.team!.id).subscribe({
      next: () => {
        this.isMerging = false;
        this.snackbar.success(`Команда «${secondaryName}» влита в «${primary.name}»`);
        // Reload the primary side to show the post-merge roster; drop the secondary.
        this.secondary = emptySide();
        this.confirmChecked = false;
        this.select('primary', primary);
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
    // Merge candidates are often archived (forum-era) teams, so search both.
    this.teamService.listTeams({active: true, archive: true, search: query}).subscribe({
      next: (res) => {
        side.searching = false;
        side.results = res.items;
      },
      error: () => {
        side.searching = false;
        this.snackbar.error('Не удалось выполнить поиск команд');
      },
    });
  }

  private mergeErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const description = typeof err.error === 'object' ? String(err.error?.description ?? '') : '';
      if (err.status === 422) {
        return description || 'Сервер отклонил слияние: у вливаемой команды ещё есть активный чат, либо у основной уже есть форумная команда';
      }
      if (err.status === 404) {
        return 'Команда не найдена';
      }
    }
    return 'Не удалось объединить команды';
  }
}
