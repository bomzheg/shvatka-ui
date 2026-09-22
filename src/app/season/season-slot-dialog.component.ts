import {Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {RouterLink} from "@angular/router";
import {MatIcon} from "@angular/material/icon";
import {finalize} from "rxjs";
import {AppIcon} from "../ui/icons";
import {SnackbarService} from "../snackbar/snackbar.service";
import {TeamService} from "../team/team.service";
import {CaptainedTeam} from "../team/team.models";
import {formatDay, formatFullDay} from "./season-calendar";
import {Slot, SlotAuthorKind, SlotAuthorKindValue, slotAuthorName} from "./season.models";

/** A player as the org picker holds them — the search answers with this much. */
export interface OrgCandidate {
  id: number;
  name_mention: string;
}

export type SlotDialogAction =
  | {kind: "add"; day: string; note: string | null}
  | {kind: "remove"; slot: Slot}
  | {kind: "startMove"; slot: Slot}
  | {kind: "confirmMove"; slot: Slot; day: string}
  | {kind: "take"; slot: Slot; authorKind: SlotAuthorKindValue; teamId: number | null; orgIds: number[]}
  | {kind: "release"; slot: Slot}
  | {kind: "note"; slot: Slot; note: string | null};

type DialogView = "overview" | "take" | "note" | "remove";

/**
 * The window a tap on a day opens (SHEP-0003 §A tap opens a modal).
 *
 * Every tap on the grid lands here and nothing else: an empty day *offers* a
 * date, a planned one shows it with the actions for whoever may edit. Adding
 * on the tap itself leaves no way back short of deleting it again, and a
 * calendar that writes while you read it is one you stop trusting.
 *
 * The parent owns the requests — this component only says what was asked for.
 */
@Component({
  selector: "app-season-slot-dialog",
  standalone: true,
  imports: [FormsModule, RouterLink, MatIcon],
  templateUrl: "./season-slot-dialog.component.html",
  styleUrl: "./season-slot-dialog.component.scss",
})
export class SeasonSlotDialogComponent implements OnChanges, OnDestroy {
  protected readonly AppIcon = AppIcon;
  protected readonly SlotAuthorKind = SlotAuthorKind;
  protected readonly formatDay = formatDay;
  protected readonly formatFullDay = formatFullDay;

  @Input({required: true}) day!: string;
  @Input() slots: Slot[] = [];
  /** Composing a season that is not published yet: the dates are local drafts. */
  @Input() compose = false;
  @Input() canEdit = false;
  @Input() currentPlayerId: number | undefined;
  @Input() captainedTeams: CaptainedTeam[] = [];
  /** A request is in flight — the parent keeps the window open and disabled. */
  @Input() busy = false;
  /** The date being moved: this window is then «move it here?» and nothing else. */
  @Input() moving: Slot | null = null;

  @Output() action = new EventEmitter<SlotDialogAction>();
  @Output() closed = new EventEmitter<void>();

  view: DialogView = "overview";
  selected: Slot | null = null;

  /** The note of the date being added or edited. */
  noteDraft = "";

  takeKind: SlotAuthorKindValue = SlotAuthorKind.player;
  takeTeamId: number | null = null;
  takeOrgs: OrgCandidate[] = [];
  orgQuery = "";
  orgResults: OrgCandidate[] = [];
  isSearchingOrgs = false;

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private teamService: TeamService,
    private snackbar: SnackbarService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["day"]) {
      // the note field of an empty day belongs to that day, not to the last one
      this.noteDraft = "";
    }
    if (changes["day"] || changes["slots"]) {
      this.syncSelection();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  @HostListener("document:keydown.escape")
  onEscape(): void {
    if (!this.busy) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  get title(): string {
    return formatFullDay(this.day);
  }

  authorName(slot: Slot): string | null {
    return slotAuthorName(slot);
  }

  orgNames(slot: Slot): string {
    return slot.orgs.map(org => org.name_mention).join(", ");
  }

  isMine(slot: Slot): boolean {
    return this.currentPlayerId !== undefined && slot.owner?.id === this.currentPlayerId;
  }

  select(slot: Slot): void {
    this.selected = slot;
    this.view = "overview";
  }

  /* ---------------------------------------------------------------- adding */

  submitAdd(): void {
    this.action.emit({kind: "add", day: this.day, note: this.trimmedNote()});
  }

  /* ---------------------------------------------------------------- moving */

  startMove(slot: Slot): void {
    this.action.emit({kind: "startMove", slot});
  }

  confirmMove(): void {
    if (this.moving) {
      this.action.emit({kind: "confirmMove", slot: this.moving, day: this.day});
    }
  }

  /* --------------------------------------------------------------- the note */

  startNote(slot: Slot): void {
    this.selected = slot;
    this.noteDraft = slot.note ?? "";
    this.view = "note";
  }

  submitNote(): void {
    if (this.selected) {
      this.action.emit({kind: "note", slot: this.selected, note: this.trimmedNote()});
    }
  }

  /* -------------------------------------------------------------- deleting */

  startRemove(slot: Slot): void {
    this.selected = slot;
    this.view = "remove";
  }

  confirmRemove(): void {
    if (this.selected) {
      this.action.emit({kind: "remove", slot: this.selected});
    }
  }

  /* ----------------------------------------------------- taking / releasing */

  startTake(slot: Slot): void {
    this.selected = slot;
    this.takeKind = (slot.author_kind as SlotAuthorKindValue | null) ?? SlotAuthorKind.player;
    this.takeTeamId = slot.team?.id ?? this.captainedTeams[0]?.id ?? null;
    this.takeOrgs = slot.orgs.map(org => ({id: org.id, name_mention: org.name_mention}));
    this.orgQuery = "";
    this.orgResults = [];
    this.view = "take";
  }

  /** Naming a team needs its captain, so without one only «я» is offered. */
  get canTakeAsTeam(): boolean {
    return this.captainedTeams.length > 0;
  }

  submitTake(): void {
    if (!this.selected) return;
    if (this.takeKind === SlotAuthorKind.team && this.takeTeamId === null) {
      this.snackbar.error("Выберите команду");
      return;
    }
    this.action.emit({
      kind: "take",
      slot: this.selected,
      authorKind: this.takeKind,
      teamId: this.takeKind === SlotAuthorKind.team ? this.takeTeamId : null,
      orgIds: this.takeOrgs.map(org => org.id),
    });
  }

  release(slot: Slot): void {
    this.action.emit({kind: "release", slot});
  }

  onOrgQueryChange(query: string): void {
    this.orgQuery = query;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (!query.trim()) {
      this.orgResults = [];
      return;
    }
    this.searchTimer = setTimeout(() => { this.searchOrgs(query.trim()); }, 350);
  }

  addOrg(candidate: OrgCandidate): void {
    if (!this.takeOrgs.some(org => org.id === candidate.id)) {
      this.takeOrgs = [...this.takeOrgs, candidate];
    }
    this.orgQuery = "";
    this.orgResults = [];
  }

  removeOrg(candidate: OrgCandidate): void {
    this.takeOrgs = this.takeOrgs.filter(org => org.id !== candidate.id);
  }

  private searchOrgs(query: string): void {
    this.isSearchingOrgs = true;
    this.teamService.searchPlayers(query)
      .pipe(finalize(() => { this.isSearchingOrgs = false; }))
      .subscribe({
        next: res => {
          this.orgResults = res.items.map(item => ({id: item.id, name_mention: item.name_mention}));
        },
        error: () => { this.snackbar.error("Не удалось найти игроков"); },
      });
  }

  private trimmedNote(): string | null {
    const note = this.noteDraft.trim();
    return note.length > 0 ? note : null;
  }

  /** Keeps the shown date pointing at a real one after the parent reloads. */
  private syncSelection(): void {
    if (this.slots.length === 0) {
      this.selected = null;
      return;
    }
    const previous = this.selected;
    this.selected = this.slots.find(slot => slot.id === previous?.id) ?? this.slots[0];
  }
}
