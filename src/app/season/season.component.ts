import {Component, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {ActivatedRoute, Router, RouterLink} from "@angular/router";
import {HttpErrorResponse} from "@angular/common/http";
import {MatIconModule} from "@angular/material/icon";
import {finalize} from "rxjs";

import {SeasonService} from "./season.service";
import {
  Season,
  SeasonPlayer,
  Slot,
  SlotAuthorKind,
  SlotDraft,
  isMine,
  slotAuthorName,
} from "./season.models";
import {
  DayCell,
  MonthCard,
  MonthRange,
  buildMonths,
  coveringRange,
  indexSlots,
  isoDate,
  shortDate,
  WEEKDAY_NAMES,
} from "./season-grid";
import {UserService} from "../auth/user.service";
import {TeamService} from "../team/team.service";
import {CaptainedTeam, PlayerSearchResult} from "../team/team.models";
import {SnackbarService} from "../snackbar/snackbar.service";
import {readApiError} from "../http/api-error";
import {AppIcon} from "../ui/icons";

const DRAFT_KEY_PREFIX = "shvatka.season.draft.";

/**
 * The season calendar (`/season`, `/season/:year`).
 *
 * A published season renders for anonymous visitors; authors additionally get
 * take / release / add / move. A year with no season yet is offered to authors
 * as *compose mode*: the engine hands out the default dates, the list is
 * edited here — mirrored to `localStorage`, so a refresh survives — and
 * published in one request. Nothing is persisted server-side until then, so
 * two people may compose the same year and the first to publish wins.
 */
@Component({
  selector: "app-season",
  standalone: true,
  imports: [FormsModule, RouterLink, MatIconModule],
  templateUrl: "./season.component.html",
  styleUrl: "./season.component.scss",
})
export class SeasonComponent implements OnInit {
  readonly AppIcon = AppIcon;
  readonly weekdays = WEEKDAY_NAMES;

  year = new Date().getFullYear();
  season: Season | null = null;
  months: MonthCard[] = [];
  slotsByDate = new Map<string, Slot[]>();

  isLoading = false;
  loadFailed = false;
  /** No season for this year yet — an author may compose one. */
  isMissing = false;

  composing = false;
  draft: SlotDraft[] = [];

  selected: Slot | null = null;
  authorKind: SlotAuthorKind = "player";
  selectedTeamId: number | null = null;
  captainedTeams: CaptainedTeam[] = [];
  orgs: SeasonPlayer[] = [];
  orgQuery = "";
  orgResults: PlayerSearchResult[] = [];
  noteDraft = "";

  private range: MonthRange = {from: 5, to: 10};
  private orgSearchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private seasons: SeasonService,
    private users: UserService,
    private teams: TeamService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const raw = params.get("year");
      const parsed = raw === null ? NaN : Number(raw);
      this.year = Number.isInteger(parsed) ? parsed : new Date().getFullYear();
      this.load();
    });
  }

  // ---------- reading ----------

  load(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.isMissing = false;
    this.closeSlot();
    this.seasons.getSeason(this.year)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: season => {
          this.season = season;
          this.composing = false;
          this.range = coveringRange(season.slots.map(slot => slot.date));
          this.rebuild();
        },
        error: (err: unknown) => {
          this.season = null;
          this.slotsByDate = new Map();
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.isMissing = true;
            this.range = {from: 5, to: 10};
            this.rebuild();
            return;
          }
          this.loadFailed = true;
        },
      });
  }

  private rebuild(): void {
    this.months = buildMonths(this.year, this.range);
    this.slotsByDate = indexSlots(this.currentSlots());
  }

  private currentSlots(): Slot[] {
    if (this.composing) {
      // a draft date has no id yet; a negative one keeps `track` stable
      return this.draft.map((draft, index) => this.draftSlot(draft, -(index + 1)));
    }
    return this.season?.slots ?? [];
  }

  private draftSlot(draft: SlotDraft, id: number): Slot {
    return {
      id,
      date: draft.date,
      note: draft.note ?? null,
      owner: null,
      author_kind: null,
      team: null,
      orgs: [],
      game: null,
      taken_at: null,
      is_free: true,
    };
  }

  // ---------- the grid ----------

  slotsOf(cell: DayCell): Slot[] {
    return cell.date ? this.slotsByDate.get(cell.date) ?? [] : [];
  }

  cellLabel(slot: Slot): string {
    if (slot.game) return slot.game.name;
    return slotAuthorName(slot) ?? "свободно";
  }

  isOwn(slot: Slot): boolean {
    return isMine(slot, this.users.getMe()?.id);
  }

  canExtendEarlier(): boolean {
    return this.range.from > 1;
  }

  canExtendLater(): boolean {
    return this.range.to < 12;
  }

  extendEarlier(): void {
    if (!this.canExtendEarlier()) return;
    this.range = {...this.range, from: this.range.from - 1};
    this.rebuild();
  }

  extendLater(): void {
    if (!this.canExtendLater()) return;
    this.range = {...this.range, to: this.range.to + 1};
    this.rebuild();
  }

  // ---------- who may do what ----------

  canBeAuthor(): boolean {
    return this.users.isUserLoaded() && this.users.canBeAuthor();
  }

  canEdit(slot: Slot): boolean {
    if (!this.canBeAuthor()) return false;
    return slot.is_free || this.isOwn(slot);
  }

  // ---------- composing ----------

  startComposing(): void {
    this.composing = true;
    const stored = this.readDraft();
    if (stored) {
      this.setDraft(stored);
      return;
    }
    this.seasons.getDefaults(this.year).subscribe({
      next: defaults => this.setDraft(defaults.dates.map(date => ({date}))),
      error: () => this.snackbar.error("Не удалось получить даты по умолчанию"),
    });
  }

  cancelComposing(): void {
    this.composing = false;
    this.draft = [];
    this.clearDraft();
    this.rebuild();
  }

  toggleDraftDate(cell: DayCell): void {
    if (!cell.date || !this.composing) return;
    const date = cell.date;
    const without = this.draft.filter(draft => draft.date !== date);
    this.setDraft(
      without.length === this.draft.length ? [...this.draft, {date}] : without,
    );
  }

  publishDraft(): void {
    if (this.draft.length === 0) {
      this.snackbar.error("В расписании должна быть хотя бы одна дата");
      return;
    }
    const sorted = [...this.draft].sort((a, b) => a.date.localeCompare(b.date));
    this.seasons.publish(this.year, sorted).subscribe({
      next: season => {
        this.clearDraft();
        this.composing = false;
        this.isMissing = false;
        this.season = season;
        this.range = coveringRange(season.slots.map(slot => slot.date));
        this.rebuild();
        this.snackbar.success(`Расписание сезона ${this.year} опубликовано`);
      },
      error: (err: unknown) => {
        if (readApiError(err)?.type === "SeasonAlreadyExists") {
          // someone published this year first: their season is the truth now
          this.snackbar.error("Расписание уже опубликовано — открываем его");
          this.clearDraft();
          this.composing = false;
          this.draft = [];
          this.load();
          return;
        }
        throw err;
      },
    });
  }

  private setDraft(drafts: SlotDraft[]): void {
    this.draft = [...drafts].sort((a, b) => a.date.localeCompare(b.date));
    this.writeDraft();
    this.rebuild();
  }

  private draftKey(): string {
    return `${DRAFT_KEY_PREFIX}${this.year}`;
  }

  private readDraft(): SlotDraft[] | null {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(
        (item): item is SlotDraft =>
          !!item && typeof (item as SlotDraft).date === "string",
      );
    } catch {
      return null;
    }
  }

  private writeDraft(): void {
    try {
      localStorage.setItem(this.draftKey(), JSON.stringify(this.draft));
    } catch {
      // a private window may refuse to store: the list still works, it just
      // does not survive a refresh
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(this.draftKey());
    } catch {
      // nothing to clean up if it was never stored
    }
  }

  // ---------- one date ----------

  openSlot(slot: Slot): void {
    if (this.composing) return;
    this.selected = slot;
    this.noteDraft = slot.note ?? "";
    this.orgs = [...slot.orgs];
    this.authorKind = slot.author_kind ?? "player";
    this.selectedTeamId = slot.team?.id ?? null;
    this.orgQuery = "";
    this.orgResults = [];
    if (this.captainedTeams.length === 0 && this.canBeAuthor()) {
      this.teams.getCaptainedTeams().subscribe({
        next: res => { this.captainedTeams = res.items; },
        error: () => { this.captainedTeams = []; },
      });
    }
  }

  closeSlot(): void {
    this.selected = null;
    this.orgResults = [];
    this.orgQuery = "";
  }

  authorName(slot: Slot): string | null {
    return slotAuthorName(slot);
  }

  orgNames(slot: Slot): string {
    return slot.orgs.map(org => org.name_mention).join(", ");
  }

  short(date: string): string {
    return shortDate(date);
  }

  addDate(cell: DayCell): void {
    if (!cell.date || !this.canBeAuthor()) return;
    this.seasons.addSlot(this.year, cell.date).subscribe({
      next: () => this.load(),
    });
  }

  take(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.takeSlot(this.year, slot.id, {
      author_kind: this.authorKind,
      team_id: this.authorKind === "team" ? this.selectedTeamId : null,
      org_player_ids: this.orgs.map(org => org.id),
    }).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  release(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.releaseSlot(this.year, slot.id).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  saveNote(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.editSlot(this.year, slot.id, {note: this.noteDraft}).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  move(date: string): void {
    const slot = this.selected;
    if (!slot || !date) return;
    this.seasons.editSlot(this.year, slot.id, {date}).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  remove(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.removeSlot(this.year, slot.id).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  unlinkGame(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.unlinkGame(this.year, slot.id).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  // ---------- the org picker ----------

  onOrgQueryChange(value: string): void {
    this.orgQuery = value;
    if (this.orgSearchTimer) clearTimeout(this.orgSearchTimer);
    if (value.trim().length < 2) {
      this.orgResults = [];
      return;
    }
    this.orgSearchTimer = setTimeout(() => {
      this.teams.searchPlayers(value.trim()).subscribe({
        next: res => { this.orgResults = res.items; },
        error: () => { this.orgResults = []; },
      });
    }, 350);
  }

  addOrg(found: PlayerSearchResult): void {
    if (!this.orgs.some(org => org.id === found.id)) {
      this.orgs = [...this.orgs, {
        id: found.id,
        can_be_author: found.can_be_author,
        name_mention: found.name_mention,
        username: null,
      }];
    }
    this.orgQuery = "";
    this.orgResults = [];
  }

  removeOrg(id: number): void {
    this.orgs = this.orgs.filter(org => org.id !== id);
  }

  saveOrgs(): void {
    const slot = this.selected;
    if (!slot) return;
    this.seasons.setOrgs(this.year, slot.id, this.orgs.map(org => org.id)).subscribe({
      next: () => { this.closeSlot(); this.load(); },
    });
  }

  // ---------- navigation ----------

  goToYear(year: number): void {
    void this.router.navigate(["/season", year]);
  }

  today(): string {
    const now = new Date();
    return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
}
