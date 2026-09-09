import {of} from "rxjs";

import {SeasonComponent} from "./season.component";
import {Slot} from "./season.models";

/**
 * The component is driven directly with stubs rather than through TestBed:
 * what these check is the decision to open a modal versus write to the
 * server, which is the component's own logic and needs no rendering.
 */

function makeSlot(id: number, date: string): Slot {
  return {
    id,
    date,
    note: null,
    owner: null,
    author_kind: null,
    team: null,
    orgs: [],
    game: null,
    taken_at: null,
    is_free: true,
  };
}

function build(canBeAuthor = true) {
  const seasons = {
    addSlot: jasmine.createSpy("addSlot").and.returnValue(of(makeSlot(1, "2027-07-03"))),
    getSeason: jasmine.createSpy("getSeason").and.returnValue(of(null)),
  };
  const users = {
    isUserLoaded: () => true,
    canBeAuthor: () => canBeAuthor,
    getMe: () => ({id: 1}),
  };
  const teams = {getCaptainedTeams: () => of({items: []})};
  const snackbar = {error: jasmine.createSpy("error"), success: jasmine.createSpy("success")};
  const route = {paramMap: of(new Map())};
  const router = {navigate: jasmine.createSpy("navigate")};
  const component = new SeasonComponent(
    seasons as never,
    users as never,
    teams as never,
    snackbar as never,
    route as never,
    router as never,
  );
  // the route sets this in ngOnInit, which these tests do not run
  component.year = 2027;
  return {component, seasons};
}

describe("SeasonComponent modal", () => {
  it("offers to add a date instead of adding it on tap", () => {
    const {component, seasons} = build();

    component.openEmptyDay({date: "2027-07-03", day: 3});

    expect(component.pendingDate).toBe("2027-07-03");
    expect(component.isModalOpen).toBeTrue();
    // the tap itself must not write — that was the complaint
    expect(seasons.addSlot).not.toHaveBeenCalled();
  });

  it("writes only once the modal's button is pressed", () => {
    const {component, seasons} = build();
    component.openEmptyDay({date: "2027-07-03", day: 3});

    component.addPendingDate();

    expect(seasons.addSlot).toHaveBeenCalledWith(2027, "2027-07-03");
  });

  it("adds nothing when the modal is dismissed", () => {
    const {component, seasons} = build();
    component.openEmptyDay({date: "2027-07-03", day: 3});

    component.closeModal();
    component.addPendingDate();

    expect(component.isModalOpen).toBeFalse();
    expect(seasons.addSlot).not.toHaveBeenCalled();
  });

  it("does not offer an empty day to a player without approval", () => {
    const {component} = build(false);

    component.openEmptyDay({date: "2027-07-03", day: 3});

    expect(component.isModalOpen).toBeFalse();
  });

  it("does not offer an empty day of a year that has no season yet", () => {
    const {component} = build();
    component.isMissing = true;

    component.openEmptyDay({date: "2027-07-03", day: 3});

    expect(component.isModalOpen).toBeFalse();
  });

  it("opens an existing date in the same modal", () => {
    const {component} = build();

    component.openSlot(makeSlot(7, "2027-05-15"));

    expect(component.selected?.id).toBe(7);
    expect(component.pendingDate).toBeNull();
    expect(component.modalTitle()).toBe("Дата 15.05");
  });

  it("closes on escape", () => {
    const {component} = build();
    component.openSlot(makeSlot(7, "2027-05-15"));

    component.onEscape();

    expect(component.isModalOpen).toBeFalse();
  });

  it("taps do nothing at all while a season is being composed", () => {
    const {component, seasons} = build();
    component.composing = true;

    component.openEmptyDay({date: "2027-07-03", day: 3});
    component.openSlot(makeSlot(7, "2027-05-15"));

    expect(component.isModalOpen).toBeFalse();
    expect(seasons.addSlot).not.toHaveBeenCalled();
  });

  it("lets any approved author edit a date, whoever owns it", () => {
    expect(build().component.canEdit()).toBeTrue();
    expect(build(false).component.canEdit()).toBeFalse();
  });
});
