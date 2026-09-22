import {
  addDraft,
  clearDraft,
  draftsFromDates,
  loadDraft,
  moveDraft,
  removeDraft,
  saveDraft,
  setDraftNote,
  storageKey,
} from "./season-compose";

describe("the composed list", () => {
  it("keeps the dates in order however they were added", () => {
    const drafts = addDraft(draftsFromDates(["2026-06-06", "2026-05-16"]), "2026-05-30");

    expect(drafts.map(draft => draft.slot_date))
      .toEqual(["2026-05-16", "2026-05-30", "2026-06-06"]);
  });

  it("adds a date with its note and ignores a day already in the list", () => {
    const drafts = addDraft([], "2026-05-16", "зимняя игра");

    expect(drafts).toEqual([{slot_date: "2026-05-16", note: "зимняя игра"}]);
    expect(addDraft(drafts, "2026-05-16", "другая")).toBe(drafts);
  });

  it("removes a date and leaves the rest alone", () => {
    const drafts = draftsFromDates(["2026-05-16", "2026-06-06"]);

    expect(removeDraft(drafts, "2026-05-16").map(draft => draft.slot_date)).toEqual(["2026-06-06"]);
    expect(removeDraft(drafts, "2026-07-07")).toEqual(drafts);
  });

  it("moves a date, carrying its note with it", () => {
    const drafts = addDraft([], "2026-05-16", "зимняя игра");

    expect(moveDraft(drafts, "2026-05-16", "2026-05-23"))
      .toEqual([{slot_date: "2026-05-23", note: "зимняя игра"}]);
  });

  it("does nothing when the date is moved onto its own day, or does not exist", () => {
    const drafts = draftsFromDates(["2026-05-16"]);

    expect(moveDraft(drafts, "2026-05-16", "2026-05-16")).toBe(drafts);
    expect(moveDraft(drafts, "2026-07-07", "2026-07-08")).toBe(drafts);
  });

  it("edits and clears a note", () => {
    const drafts = draftsFromDates(["2026-05-16"]);

    expect(setDraftNote(drafts, "2026-05-16", "Тула")[0].note).toBe("Тула");
    expect(setDraftNote(drafts, "2026-05-16", null)[0].note).toBeNull();
  });
});

describe("the composed list in localStorage", () => {
  const year = 2999;

  afterEach(() => {
    window.localStorage.removeItem(storageKey(year));
  });

  it("survives a refresh", () => {
    saveDraft(year, draftsFromDates(["2999-05-16", "2999-06-06"]));

    expect(loadDraft(year)?.map(draft => draft.slot_date)).toEqual(["2999-05-16", "2999-06-06"]);
  });

  it("has nothing to restore when nothing was composed", () => {
    expect(loadDraft(year)).toBeNull();
  });

  it("is dropped when the season it composed has been published", () => {
    saveDraft(year, draftsFromDates(["2999-05-16"]));
    clearDraft(year);

    expect(loadDraft(year)).toBeNull();
  });

  it("composes anew rather than breaking on somebody else's json", () => {
    window.localStorage.setItem(storageKey(year), "{не json");

    expect(loadDraft(year)).toBeNull();
  });

  it("drops entries that carry no day", () => {
    window.localStorage.setItem(storageKey(year), JSON.stringify([{note: "без даты"}, {slot_date: "2999-05-16"}]));

    expect(loadDraft(year)).toEqual([{slot_date: "2999-05-16", note: null}]);
  });
});
