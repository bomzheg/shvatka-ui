import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {GameWaivers, WaiverEntry} from './admin.models';
import {Game} from '../games/games.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {TeamDetails, TeamMember} from '../team/team.models';
import {TeamService} from '../team/team.service';

/**
 * The roster of a game, and the way to fix it over the captain's head. A player
 * can only be signed up while they play in the team: the engine reads a roster
 * through the live membership, so a waiver for anybody else would be invisible.
 * Putting them in the team first is the neighbouring screen, «Команды».
 *
 * A team with no waivers at all is not in the roster and so not on the page —
 * the search adds one so its first waiver can be written.
 */
@Component({
  selector: 'app-admin-waivers',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-waivers.component.html',
  styleUrl: './admin-waivers.component.scss',
})
export class AdminWaiversComponent implements OnInit, OnDestroy {
  games: Game[] = [];
  selectedGameId: number | null = null;
  waivers: GameWaivers | null = null;
  isLoading = false;
  loadFailed = false;

  /** team id -> its current members, loaded when that team's add form opens */
  members: Record<number, TeamMember[]> = {};
  /** the team whose add form is open, if any */
  addingTo: number | null = null;
  loadingMembersFor: number | null = null;
  selectedMemberId: number | null = null;
  isAdding = false;
  /** `teamId:playerId` of the waiver being removed right now */
  removingKey = '';

  /** Teams pulled onto the page by the search — the ones with no waiver yet. */
  extraTeams: TeamDetails[] = [];
  teamQuery = '';
  teamResults: TeamDetails[] = [];
  isSearchingTeams = false;

  private teamSearchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private adminService: AdminService,
    private teamService: TeamService,
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

  ngOnDestroy(): void {
    if (this.teamSearchTimer) clearTimeout(this.teamSearchTimer);
  }

  onGameChange(): void {
    this.resetEditing();
    if (this.selectedGameId === null) {
      this.waivers = null;
      return;
    }
    this.load(this.selectedGameId);
  }

  /** The teams the page shows: the game's roster plus the ones searched for. */
  get displayTeams(): TeamDetails[] {
    const roster = this.waivers?.teams ?? [];
    const known = new Set(roster.map(team => team.id));
    return [...roster, ...this.extraTeams.filter(team => !known.has(team.id))];
  }

  teamWaivers(team: TeamDetails): WaiverEntry[] {
    return this.waivers?.waivers[String(team.id)] ?? [];
  }

  // ── Removing a waiver ────────────────────────────────────────────────────────

  entryKey(team: TeamDetails, entry: WaiverEntry): string {
    return `${team.id}:${entry.player.id}`;
  }

  remove(team: TeamDetails, entry: WaiverEntry): void {
    const gameId = this.selectedGameId;
    if (gameId === null || this.removingKey) return;
    const name = entry.player.username || entry.player.name_mention;
    if (!confirm(`Убрать ${name} из состава команды «${team.name}» на эту игру?`)) {
      return;
    }

    this.removingKey = this.entryKey(team, entry);
    this.adminService.removeWaiver(gameId, team.id, entry.player.id)
      .pipe(finalize(() => { this.removingKey = ''; }))
      .subscribe({
        next: () => {
          // the team may have just lost its last waiver and left the roster
          this.keepOnPage(team);
          this.load(gameId, true);
          this.snackbar.success(`${name} убран из состава`);
        },
        error: (err) => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось убрать вейвер'));
        },
      });
  }

  // ── Adding a waiver ──────────────────────────────────────────────────────────

  toggleAddForm(team: TeamDetails): void {
    if (this.addingTo === team.id) {
      this.addingTo = null;
      return;
    }
    this.addingTo = team.id;
    this.selectedMemberId = null;
    if (!this.members[team.id]) {
      this.loadMembers(team.id);
    }
  }

  /** Team members who are not in the game's roster yet — the ones worth adding. */
  addableMembers(team: TeamDetails): TeamMember[] {
    const signed = new Set(this.teamWaivers(team).map(entry => entry.player.id));
    return (this.members[team.id] ?? []).filter(member => !signed.has(member.id));
  }

  memberName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  onMemberChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedMemberId = value === '' ? null : Number(value);
  }

  add(team: TeamDetails): void {
    const gameId = this.selectedGameId;
    if (gameId === null || this.selectedMemberId === null || this.isAdding) return;
    const playerId = this.selectedMemberId;

    this.isAdding = true;
    this.adminService.addWaiver(gameId, team.id, playerId)
      .pipe(finalize(() => { this.isAdding = false; }))
      .subscribe({
        next: () => {
          this.addingTo = null;
          this.selectedMemberId = null;
          this.keepOnPage(team);
          this.load(gameId, true);
          this.snackbar.success('Игрок добавлен в состав');
        },
        error: (err) => {
          this.snackbar.error(this.errorMessage(err, 'Не удалось добавить вейвер'));
        },
      });
  }

  // ── Bringing a team with no waivers onto the page ────────────────────────────

  onTeamQueryChange(value: string): void {
    this.teamQuery = value;
    if (this.teamSearchTimer) clearTimeout(this.teamSearchTimer);
    const query = value.trim();
    if (!query) {
      this.teamResults = [];
      return;
    }
    this.teamSearchTimer = setTimeout(() => this.searchTeams(query), 350);
  }

  pickTeam(team: TeamDetails): void {
    this.teamQuery = '';
    this.teamResults = [];
    this.keepOnPage(team);
    this.toggleAddForm(team);
  }

  private searchTeams(query: string): void {
    this.isSearchingTeams = true;
    this.teamService.listTeams({active: true, archive: true, search: query})
      .pipe(finalize(() => { this.isSearchingTeams = false; }))
      .subscribe({
        next: (res) => { this.teamResults = res.items; },
        error: () => { this.snackbar.error('Не удалось выполнить поиск команд'); },
      });
  }

  /** Keep the team visible even when it has no waivers to be listed by. */
  private keepOnPage(team: TeamDetails): void {
    if (!this.extraTeams.some(t => t.id === team.id)) {
      this.extraTeams = [...this.extraTeams, team];
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  private loadMembers(teamId: number): void {
    this.loadingMembersFor = teamId;
    this.teamService.getTeamPlayers(teamId)
      .pipe(finalize(() => { this.loadingMembersFor = null; }))
      .subscribe({
        next: (res) => { this.members = {...this.members, [teamId]: res.items}; },
        error: () => { this.snackbar.error('Не удалось загрузить состав команды'); },
      });
  }

  private resetEditing(): void {
    this.addingTo = null;
    this.selectedMemberId = null;
    this.members = {};
    this.extraTeams = [];
    this.teamQuery = '';
    this.teamResults = [];
  }

  /**
   * Re-read the roster. `silent` keeps the list on screen while it refreshes —
   * after an edit the page should not blink back to «Загрузка...».
   */
  private load(gameId: number, silent = false): void {
    this.isLoading = !silent;
    this.loadFailed = false;
    this.adminService.getGameWaivers(gameId)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (waivers) => { this.waivers = waivers; },
        error: (err) => {
          this.loadFailed = true;
          this.waivers = null;
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.snackbar.error('Игра не найдена');
            return;
          }
          this.snackbar.error('Не удалось загрузить вейверы');
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
