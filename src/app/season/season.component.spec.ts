import {ComponentFixture, TestBed} from "@angular/core/testing";
import {ActivatedRoute, convertToParamMap} from "@angular/router";
import {provideRouter} from "@angular/router";
import {HttpErrorResponse} from "@angular/common/http";
import {Observable, of, throwError} from "rxjs";

import {SeasonComponent} from "./season.component";
import {SeasonService} from "./season.service";
import {Season, Slot} from "./season.models";
import {clearDraft, loadDraft, saveDraft} from "./season-compose";
import {SlotMark} from "./season-calendar";
import {AuthStateService} from "../auth/auth-state.service";
import {UserService} from "../auth/user.service";
import {TeamService} from "../team/team.service";
import {SnackbarService} from "../snackbar/snackbar.service";

const YEAR = 2027;

function makeSlot(day: string, overrides: Partial<Slot> = {}): Slot {
  return {
    id: 1,
    slot_date: day,
    note: null,
    owner: null,
    author_kind: null,
    team: null,
    orgs: [],
    game: null,
    taken_at: null,
    is_free: true,
    ...overrides,
  };
}

function makeSeason(slots: Slot[]): Season {
  return {
    id: 1,
    year: YEAR,
    published_at: "2026-12-01T10:00:00Z",
    updated_at: "2026-12-01T10:00:00Z",
    slots,
  };
}

function notFound(): Observable<never> {
  return throwError(() => new HttpErrorResponse({status: 404, statusText: "Not Found"}));
}

class SeasonServiceStub {
  season: Observable<Season> = of(makeSeason([]));
  defaults: string[] = ["2027-05-15", "2027-06-05"];
  published: Observable<Season> = of(makeSeason([]));
  publishCalls: {year: number; count: number}[] = [];

  getYears() {
    return of({years: [YEAR]});
  }

  getSeason() {
    return this.season;
  }

  getDefaults() {
    return of({year: YEAR, dates: this.defaults});
  }

  publish(year: number, slots: unknown[]) {
    this.publishCalls.push({year, count: slots.length});
    return this.published;
  }
}

describe("SeasonComponent", () => {
  let fixture: ComponentFixture<SeasonComponent>;
  let component: SeasonComponent;
  let seasons: SeasonServiceStub;
  let canBeAuthor: boolean;
  /** undefined until the header's `loadMe` answers — as on a cold page load. */
  let signedIn: boolean | undefined;

  function build(): void {
    TestBed.configureTestingModule({
      imports: [SeasonComponent],
      providers: [
        provideRouter([]),
        {provide: SeasonService, useValue: seasons},
        {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({year: String(YEAR)}))}},
        {
          provide: UserService,
          useValue: {canBeAuthor: () => canBeAuthor, getMe: () => ({id: 7})},
        },
        {provide: TeamService, useValue: {getCaptainedTeams: () => of({items: []})}},
        {provide: SnackbarService, useValue: jasmine.createSpyObj("SnackbarService", ["success", "error", "info"])},
      ],
    });
    fixture = TestBed.createComponent(SeasonComponent);
    component = fixture.componentInstance;
    setIdentity(signedIn);
    fixture.detectChanges();
  }

  /** What `UserService.loadMe` does when it answers: the page waits for this. */
  function setIdentity(authenticated: boolean | undefined): void {
    const authState = TestBed.inject(AuthStateService);
    if (authenticated === true) authState.setAuthenticated();
    else if (authenticated === false) authState.setUnauthenticated();
    else authState.reset();
  }

  beforeEach(() => {
    seasons = new SeasonServiceStub();
    canBeAuthor = true;
    signedIn = true;
    clearDraft(YEAR);
  });

  afterEach(() => {
    clearDraft(YEAR);
  });

  it("shows the published season of the year in the route", () => {
    seasons.season = of(makeSeason([makeSlot("2027-05-15")]));

    build();

    expect(component.year).toBe(YEAR);
    expect(component.mode).toBe("published");
    expect(component.compose).toBeFalse();
    expect(component.slots.length).toBe(1);
  });

  it("widens the grid to cover a date outside May–October", () => {
    seasons.season = of(makeSeason([makeSlot("2027-05-15"), makeSlot("2027-12-05")]));

    build();

    expect(component.firstMonth).toBe(5);
    expect(component.lastMonth).toBe(12);
    expect(component.months.map(month => month.month)).toContain(12);
  });

  it("extends the view month by month, up to the whole year", () => {
    build();
    component.extendEarlier();

    expect(component.firstMonth).toBe(4);
    expect(component.months[0].month).toBe(4);

    for (let i = 0; i < 5; i++) component.extendEarlier();
    expect(component.firstMonth).toBe(1);
    expect(component.canExtendEarlier).toBeFalse();
  });

  it("offers composing a year with no season, starting from the defaults", () => {
    seasons.season = notFound();

    build();

    expect(component.mode).toBe("compose");
    expect(component.drafts.map(draft => draft.slot_date)).toEqual(seasons.defaults);
    expect(loadDraft(YEAR)?.length).toBe(2);
  });

  it("restores a list composed before the page was refreshed", () => {
    seasons.season = notFound();
    saveDraft(YEAR, [{slot_date: "2027-07-04", note: "своя дата"}]);

    build();

    expect(component.drafts).toEqual([{slot_date: "2027-07-04", note: "своя дата"}]);
  });

  it("leaves a year with no season read-only for a player without promotion", () => {
    seasons.season = notFound();
    canBeAuthor = false;
    signedIn = false;

    build();

    expect(component.mode).toBe("none");
    expect(component.canEdit).toBeFalse();
  });

  it("waits for the reader to be known before calling a year read-only", () => {
    seasons.season = notFound();
    signedIn = undefined;

    build();

    // deciding now would show an author the read-only page and stay there
    expect(component.mode).toBe("waiting");

    setIdentity(true);
    fixture.detectChanges();

    expect(component.mode).toBe("compose");
  });

  it("adds, moves and drops a date of the composed list without a request", () => {
    seasons.season = notFound();
    build();
    const day = {day: "2027-08-07", dayOfMonth: 7, slots: [], mark: null, isToday: false, isPast: false};

    component.onDayClick(day);
    component.onDialogAction({kind: "add", day: day.day, note: null});

    expect(component.drafts.map(draft => draft.slot_date)).toContain("2027-08-07");
    expect(loadDraft(YEAR)?.map(draft => draft.slot_date)).toContain("2027-08-07");

    const added = component.slots.find(slot => slot.slot_date === "2027-08-07")!;
    component.onDialogAction({kind: "confirmMove", slot: added, day: "2027-08-14"});
    expect(component.drafts.map(draft => draft.slot_date)).toContain("2027-08-14");

    const moved = component.slots.find(slot => slot.slot_date === "2027-08-14")!;
    component.onDialogAction({kind: "remove", slot: moved});
    expect(component.drafts.map(draft => draft.slot_date)).not.toContain("2027-08-14");
  });

  it("publishes the whole composed list in one request", () => {
    seasons.season = notFound();
    seasons.published = of(makeSeason([makeSlot("2027-05-15")]));

    build();
    component.publish();

    expect(seasons.publishCalls).toEqual([{year: YEAR, count: 2}]);
    expect(component.mode).toBe("published");
    // the season is on the server now, so the local list is not kept around
    expect(loadDraft(YEAR)).toBeNull();
  });

  it("discards the local list when somebody published that year first", () => {
    seasons.season = notFound();
    seasons.published = throwError(() => new HttpErrorResponse({status: 409, statusText: "Conflict"}));

    build();
    seasons.season = of(makeSeason([makeSlot("2027-05-15")]));
    component.publish();

    expect(component.mode).toBe("published");
    expect(component.drafts).toEqual([]);
    expect(loadDraft(YEAR)).toBeNull();
    expect(TestBed.inject(SnackbarService).info).toHaveBeenCalled();
  });

  it("opens a window on a tap and writes nothing by itself", () => {
    seasons.season = of(makeSeason([]));
    build();
    const day = component.months[0].cells.find(cell => cell !== null)!;

    component.onDayClick(day);

    expect(component.openDay).toBe(day.day);
    expect(component.slots.length).toBe(0);
  });

  it("marks your own date apart from somebody else's", () => {
    seasons.season = of(makeSeason([
      makeSlot("2027-05-15", {id: 1, is_free: false, owner: {id: 7, can_be_author: true, name_mention: "@me", username: "me"}}),
      makeSlot("2027-06-05", {id: 2, is_free: false, owner: {id: 9, can_be_author: true, name_mention: "@other", username: "other"}}),
    ]));

    build();
    const cells = component.months.flatMap(month => month.cells);

    expect(cells.find(cell => cell?.day === "2027-05-15")?.mark).toBe(SlotMark.mine);
    expect(cells.find(cell => cell?.day === "2027-06-05")?.mark).toBe(SlotMark.taken);
  });

  it("cancels a move when the date is dropped back on its own day", () => {
    const slot = makeSlot("2027-05-15");
    seasons.season = of(makeSeason([slot]));
    build();

    component.onDialogAction({kind: "startMove", slot});
    expect(component.moving).toBe(slot);

    component.onDayClick({
      day: "2027-05-15", dayOfMonth: 15, slots: [slot], mark: SlotMark.free, isToday: false, isPast: false,
    });
    expect(component.moving).toBeNull();
  });
});
