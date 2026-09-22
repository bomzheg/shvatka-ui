import {
  SlotMark,
  buildMonths,
  draftsAsSlots,
  formatDay,
  formatFullDay,
  markOf,
  monthRangeFor,
  parseDay,
  toIso,
} from "./season-calendar";
import {Slot} from "./season.models";

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

function owner(id: number) {
  return {id, can_be_author: true, name_mention: `@p${id}`, username: `p${id}`};
}

describe("formatDay", () => {
  it("names a date the way a line of text does", () => {
    expect(formatDay("2026-05-16")).toBe("16.05");
    expect(formatFullDay("2026-05-16")).toBe("16 мая 2026");
  });

  it("does not turn a day into a Date, so no timezone can shift it", () => {
    // the 1st of a month is what a UTC-parsing renderer gets wrong first
    expect(formatDay("2026-01-01")).toBe("01.01");
    expect(parseDay("2026-01-01")).toEqual({year: 2026, month: 1, day: 1});
  });

  it("renders an unusable day instead of throwing", () => {
    expect(formatDay(null)).toBe("?");
    expect(formatDay("вчера")).toBe("?");
    expect(parseDay("2026-5-1")).toBeNull();
  });
});

describe("monthRangeFor", () => {
  it("shows May–October when every date fits in it", () => {
    expect(monthRangeFor(["2026-05-16", "2026-10-31"])).toEqual({first: 5, last: 10});
  });

  it("widens to cover a date outside it, so a winter game is visible", () => {
    expect(monthRangeFor(["2026-02-14", "2026-05-16"])).toEqual({first: 2, last: 10});
    expect(monthRangeFor(["2026-05-16", "2026-12-05"])).toEqual({first: 5, last: 12});
  });

  it("keeps the default range for a season with no dates yet", () => {
    expect(monthRangeFor([])).toEqual({first: 5, last: 10});
  });
});

describe("markOf", () => {
  const mine = makeSlot("2026-05-16", {owner: owner(7), is_free: false});
  const theirs = makeSlot("2026-05-16", {owner: owner(9), is_free: false});

  it("marks a free date, a taken one and your own apart", () => {
    expect(markOf([makeSlot("2026-05-16")], 7)).toBe(SlotMark.free);
    expect(markOf([theirs], 7)).toBe(SlotMark.taken);
    expect(markOf([mine], 7)).toBe(SlotMark.mine);
  });

  it("has no mark for a day nothing is planned on", () => {
    expect(markOf([], 7)).toBeNull();
  });

  it("shows a linked game above everything else", () => {
    const linked = makeSlot("2026-05-16", {
      owner: owner(9),
      is_free: false,
      game: {id: 3, name: "Игра", start_at: null, number: 12},
    });
    expect(markOf([mine, linked], 7)).toBe(SlotMark.linked);
  });

  it("reads somebody else's date as taken when nobody is signed in", () => {
    expect(markOf([theirs], undefined)).toBe(SlotMark.taken);
    expect(markOf([mine], undefined)).toBe(SlotMark.taken);
  });
});

describe("buildMonths", () => {
  it("pads the first week so the 1st lands under its weekday", () => {
    // 1 May 2026 is a Friday — four blanks before it in a Monday-first week
    const [may] = buildMonths(2026, 5, 5, [], "2026-05-16", undefined);

    expect(may.title).toBe("Май 2026");
    expect(may.cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(may.cells[4]?.day).toBe("2026-05-01");
    expect(may.cells.length).toBe(4 + 31);
  });

  it("counts the days of a leap February", () => {
    const [february] = buildMonths(2028, 2, 2, [], "2028-05-16", undefined);

    expect(february.cells.filter(cell => cell !== null).length).toBe(29);
  });

  it("puts every date planned on one day into that day's cell", () => {
    const slots = [
      makeSlot("2026-05-16", {id: 1}),
      makeSlot("2026-05-16", {id: 2, owner: owner(7), is_free: false}),
    ];

    const [may] = buildMonths(2026, 5, 5, slots, "2026-05-01", 7);
    const cell = may.cells.find(one => one?.day === "2026-05-16");

    expect(cell?.slots.length).toBe(2);
    expect(cell?.mark).toBe(SlotMark.mine);
  });

  it("knows today and the days behind it", () => {
    const [may] = buildMonths(2026, 5, 5, [], "2026-05-16", undefined);
    const today = may.cells.find(one => one?.day === "2026-05-16");
    const yesterday = may.cells.find(one => one?.day === "2026-05-15");
    const tomorrow = may.cells.find(one => one?.day === "2026-05-17");

    expect(today?.isToday).toBeTrue();
    expect(yesterday?.isPast).toBeTrue();
    expect(tomorrow?.isPast).toBeFalse();
  });

  it("builds every month of the asked-for range", () => {
    const months = buildMonths(2026, 5, 10, [], "2026-05-16", undefined);

    expect(months.map(month => month.month)).toEqual([5, 6, 7, 8, 9, 10]);
  });
});

describe("draftsAsSlots", () => {
  it("renders a composed list through the same grid as a published one", () => {
    const slots = draftsAsSlots([
      {slot_date: "2026-05-16", note: "зимняя игра"},
      {slot_date: "2026-06-06", note: null},
    ]);

    expect(slots.map(slot => slot.slot_date)).toEqual(["2026-05-16", "2026-06-06"]);
    expect(slots.every(slot => slot.is_free && slot.owner === null)).toBeTrue();
    // the ids never leave the client, and must not collide with a real one
    expect(slots.every(slot => slot.id < 0)).toBeTrue();
    expect(markOf(slots.slice(0, 1), 7)).toBe(SlotMark.free);
  });
});

describe("toIso", () => {
  it("pads a one-digit month and day", () => {
    expect(toIso(2026, 5, 1)).toBe("2026-05-01");
  });
});
