import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {TeamService} from './team.service';
import {UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {
  PlayerProfile,
  PlayerSearchResult,
  TeamDetails,
  TeamMember,
  TeamMemberPermissions,
} from './team.models';

export interface PermissionLabel {
  key: keyof TeamMemberPermissions;
  label: string;
}

@Component({
  selector: 'app-captain-bridge',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './captain-bridge.component.html',
  styleUrl: './captain-bridge.component.scss',
})
export class CaptainBridgeComponent implements OnInit, OnDestroy {
  isLoading = false;
  playerProfile: PlayerProfile | null = null;
  team: TeamDetails | null = null;
  members: TeamMember[] = [];

  isTeamEditMode = false;
  editTeamName = '';
  editTeamDescription = '';
  isSavingTeam = false;

  editingMemberId: number | null = null;
  editMemberRole = '';
  editMemberEmoji = '';
  editMemberPermissions: TeamMemberPermissions = this.emptyPermissions();
  isSavingMember = false;

  removingMemberId: number | null = null;

  searchQuery = '';
  searchResults: PlayerSearchResult[] = [];
  isSearching = false;
  selectedPlayer: PlayerSearchResult | null = null;
  addPlayerRole = '';
  addPlayerEmoji = '';
  isAddingPlayer = false;

  readonly permissionLabels: PermissionLabel[] = [
    {key: 'can_manage_waivers', label: 'Вейверы'},
    {key: 'can_manage_players', label: 'Управление участниками'},
    {key: 'can_change_team_name', label: 'Изменить название'},
    {key: 'can_add_players', label: 'Добавлять игроков'},
    {key: 'can_remove_players', label: 'Исключать игроков'},
  ];

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private teamService: TeamService,
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.userService.isUserLoaded()) {
      await this.userService.loadMe();
    }
    if (this.userService.isUserLoaded()) {
      this.loadProfile();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  get isAuthenticated(): boolean {
    return this.userService.isUserLoaded();
  }

  get userId(): number | undefined {
    return this.userService.getMe()?.id;
  }

  get currentMember(): TeamMember | null {
    const id = this.userId;
    if (id === undefined) return null;
    return this.members.find(m => m.id === id) ?? null;
  }

  isCaptain(): boolean {
    return !!this.team?.captain && this.team.captain.id === this.userId;
  }

  hasAnyPermission(): boolean {
    const p = this.currentMember?.permissions;
    if (!p) return false;
    return p.can_manage_waivers || p.can_manage_players || p.can_change_team_name
      || p.can_add_players || p.can_remove_players;
  }

  get pageTitle(): string {
    if (!this.team) return 'Моя команда';
    if (this.isCaptain() || this.hasAnyPermission()) return 'Капитанский мостик';
    if (this.currentMember) return 'Моя команда';
    return `Команда ${this.team.name}`;
  }

  get sortedMembers(): TeamMember[] {
    const captainId = this.team?.captain?.id;
    const myId = this.userId;
    return [...this.members].sort((a, b) => {
      const aCap = a.id === captainId ? 0 : 1;
      const bCap = b.id === captainId ? 0 : 1;
      if (aCap !== bCap) return aCap - bCap;
      return (a.id === myId ? 0 : 1) - (b.id === myId ? 0 : 1);
    });
  }

  canEditTeamName(): boolean {
    return this.isCaptain() || !!this.currentMember?.permissions.can_change_team_name;
  }

  canAddPlayers(): boolean {
    return this.isCaptain() || !!this.currentMember?.permissions.can_add_players;
  }

  canRemovePlayers(): boolean {
    return this.isCaptain() || !!this.currentMember?.permissions.can_remove_players;
  }

  canManagePlayers(): boolean {
    return this.isCaptain() || !!this.currentMember?.permissions.can_manage_players;
  }

  canRemoveMember(member: TeamMember): boolean {
    if (member.id === this.userId) return true;
    return this.canRemovePlayers();
  }

  isSelf(member: TeamMember): boolean {
    return member.id === this.userId;
  }

  isCaptainMember(member: TeamMember): boolean {
    return this.team?.captain?.id === member.id;
  }

  getMemberDisplayName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  getPermissionValue(key: keyof TeamMemberPermissions): boolean {
    return this.editMemberPermissions[key];
  }

  setPermissionValue(key: keyof TeamMemberPermissions, value: boolean): void {
    this.editMemberPermissions[key] = value;
  }

  getMemberPermission(member: TeamMember, key: keyof TeamMemberPermissions): boolean {
    return member.permissions[key];
  }

  loadProfile(): void {
    const id = this.userId;
    if (!id) return;

    this.isLoading = true;
    this.teamService.getPlayer(id)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (profile) => {
          this.playerProfile = profile;
          if (profile.player_in_team) {
            const teamData = profile.player_in_team.current_team;
            this.team = {
              id: teamData.id,
              name: teamData.name,
              description: teamData.description,
              captain: teamData.captain,
            };
            this.loadMembers(teamData.id);
          }
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return;
          }
          this.snackbar.error('Не удалось загрузить профиль игрока');
        },
      });
  }

  loadMembers(teamId: number): void {
    this.teamService.getTeamPlayers(teamId)
      .subscribe({
        next: (res) => { this.members = res.items; },
        error: () => { this.snackbar.error('Не удалось загрузить список участников'); },
      });
  }

  startEditTeam(): void {
    if (!this.team) return;
    this.editTeamName = this.team.name;
    this.editTeamDescription = this.team.description ?? '';
    this.isTeamEditMode = true;
  }

  cancelEditTeam(): void {
    this.isTeamEditMode = false;
  }

  saveTeam(): void {
    if (!this.team || !this.editTeamName.trim()) {
      this.snackbar.error('Название команды не может быть пустым');
      return;
    }

    this.isSavingTeam = true;
    this.teamService.updateTeam(
      this.team.id,
      this.editTeamName.trim(),
      this.editTeamDescription.trim() || null,
    )
      .pipe(finalize(() => { this.isSavingTeam = false; }))
      .subscribe({
        next: (updated) => {
          this.team = updated;
          this.isTeamEditMode = false;
          this.snackbar.success('Команда обновлена');
        },
        error: () => { this.snackbar.error('Не удалось обновить команду'); },
      });
  }

  startEditMember(member: TeamMember): void {
    this.editingMemberId = member.id;
    this.editMemberRole = member.role;
    this.editMemberEmoji = member.emoji ?? '';
    this.editMemberPermissions = {...member.permissions};
  }

  cancelEditMember(): void {
    this.editingMemberId = null;
  }

  saveMember(): void {
    if (!this.team || this.editingMemberId === null) return;

    this.isSavingMember = true;
    const updates: {role?: string; emoji?: string | null; permissions?: Partial<TeamMemberPermissions>} = {
      role: this.editMemberRole.trim() || undefined,
      emoji: this.editMemberEmoji.trim() || null,
    };
    if (this.canManagePlayers()) {
      updates.permissions = this.editMemberPermissions;
    }

    this.teamService.updateMember(this.team.id, this.editingMemberId, updates)
      .pipe(finalize(() => { this.isSavingMember = false; }))
      .subscribe({
        next: (updated) => {
          const idx = this.members.findIndex(m => m.id === this.editingMemberId);
          if (idx >= 0) this.members = [...this.members.slice(0, idx), updated, ...this.members.slice(idx + 1)];
          this.editingMemberId = null;
          this.snackbar.success('Участник обновлён');
        },
        error: () => { this.snackbar.error('Не удалось обновить участника'); },
      });
  }

  removeMember(member: TeamMember): void {
    if (!this.team) return;
    const message = this.isSelf(member)
      ? 'Покинуть команду?'
      : `Исключить ${this.getMemberDisplayName(member)} из команды?`;
    if (!confirm(message)) return;

    this.removingMemberId = member.id;
    this.teamService.removeMember(this.team.id, member.id)
      .pipe(finalize(() => { this.removingMemberId = null; }))
      .subscribe({
        next: () => {
          if (this.isSelf(member)) {
            this.team = null;
            this.members = [];
            this.playerProfile = null;
            this.snackbar.success('Вы покинули команду');
          } else {
            this.members = this.members.filter(m => m.id !== member.id);
            this.snackbar.success(`${this.getMemberDisplayName(member)} исключён из команды`);
          }
        },
        error: () => { this.snackbar.error('Не удалось выполнить операцию'); },
      });
  }

  onSearchQueryChange(query: string): void {
    this.searchQuery = query;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (!query.trim()) {
      this.searchResults = [];
      this.selectedPlayer = null;
      return;
    }
    this.searchTimer = setTimeout(() => { this.performSearch(query.trim()); }, 350);
  }

  performSearch(query: string): void {
    this.isSearching = true;
    this.teamService.searchPlayers(query)
      .pipe(finalize(() => { this.isSearching = false; }))
      .subscribe({
        next: (res) => { this.searchResults = res.items; },
        error: () => { this.snackbar.error('Не удалось найти игроков'); },
      });
  }

  selectPlayer(player: PlayerSearchResult): void {
    this.selectedPlayer = player;
    this.searchQuery = player.name_mention;
    this.searchResults = [];
  }

  clearSelectedPlayer(): void {
    this.selectedPlayer = null;
    this.searchQuery = '';
    this.searchResults = [];
  }

  addPlayer(): void {
    if (!this.selectedPlayer) {
      this.snackbar.error('Выберите игрока из списка');
      return;
    }

    this.isAddingPlayer = true;
    this.teamService.addPlayer(
      this.selectedPlayer.id,
      this.addPlayerRole.trim() || undefined,
      this.addPlayerEmoji.trim() || undefined,
    )
      .pipe(finalize(() => { this.isAddingPlayer = false; }))
      .subscribe({
        next: (member) => {
          this.members = [...this.members, member];
          this.selectedPlayer = null;
          this.searchQuery = '';
          this.addPlayerRole = '';
          this.addPlayerEmoji = '';
          this.snackbar.success(`${this.getMemberDisplayName(member)} добавлен в команду`);
        },
        error: (err) => {
          const errorType = err?.error?.type;
          if (errorType === 'PlayerAlreadyInTeam') {
            this.snackbar.error('Этот игрок уже состоит в команде');
          } else {
            this.snackbar.error('Не удалось добавить игрока');
          }
        },
      });
  }

  private emptyPermissions(): TeamMemberPermissions {
    return {
      can_manage_waivers: false,
      can_manage_players: false,
      can_change_team_name: false,
      can_add_players: false,
      can_remove_players: false,
    };
  }
}
