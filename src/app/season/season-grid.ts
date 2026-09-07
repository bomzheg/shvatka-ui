import {Slot} from "./season.models";

/**
 * Pure helpers that lay a season's dates out as month cards. Kept free of
 * Angular so they can be unit-tested without TestBed.
 *
 * The default view is May–October, the months a season normally covers; a
 * season whose dates fall outside that range extends the view to cover them,
 * and the reader can extend it further, month by month, up to the whole year.
 */

export const DEFAULT_FIRST_MONTH = 5;
export const DEFAULT_LAST_MONTH = 10;

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** Monday first, as every Russian calendar is. */
export const WEEKDAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export interface MonthRange {
  from: number;
  to: number;
}

export interface DayCell {
  /** ISO date, or null for the padding before the 1st and after the last. */
  date: string | null;
  day: number | null;
}

export interface MonthCard {
  month: number;
  title: string;
  weeks: DayCell[][];
}

/** ISO date of a year/month/day, without going through a `Date` and its timezone. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday = 0 … Sunday = 6, for the leading padding of a month card. */
export function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/**
 * The months a season needs: May–October, widened to cover every date it
 * actually holds, so a January game is never invisible.
 */
export function coveringRange(dates: string[]): MonthRange {
  let from = DEFAULT_FIRST_MONTH;
  let to = DEFAULT_LAST_MONTH;
  for (const date of dates) {
    const month = monthOf(date);
    if (month === null) continue;
    if (month < from) from = month;
    if (month > to) to = month;
  }
  return {from, to};
}

export function monthOf(date: string): number | null {
  const month = Number(date.slice(5, 7));
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

export function buildMonth(year: number, month: number): MonthCard {
  const total = daysInMonth(year, month);
  const cells: DayCell[] = [];
  for (let i = 0; i < weekdayIndex(year, month, 1); i++) {
    cells.push({date: null, day: null});
  }
  for (let day = 1; day <= total; day++) {
    cells.push({date: isoDate(year, month, day), day});
  }
  while (cells.length % 7 !== 0) {
    cells.push({date: null, day: null});
  }
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return {month, title: MONTH_NAMES[month - 1], weeks};
}

export function buildMonths(year: number, range: MonthRange): MonthCard[] {
  const months: MonthCard[] = [];
  for (let month = range.from; month <= range.to; month++) {
    months.push(buildMonth(year, month));
  }
  return months;
}

/** Dates indexed by day, so a cell finds its date without scanning the season. */
export function indexSlots(slots: Slot[]): Map<string, Slot[]> {
  const index = new Map<string, Slot[]>();
  for (const slot of slots) {
    const existing = index.get(slot.date);
    if (existing) {
      // two short games in one night are two dates on the same day
      existing.push(slot);
    } else {
      index.set(slot.date, [slot]);
    }
  }
  return index;
}

/** `16.05` — the year lives in the page heading, not in every cell. */
export function shortDate(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}
