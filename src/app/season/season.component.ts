import {Component, OnInit, effect} from "@angular/core";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {HttpErrorResponse} from "@angular/common/http";
import {Observable, finalize} from "rxjs";
import {AuthStateService} from "../auth/auth-state.service";
import {UserService} from "../auth/user.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {TeamService} from "../team/team.service";
import {CaptainedTeam} from "../team/team.models";
import {readApiError} from "../http/api-error";
import {SeasonService} from "./season.service";
import {
  DEFAULT_FIRST_MONTH,
  DEFAULT_LAST_MONTH,
  DayCell,
  MonthCard,
  SLOT_MARK_EMOJI,
  SlotMark,
  WEEKDAY_NAMES,
  buildMonths,
  draftsAsSlots,
  formatDay,
  isoDay,
  markOf,
  monthRangeFor,
} from "./season-calendar";
import {
  addDraft,
  clearDraft,
  draftsFromDates,
  loadDraft,
  moveDraft,
  removeDraft,
  saveDraft,
  setDraftNote,
} from "./season-compose";
import {SeasonSlotDialogComponent, SlotDialogAction} from "./season-slot-dialog.component";
import {Season, Slot, SlotDraft, slotAuthorName} from "./season.models";

/** `waiting` is «there is no season and we do not yet know who is asking». */
type PageMode = "loading" | "waiting" | "published" | "compose" | "none" | "failed";

/**
 * The season schedule in the browser (SHEP-0003 §Web UI).
 *
 * One page for both halves of the feature: a published season, read-only for
 * everyone and editable date by date for authors, and — for a year with no
 * season — the composing view, whose working list lives in component state and
 * `localStorage` until «Опубликовать» sends it in one request.
 *
 * The page looks the same to an engine admin as to anybody else: what an admin
 * may do that an author may not lives in the admin panel, never here.
 */
@Component({
  selector: "app-season",
  standalone: true,
  imports: [RouterLink, SeasonSlotDialogComponent],
  templateUrl: "./season.component.html",
  styleUrl: "./season.component.scss",
})
export class SeasonComponent implements OnInit {
  protected readonly WEEKDAY_NAMES = WEEKDAY_NAMES;
  protected readonly SLOT_MARK_EMOJI = SLOT_MARK_EMOJI;
  protected readonly SlotMark = SlotMark;
  protected readonly formatDay = formatDay;
  protected readonly slotAuthorName = slotAuthorName;

  year = new Date().getFullYear();
  mode: PageMode = "loading";
  season: Season | null = null;
  drafts: SlotDraft[] = [];
  years: number[] = [];

  months: MonthCard[] = [];
  firstMonth = DEFAULT_FIRST_MONTH;
  lastMonth = DEFAULT_LAST_MONTH;

  /** The day whose window is open, and the dates planned on it. */
  openDay: string | null = null;
  openSlots: Slot[] = [];
  /** The date waiting for a day to be moved onto. */
  moving: Slot | null = null;
  busy = false;

  captainedTeams: CaptainedTeam[] = [];

  constructor(
    private route: ActivatedRoute,
    private seasons: SeasonService,
    private userService: UserService,
    private authState: AuthStateService,
    private teamService: TeamService,
    private snackbar: SnackbarService,
  ) {
    // The reader arrives asynchronously — the header loads them — so a page
    // opened by its url may render before it knows whose it is. Everything
    // that depends on that waits here instead of guessing.
    effect(() => {
      if (this.identityKnown) {
        this.onIdentitySettled();
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const asked = Number(params.get("year"));
      this.year = Number.isInteger(asked) && asked > 0 ? asked : new Date().getFullYear();
      this.load();
    });
    this.seasons.getYears().subscribe({
      next: res => { this.years = this.yearsToOffer(res.years ?? []); },
      // the switcher is a convenience; the page still shows the year it is on
      error: () => { this.years = this.yearsToOffer([]); },
    });
  }

  /** Whether the answer to «who is reading this» has come back yet. */
  private get identityKnown(): boolean {
    return this.authState.isAuthenticated() || this.authState.isUnauthenticated();
  }

  /**
   * The reader is known now: mark their own dates, offer them the team picker,
   * and settle a year that was waiting to learn whether it may be composed.
   */
  private onIdentitySettled(): void {
    if (this.canEdit && this.captainedTeams.length === 0) {
      this.loadCaptainedTeams();
    }
    if (this.mode === "waiting") {
      this.startComposing();
      return;
    }
    this.rebuild();
  }

  /** Promotion is the whole gate: any author may edit any date. */
  get canEdit(): boolean {
    return this.userService.canBeAuthor();
  }

  get currentPlayerId(): number | undefined {
    return this.userService.getMe()?.id;
  }

  get compose(): boolean {
    return this.mode === "compose";
  }

  get slots(): Slot[] {
    if (this.compose) return draftsAsSlots(this.drafts);
    return this.season?.slots ?? [];
  }

  get plannedCount(): number {
    return this.slots.length;
  }

  get canExtendEarlier(): boolean {
    return this.firstMonth > 1;
  }

  get canExtendLater(): boolean {
    return this.lastMonth < 12;
  }

  extendEarlier(): void {
    if (this.canExtendEarlier) {
      this.firstMonth -= 1;
      this.rebuild();
    }
  }

  extendLater(): void {
    if (this.canExtendLater) {
      this.lastMonth += 1;
      this.rebuild();
    }
  }

  /* ----------------------------------------------------------------- loading */

  load(): void {
    this.mode = "loading";
    this.closeDialog();
    this.moving = null;
    this.seasons.getSeason(this.year).subscribe({
      next: season => { this.showSeason(season); },
      error: err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.startComposing();
          return;
        }
        this.mode = "failed";
      },
    });
  }

  private showSeason(season: Season): void {
    this.season = season;
    this.drafts = [];
    this.mode = "published";
    // a season exists now, so any list composed here for that year is stale
    clearDraft(this.year);
    this.resetMonthRange();
  }

  /** No season for that year: an author composes one, everyone else waits. */
  private startComposing(): void {
    this.season = null;
    if (!this.identityKnown) {
      // deciding now would show an author the read-only page and stay there
      this.mode = "waiting";
      return;
    }
    if (!this.canEdit) {
      this.mode = "none";
      this.drafts = [];
      this.resetMonthRange();
      return;
    }
    this.mode = "compose";
    const saved = loadDraft(this.year);
    if (saved && saved.length > 0) {
      this.drafts = saved;
      this.resetMonthRange();
      return;
    }
    this.loadDefaults();
  }

  loadDefaults(): void {
    this.seasons.getDefaults(this.year).subscribe({
      next: res => {
        this.drafts = draftsFromDates(res.dates ?? []);
        this.persistDrafts();
        this.resetMonthRange();
      },
      error: () => {
        this.snackbar.error("Не удалось получить даты по умолчанию");
        this.resetMonthRange();
      },
    });
  }

  private loadCaptainedTeams(): void {
    this.teamService.getCaptainedTeams().subscribe({
      next: res => { this.captainedTeams = res.items ?? []; },
      // without the list only «я» is offered, which is the safe half
      error: () => { this.captainedTeams = []; },
    });
  }

  private resetMonthRange(): void {
    const range = monthRangeFor(this.slots.map(slot => slot.slot_date));
    this.firstMonth = range.first;
    this.lastMonth = range.last;
    this.rebuild();
  }

  private rebuild(): void {
    this.months = buildMonths(
      this.year,
      this.firstMonth,
      this.lastMonth,
      this.slots,
      isoDay(new Date()),
      this.currentPlayerId,
    );
  }

  /* ------------------------------------------------------------- the calendar */

  onDayClick(cell: DayCell): void {
    if (this.moving && this.moving.slot_date === cell.day) {
      // moving a date onto the day it already sits on is just a cancel
      this.moving = null;
    }
    this.openDay = cell.day;
    this.openSlots = cell.slots;
  }

  cancelMove(): void {
    this.moving = null;
  }

  closeDialog(): void {
    this.openDay = null;
    this.openSlots = [];
  }

  cellTitle(cell: DayCell): string {
    if (cell.slots.length === 0) return formatDay(cell.day);
    const names = cell.slots
      .map(slot => slotAuthorName(slot) ?? "свободна")
      .join(", ");
    return `${formatDay(cell.day)} — ${names}`;
  }

  /**
   * The season as a list, under the grid: a day cell is too narrow for a name,
   * and this is the same plan the pinned channel message shows.
   */
  get plannedSlots(): Slot[] {
    return [...this.slots].sort((a, b) => a.slot_date.localeCompare(b.slot_date));
  }

  orgNames(slot: Slot): string {
    return slot.orgs.map(org => org.name_mention).join(", ");
  }

  markOfSlot(slot: Slot): SlotMark {
    return markOf([slot], this.currentPlayerId) ?? SlotMark.free;
  }

  /** A row of the list opens the same window a tap on its day does. */
  openSlot(slot: Slot): void {
    this.openDay = slot.slot_date;
    this.openSlots = this.slots.filter(one => one.slot_date === slot.slot_date);
  }

  /* ---------------------------------------------------------------- the writes */

  onDialogAction(action: SlotDialogAction): void {
    if (action.kind === "startMove") {
      this.moving = action.slot;
      this.closeDialog();
      return;
    }
    if (this.compose) {
      this.applyToDraft(action);
      return;
    }
    this.applyToSeason(action);
  }

  private applyToDraft(action: SlotDialogAction): void {
    switch (action.kind) {
      case "add":
        this.drafts = addDraft(this.drafts, action.day, action.note);
        break;
      case "remove":
        this.drafts = removeDraft(this.drafts, action.slot.slot_date);
        break;
      case "confirmMove":
        this.drafts = moveDraft(this.drafts, action.slot.slot_date, action.day);
        this.moving = null;
        break;
      case "note":
        this.drafts = setDraftNote(this.drafts, action.slot.slot_date, action.note);
        break;
      default:
        // take and release need a published season
        return;
    }
    this.persistDrafts();
    this.rebuild();
    this.closeDialog();
  }

  private applyToSeason(action: SlotDialogAction): void {
    switch (action.kind) {
      case "add":
        this.run(this.seasons.addSlot(this.year, action.day, action.note), "Дата добавлена");
        break;
      case "remove":
        this.run(this.seasons.removeSlot(this.year, action.slot.id), "Дата удалена");
        break;
      case "confirmMove":
        this.moving = null;
        this.run(
          this.seasons.moveSlot(this.year, action.slot.id, action.day),
          `Дата перенесена на ${formatDay(action.day)}`,
        );
        break;
      case "note":
        this.run(this.seasons.editNote(this.year, action.slot.id, action.note), "Заметка сохранена");
        break;
      case "take":
        this.run(
          this.seasons.takeSlot(this.year, action.slot.id, {
            author_kind: action.authorKind,
            team_id: action.teamId,
            org_player_ids: action.orgIds,
          }),
          "Дата занята",
        );
        break;
      case "release":
        this.run(this.seasons.releaseSlot(this.year, action.slot.id), "Дата освобождена");
        break;
      default:
        return;
    }
  }

  /** Every date-level edit ends the same way: reload the season, say so, close. */
  private run(request: Observable<unknown>, success: string): void {
    this.busy = true;
    request
      .pipe(finalize(() => { this.busy = false; }))
      .subscribe({
        next: () => {
          this.snackbar.success(success);
          this.closeDialog();
          this.reloadSeason();
        },
        error: err => { this.snackbar.error(this.describe(err)); },
      });
  }

  private reloadSeason(): void {
    this.seasons.getSeason(this.year).subscribe({
      next: season => {
        this.season = season;
        this.rebuild();
      },
      error: () => { this.snackbar.error("Не удалось обновить расписание"); },
    });
  }

  /* ------------------------------------------------------------- composing */

  private persistDrafts(): void {
    saveDraft(this.year, this.drafts);
  }

  resetDrafts(): void {
    clearDraft(this.year);
    this.drafts = [];
    this.loadDefaults();
  }

  publish(): void {
    if (this.drafts.length === 0) {
      this.snackbar.error("В расписании нет ни одной даты");
      return;
    }
    this.busy = true;
    this.seasons.publish(this.year, this.drafts)
      .pipe(finalize(() => { this.busy = false; }))
      .subscribe({
        next: season => {
          this.snackbar.success(`Расписание сезона ${this.year} опубликовано`);
          this.showSeason(season);
        },
        error: err => { this.onPublishError(err); },
      });
  }

  /**
   * Somebody published that year first. The local list is nine dates and
   * merging two calendars has no obviously right answer, so it is dropped and
   * the published season is shown — editable date by date from there.
   */
  private onPublishError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 409) {
      clearDraft(this.year);
      this.drafts = [];
      this.snackbar.info(`Расписание на ${this.year} уже опубликовал кто-то другой — показываем его`);
      this.load();
      return;
    }
    this.snackbar.error(this.describe(err));
  }

  /* ------------------------------------------------------------------ misc */

  private describe(err: unknown): string {
    const apiError = readApiError(err);
    if (apiError?.description) return apiError.description;
    if (apiError?.text) return apiError.text;
    return "Не удалось изменить расписание";
  }

  /** The published years, plus this one and the next, so one can be composed. */
  private yearsToOffer(published: number[]): number[] {
    const now = new Date().getFullYear();
    const years = new Set([...published, now, now + 1, this.year]);
    return [...years].sort((a, b) => a - b);
  }
}
