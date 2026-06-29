import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {finalize, of, switchMap} from "rxjs";
import {MatIcon} from "@angular/material/icon";
import {ConstructorService} from "./constructor.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {describeError} from "./constructor.models";
import {AppIcon} from "../ui/icons";
import {TeamService} from "../team/team.service";
import {TeamMember} from "../team/team.models";
import {UserService} from "../auth/user.service";
import {memberEmoji} from "../ui/role-emoji";
import {
  GameOrganizer,
  ORG_PERMISSION_LABELS,
  OrgPermissionKey,
  OrgPermissionLabel,
  OrgPlayer,
} from "./organizers.models";

/**
 * Manage the secondary organizers of a game: list them, invite new ones (via
 * a player search, mirroring the team-invite flow), toggle their permissions
 * and soft-remove them. All actions are author-only — the game editor only
 * loads games the current user authors, so the controls are always shown.
 */
@Component({
  selector: "app-organizers-editor",
  standalone: true,
  imports: [FormsModule, MatIcon],
  templateUrl: "./organizers-editor.component.html",
  styleUrl: "./organizers-editor.component.scss",
})
export class OrganizersEditorComponent implements OnInit, OnDestroy {
  protected readonly AppIcon = AppIcon;
  protected readonly permissionLabels: OrgPermissionLabel[] = ORG_PERMISSION_LABELS;
  protected readonly memberEmoji = memberEmoji;

  @Input({required: true}) gameId!: number;

  isLoading = false;
  organizers: GameOrganizer[] = [];

  /** org_id currently being mutated (permission/delete), to disable its row. */
  busyOrgId: number | null = null;

  searchQuery = "";
  searchResults: OrgPlayer[] = [];
  isSearching = false;
  selectedPlayer: OrgPlayer | null = null;
  isAdding = false;

  /** Author's own team, for quick-adding teammates as organizers. */
  teamName: string | null = null;
  teamPlayers: TeamMember[] = [];
  isLoadingTeam = false;
  /** player id currently being quick-added, to disable just that chip. */
  addingPlayerId: number | null = null;

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private constructorService: ConstructorService,
    private teamService: TeamService,
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  ngOnInit(): void {
    this.load();
    this.loadTeam();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  // -------------------------------------------------------------------------
  // Loading & derived lists
  // -------------------------------------------------------------------------

  load(): void {
    this.isLoading = true;
    this.constructorService.listOrganizers(this.gameId)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: page => { this.organizers = page.content ?? []; },
        error: err => { this.snackbar.error(`Не удалось загрузить организаторов: ${describeError(err)}`); },
      });
  }

  /** The primary organizer (game author), if present. `org_id == null`. */
  get primaryOrganizer(): GameOrganizer | undefined {
    return this.organizers.find(o => o.org_id === null);
  }

  /** Active secondary organizers — soft-deleted ones are hidden. */
  get secondaryOrganizers(): GameOrganizer[] {
    return this.organizers.filter(o => o.org_id !== null && !o.deleted);
  }

  /** Load the author's current team and its members for quick-add. */
  loadTeam(): void {
    const me = this.userService.getMe();
    if (!me?.id) {
      return;
    }
    this.isLoadingTeam = true;
    this.teamService.getPlayer(me.id)
      .pipe(
        switchMap(profile => {
          const team = profile.player_in_team?.team;
          this.teamName = team?.name ?? null;
          return team ? this.teamService.getTeamPlayers(team.id) : of({items: [] as TeamMember[]});
        }),
        finalize(() => { this.isLoadingTeam = false; }),
      )
      .subscribe({
        next: res => { this.teamPlayers = res.items; },
        error: () => { this.snackbar.error("Не удалось загрузить команду автора"); },
      });
  }

  /**
   * Teammates that aren't already organizers — the candidates shown as
   * one-click quick-add chips. The author is filtered out via the org list
   * (they are the primary organizer).
   */
  get quickAddCandidates(): TeamMember[] {
    const existing = new Set(
      this.organizers
        .filter(o => !o.deleted)
        .map(o => o.player?.id)
        .filter((id): id is number => id != null),
    );
    return this.teamPlayers.filter(m => !existing.has(m.id));
  }

  getMemberName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  isBusy(org: GameOrganizer): boolean {
    return org.org_id !== null && this.busyOrgId === org.org_id;
  }

  getPlayerName(org: GameOrganizer): string {
    return org.player?.name_mention ?? `#${org.player?.id}`;
  }

  getPermission(org: GameOrganizer, key: OrgPermissionKey): boolean {
    return org[key];
  }

  // -------------------------------------------------------------------------
  // Permission toggle
  // -------------------------------------------------------------------------

  togglePermission(org: GameOrganizer, key: OrgPermissionKey, value: boolean): void {
    if (org.org_id === null) {
      return;
    }
    const orgId = org.org_id;
    this.busyOrgId = orgId;
    this.constructorService.setOrganizerPermission(this.gameId, orgId, key, value)
      .pipe(finalize(() => { this.busyOrgId = null; }))
      .subscribe({
        next: updated => { this.replaceOrg(updated); },
        error: err => {
          // The checkbox reflects the unconfirmed value — refresh from server.
          this.load();
          this.snackbar.error(`Не удалось изменить право: ${describeError(err)}`);
        },
      });
  }

  // -------------------------------------------------------------------------
  // Remove (soft delete)
  // -------------------------------------------------------------------------

  removeOrganizer(org: GameOrganizer): void {
    if (org.org_id === null) {
      return;
    }
    if (!confirm(`Удалить организатора ${this.getPlayerName(org)}?`)) {
      return;
    }
    const orgId = org.org_id;
    this.busyOrgId = orgId;
    this.constructorService.deleteOrganizer(this.gameId, orgId)
      .pipe(finalize(() => { this.busyOrgId = null; }))
      .subscribe({
        next: updated => {
          this.replaceOrg(updated);
          this.snackbar.success(`${this.getPlayerName(org)} удалён из организаторов`);
        },
        error: err => { this.snackbar.error(`Не удалось удалить организатора: ${describeError(err)}`); },
      });
  }

  // -------------------------------------------------------------------------
  // Add (via search)
  // -------------------------------------------------------------------------

  onSearchQueryChange(query: string): void {
    this.searchQuery = query;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (!query.trim()) {
      this.searchResults = [];
      this.selectedPlayer = null;
      return;
    }
    this.searchTimer = setTimeout(() => { this.performSearch(query.trim()); }, 350);
  }

  performSearch(query: string): void {
    this.isSearching = true;
    this.constructorService.searchPlayers(query)
      .pipe(finalize(() => { this.isSearching = false; }))
      .subscribe({
        next: res => { this.searchResults = res.items; },
        error: () => { this.snackbar.error("Не удалось найти игроков"); },
      });
  }

  selectPlayer(player: OrgPlayer): void {
    this.selectedPlayer = player;
    this.searchQuery = player.name_mention;
    this.searchResults = [];
  }

  clearSelectedPlayer(): void {
    this.selectedPlayer = null;
    this.searchQuery = "";
    this.searchResults = [];
  }

  addOrganizer(): void {
    if (!this.selectedPlayer) {
      this.snackbar.error("Выберите игрока из списка");
      return;
    }
    const player = this.selectedPlayer;
    this.isAdding = true;
    this.constructorService.addOrganizer(this.gameId, player.id)
      .pipe(finalize(() => { this.isAdding = false; }))
      .subscribe({
        next: org => {
          this.replaceOrg(org);
          this.clearSelectedPlayer();
          this.snackbar.success(`${this.getPlayerName(org)} добавлен в организаторы`);
        },
        error: err => { this.handleAddError(err); },
      });
  }

  /** One-click add of a teammate as a secondary organizer. */
  quickAddFromTeam(member: TeamMember): void {
    if (this.addingPlayerId !== null) {
      return;
    }
    this.addingPlayerId = member.id;
    this.constructorService.addOrganizer(this.gameId, member.id)
      .pipe(finalize(() => { this.addingPlayerId = null; }))
      .subscribe({
        next: org => {
          this.replaceOrg(org);
          this.snackbar.success(`${this.getPlayerName(org)} добавлен в организаторы`);
        },
        error: err => { this.handleAddError(err); },
      });
  }

  private handleAddError(err: unknown): void {
    const type = ((err as { error?: { type?: string } } | null)?.error)?.type;
    if (type === "PlayerAlreadyOrganizer") {
      this.snackbar.error("Этот игрок уже является организатором игры");
    } else if (type === "GameHasAnotherAuthor") {
      this.snackbar.error("Управлять организаторами может только автор игры");
    } else {
      this.snackbar.error(`Не удалось добавить организатора: ${describeError(err)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Insert or replace an organizer by org_id, keeping the existing order. */
  private replaceOrg(org: GameOrganizer): void {
    const idx = this.organizers.findIndex(o => o.org_id === org.org_id);
    if (idx >= 0) {
      this.organizers = [
        ...this.organizers.slice(0, idx),
        org,
        ...this.organizers.slice(idx + 1),
      ];
    } else {
      this.organizers = [...this.organizers, org];
    }
  }
}
