import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {TeamService} from '../team/team.service';
import {TeamDetails, TeamMember} from '../team/team.models';
import {AdminPlayerListItem} from './admin.models';
import {SnackbarService} from '../snackbar/snackbar.service';
import {memberEmoji} from '../ui/role-emoji';

/**
 * Team membership as the engine's admin sees it: appoint a captain, add and
 * remove players, all without holding any permission inside the team. The
 * captain's own screen is «Капитанский мостик» — this one is what unblocks a
 * team whose captain is gone.
 */
@Component({
  selector: 'app-admin-teams',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-teams.component.html',
  styleUrl: './admin-teams.component.scss',
})
export class AdminTeamsComponent implements OnInit, OnDestroy {
  query = '';
  results: TeamDetails[] = [];
  isSearching = false;

  team: TeamDetails | null = null;
  members: TeamMember[] = [];
  isLoadingTeam = false;

  promotingPlayerId: number | null = null;
  removingPlayerId: number | null = null;

  playerQuery = '';
  playerResults: AdminPlayerListItem[] = [];
  isSearchingPlayers = false;
  selectedPlayer: AdminPlayerListItem | null = null;
  addRole = '';
  addEmoji = '';
  isAddingPlayer = false;

  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private playerSearchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private adminService: AdminService,
    private teamService: TeamService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute,
  ) {}

  /** `?team=<id>` opens a team straight away (deep link from another admin screen). */
  ngOnInit(): void {
    const teamId = Number(this.route.snapshot.queryParamMap.get('team'));
    if (Number.isInteger(teamId) && teamId > 0) {
      this.selectById(teamId);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.playerSearchTimer) clearTimeout(this.playerSearchTimer);
  }

  // ── Picking a team ───────────────────────────────────────────────────────────

  onQueryChange(value: string): void {
    this.query = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = value.trim();
    if (!query) {
      this.results = [];
      return;
    }
    this.searchTimer = setTimeout(() => this.search(query), 350);
  }

  select(team: TeamDetails): void {
    this.results = [];
    this.query = team.name;
    this.team = team;
    this.resetAddPlayerForm();
    this.loadMembers(team.id);
  }

  clear(): void {
    this.query = '';
    this.results = [];
    this.team = null;
    this.members = [];
    this.resetAddPlayerForm();
  }

  isCaptain(member: TeamMember): boolean {
    return this.team?.captain?.id === member.id;
  }

  memberName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  memberEmoji(member: TeamMember): string {
    return memberEmoji(member.emoji, member.role);
  }

  get sortedMembers(): TeamMember[] {
    const captainId = this.team?.captain?.id;
    return [...this.members].sort((a, b) => {
      const aCap = a.id === captainId ? 0 : 1;
      const bCap = b.id === captainId ? 0 : 1;
      if (aCap !== bCap) return aCap - bCap;
      return this.memberName(a).localeCompare(this.memberName(b));
    });
  }

  // ── Acting on the team ───────────────────────────────────────────────────────

  makeCaptain(member: TeamMember): void {
    if (!this.team || this.promotingPlayerId !== null) return;
    const name = this.memberName(member);
    const current = this.team.captain?.name_mention ?? 'никто';
    if (!confirm(
      `Сделать ${name} капитаном команды «${this.team.name}»? Сейчас капитан — ${current}.`,
    )) return;

    const teamId = this.team.id;
    this.promotingPlayerId = member.id;
    this.adminService.changeTeamCaptain(teamId, member.id)
      .pipe(finalize(() => { this.promotingPlayerId = null; }))
      .subscribe({
        next: (updated) => {
          this.team = updated;
          this.snackbar.success(`${name} — новый капитан команды`);
          this.loadMembers(teamId);
        },
        error: (err) => { this.snackbar.error(this.errorMessage(err, 'Не удалось сменить капитана')); },
      });
  }

  removePlayer(member: TeamMember): void {
    if (!this.team || this.removingPlayerId !== null) return;
    const name = this.memberName(member);
    if (!confirm(`Исключить ${name} из команды «${this.team.name}»?`)) return;

    const teamId = this.team.id;
    this.removingPlayerId = member.id;
    this.adminService.removePlayerFromTeam(teamId, member.id)
      .pipe(finalize(() => { this.removingPlayerId = null; }))
      .subscribe({
        next: () => {
          this.members = this.members.filter(m => m.id !== member.id);
          this.snackbar.success(`${name} исключён из команды`);
          // the captain may have just left — reload the card to show it
          this.reloadTeam(teamId);
        },
        error: (err) => { this.snackbar.error(this.errorMessage(err, 'Не удалось исключить игрока')); },
      });
  }

  // ── Adding a player ──────────────────────────────────────────────────────────

  onPlayerQueryChange(value: string): void {
    this.playerQuery = value;
    this.selectedPlayer = null;
    if (this.playerSearchTimer) clearTimeout(this.playerSearchTimer);
    const query = value.trim();
    if (!query) {
      this.playerResults = [];
      return;
    }
    this.playerSearchTimer = setTimeout(() => this.searchPlayers(query), 350);
  }

  selectPlayer(player: AdminPlayerListItem): void {
    this.selectedPlayer = player;
    this.playerQuery = player.name_mention;
    this.playerResults = [];
  }

  addPlayer(): void {
    if (!this.team || !this.selectedPlayer || this.isAddingPlayer) return;
    const player = this.selectedPlayer;
    const teamId = this.team.id;

    this.isAddingPlayer = true;
    this.adminService.addPlayerToTeam(
      teamId,
      player.id,
      this.addRole.trim() || undefined,
      this.addEmoji.trim() || undefined,
    )
      .pipe(finalize(() => { this.isAddingPlayer = false; }))
      .subscribe({
        next: (member) => {
          this.members = [...this.members.filter(m => m.id !== member.id), member];
          this.resetAddPlayerForm();
          this.snackbar.success(`${player.name_mention} добавлен в команду`);
        },
        error: (err) => { this.snackbar.error(this.errorMessage(err, 'Не удалось добавить игрока')); },
      });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  private search(query: string): void {
    this.isSearching = true;
    // archived (forum-era) teams need an admin's hand just as much as live ones
    this.teamService.listTeams({active: true, archive: true, search: query})
      .pipe(finalize(() => { this.isSearching = false; }))
      .subscribe({
        next: (res) => { this.results = res.items; },
        error: () => { this.snackbar.error('Не удалось выполнить поиск команд'); },
      });
  }

  private searchPlayers(query: string): void {
    this.isSearchingPlayers = true;
    this.adminService.listPlayers({username: query})
      .pipe(finalize(() => { this.isSearchingPlayers = false; }))
      .subscribe({
        next: (res) => { this.playerResults = res.items; },
        error: () => { this.snackbar.error('Не удалось найти игроков'); },
      });
  }

  private selectById(teamId: number): void {
    this.isLoadingTeam = true;
    this.teamService.getTeam(teamId)
      .pipe(finalize(() => { this.isLoadingTeam = false; }))
      .subscribe({
        next: (team) => { this.select(team); },
        error: () => { this.snackbar.error('Не удалось загрузить команду'); },
      });
  }

  private reloadTeam(teamId: number): void {
    this.teamService.getTeam(teamId).subscribe({
      next: (team) => { this.team = team; },
      error: () => { /* the roster below is already up to date */ },
    });
  }

  private loadMembers(teamId: number): void {
    this.isLoadingTeam = true;
    this.teamService.getTeamPlayers(teamId)
      .pipe(finalize(() => { this.isLoadingTeam = false; }))
      .subscribe({
        next: (res) => { this.members = res.items; },
        error: () => { this.snackbar.error('Не удалось загрузить состав команды'); },
      });
  }

  private resetAddPlayerForm(): void {
    this.selectedPlayer = null;
    this.playerQuery = '';
    this.playerResults = [];
    this.addRole = '';
    this.addEmoji = '';
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
