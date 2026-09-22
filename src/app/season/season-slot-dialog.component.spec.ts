import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideRouter} from "@angular/router";
import {of} from "rxjs";

import {SeasonSlotDialogComponent, SlotDialogAction} from "./season-slot-dialog.component";
import {Slot, SlotAuthorKind} from "./season.models";
import {TeamService} from "../team/team.service";
import {SnackbarService} from "../snackbar/snackbar.service";

function player(id: number, name: string) {
  return {id, can_be_author: true, name_mention: name, username: name};
}

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    id: 5,
    slot_date: "2027-05-15",
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

describe("SeasonSlotDialogComponent", () => {
  let fixture: ComponentFixture<SeasonSlotDialogComponent>;
  let component: SeasonSlotDialogComponent;
  let actions: SlotDialogAction[];

  function build(inputs: Partial<SeasonSlotDialogComponent> = {}): void {
    fixture = TestBed.createComponent(SeasonSlotDialogComponent);
    component = fixture.componentInstance;
    component.day = "2027-05-15";
    component.canEdit = true;
    Object.assign(component, inputs);
    actions = [];
    component.action.subscribe(action => actions.push(action));
    // what Angular does for a real binding: the inputs land, then ngOnChanges
    component.ngOnChanges({
      day: {currentValue: component.day, previousValue: undefined, firstChange: true, isFirstChange: () => true},
      slots: {currentValue: component.slots, previousValue: [], firstChange: true, isFirstChange: () => true},
    });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SeasonSlotDialogComponent],
      providers: [
        provideRouter([]),
        {provide: TeamService, useValue: {searchPlayers: () => of({items: []})}},
        {provide: SnackbarService, useValue: jasmine.createSpyObj("SnackbarService", ["error"])},
      ],
    });
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? "";
  }

  it("offers an empty day instead of adding it, and adds only when asked", () => {
    build({slots: []});

    expect(text()).toContain("На этот день игра не запланирована");
    expect(actions).toEqual([]);

    component.noteDraft = "  зимняя игра  ";
    component.submitAdd();

    expect(actions).toEqual([{kind: "add", day: "2027-05-15", note: "зимняя игра"}]);
  });

  it("offers nothing to add to a reader without promotion", () => {
    build({slots: [], canEdit: false});

    expect(text()).not.toContain("Добавить дату");
  });

  it("shows a taken date with its author, orgs and note", () => {
    build({
      slots: [makeSlot({
        is_free: false,
        owner: player(7, "@harry"),
        author_kind: SlotAuthorKind.team,
        team: {id: 3, name: "Сова", captain: null, description: null},
        orgs: [player(9, "@ron")],
        note: "зимняя игра",
      })],
      currentPlayerId: 7,
    });

    expect(text()).toContain("Сова");
    expect(text()).toContain("@ron");
    expect(text()).toContain("зимняя игра");
    expect(text()).toContain("ваша дата");
  });

  it("does not offer releasing a date a game already sits in", () => {
    build({
      slots: [makeSlot({
        is_free: false,
        owner: player(7, "@harry"),
        game: {id: 1, name: "Ночь", start_at: null, number: 12},
      })],
    });

    expect(text()).toContain("Ночь");
    expect(text()).not.toContain("Освободить");
    expect(text()).toContain("сначала отвяжите игру");
  });

  it("prefills the take window from the date as it stands", () => {
    const slot = makeSlot({
      is_free: false,
      owner: player(7, "@harry"),
      author_kind: SlotAuthorKind.team,
      team: {id: 3, name: "Сова", captain: null, description: null},
      orgs: [player(9, "@ron")],
    });
    build({slots: [slot], captainedTeams: [{id: 3, name: "Сова", description: null, captain: null, is_current: true}]});

    component.startTake(slot);

    expect(component.takeKind).toBe(SlotAuthorKind.team);
    expect(component.takeTeamId).toBe(3);
    expect(component.takeOrgs).toEqual([{id: 9, name_mention: "@ron"}]);

    component.submitTake();
    expect(actions).toEqual([{
      kind: "take", slot, authorKind: SlotAuthorKind.team, teamId: 3, orgIds: [9],
    }]);
  });

  it("offers a team only to a captain of one", () => {
    build({slots: [makeSlot()]});

    expect(component.canTakeAsTeam).toBeFalse();

    component.startTake(component.slots[0]);
    component.submitTake();

    expect(actions).toEqual([{
      kind: "take", slot: component.slots[0], authorKind: SlotAuthorKind.player, teamId: null, orgIds: [],
    }]);
  });

  it("asks before deleting, and emits only after the confirmation", () => {
    const slot = makeSlot();
    build({slots: [slot]});

    component.startRemove(slot);
    fixture.detectChanges();
    expect(text()).toContain("Удалить дату 15.05 из расписания?");
    expect(actions).toEqual([]);

    component.confirmRemove();
    expect(actions).toEqual([{kind: "remove", slot}]);
  });

  it("is the «move it here?» window while a date is being moved", () => {
    const moving = makeSlot({slot_date: "2027-05-08"});
    build({slots: [], moving});
    fixture.detectChanges();

    expect(text()).toContain("Перенести дату 08.05 на 15.05?");

    component.confirmMove();
    expect(actions).toEqual([{kind: "confirmMove", slot: moving, day: "2027-05-15"}]);
  });

  it("closes on Escape, but not while a request is in flight", () => {
    let closed = 0;
    build({slots: []});
    component.closed.subscribe(() => closed++);

    component.busy = true;
    component.onEscape();
    expect(closed).toBe(0);

    component.busy = false;
    component.onEscape();
    expect(closed).toBe(1);
  });

  it("drops a note typed for one day when another is opened", () => {
    build({slots: []});
    component.noteDraft = "зимняя игра";

    component.day = "2027-06-05";
    component.ngOnChanges({day: {currentValue: "2027-06-05", previousValue: "2027-05-15", firstChange: false, isFirstChange: () => false}});

    expect(component.noteDraft).toBe("");
  });
});
