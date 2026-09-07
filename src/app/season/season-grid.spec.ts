import {
  buildMonth,
  buildMonths,
  coveringRange,
  daysInMonth,
  indexSlots,
  isoDate,
  shortDate,
  weekdayIndex,
} from "./season-grid";
import {Slot} from "./season.models";

function slot(id: number, date: string): Slot {
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

describe("season-grid", () => {
  it("builds iso dates without going through a timezone", () => {
    expect(isoDate(2027, 5, 1)).toBe("2027-05-01");
    expect(isoDate(2027, 12, 31)).toBe("2027-12-31");
  });

  it("knows how long a month is, leap years included", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 5)).toBe(31);
    expect(daysInMonth(2027, 6)).toBe(30);
  });

  it("counts weekdays from Monday", () => {
    // 15 May 2027 is a Saturday
    expect(weekdayIndex(2027, 5, 15)).toBe(5);
    expect(weekdayIndex(2027, 5, 17)).toBe(0);
  });

  it("shows May–October by default", () => {
    expect(coveringRange(["2027-05-15", "2027-10-09"])).toEqual({from: 5, to: 10});
  });

  it("widens the view to cover a date outside it", () => {
    expect(coveringRange(["2027-01-09", "2027-05-15"])).toEqual({from: 1, to: 10});
    expect(coveringRange(["2027-12-04"])).toEqual({from: 5, to: 12});
  });

  it("ignores a date it cannot read", () => {
    expect(coveringRange(["not a date"])).toEqual({from: 5, to: 10});
  });

  it("pads a month card to whole weeks", () => {
    const card = buildMonth(2027, 5);

    expect(card.title).toBe("Май");
    for (const week of card.weeks) {
      expect(week.length).toBe(7);
    }
    const days = card.weeks.flat().filter(cell => cell.day !== null);
    expect(days.length).toBe(31);
    expect(days[0].date).toBe("2027-05-01");
    expect(days[30].date).toBe("2027-05-31");
  });

  it("builds every month of the range, inclusive", () => {
    expect(buildMonths(2027, {from: 5, to: 10}).map(card => card.month))
      .toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("indexes two dates on the same day together", () => {
    const index = indexSlots([slot(1, "2027-05-15"), slot(2, "2027-05-15"), slot(3, "2027-06-05")]);

    expect(index.get("2027-05-15")?.map(one => one.id)).toEqual([1, 2]);
    expect(index.get("2027-06-05")?.map(one => one.id)).toEqual([3]);
    expect(index.get("2027-07-01")).toBeUndefined();
  });

  it("shows a date without its year", () => {
    expect(shortDate("2027-05-15")).toBe("15.05");
  });
});
