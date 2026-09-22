import {Slot, SlotDraft} from "./season.models";

/**
 * The calendar grid of a season: pure functions over the dates the API
 * returns, so the page component only has to render what they produce.
 *
 * A season is date-only and read in MSK by the engine, so days travel as
 * plain `YYYY-MM-DD` strings and are never turned into a `Date` with a time:
 * `new Date("2026-05-16")` is UTC midnight, which is the 15th for a reader
 * west of Greenwich. Everything here compares and formats the string itself.
 */

/** May–October: the months a season normally lives in. */
export const DEFAULT_FIRST_MONTH = 5;
export const DEFAULT_LAST_MONTH = 10;

export const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** The week starts on Monday here, as it does everywhere in Russian. */
export const WEEKDAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** How a day cell reads at a glance; mirrors the marks the bot calendar uses. */
export enum SlotMark {
  free = "free",
  taken = "taken",
  mine = "mine",
  linked = "linked",
}

export const SLOT_MARK_EMOJI: Record<SlotMark, string> = {
  [SlotMark.free]: "🟢",
  [SlotMark.taken]: "🔒",
  [SlotMark.mine]: "⭐",
  [SlotMark.linked]: "🎮",
};

export interface DayCell {
  /** The day as `YYYY-MM-DD`. */
  day: string;
  dayOfMonth: number;
  /** Every date planned on that day — two short games in one night are two. */
  slots: Slot[];
  mark: SlotMark | null;
  isToday: boolean;
  isPast: boolean;
}

export interface MonthCard {
  month: number;
  title: string;
  /** Leading `null`s pad the first week so the 1st lands under its weekday. */
  cells: (DayCell | null)[];
}

export function isoDay(date: Date): string {
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** «16.05» — how a date is named in a line of text. */
export function formatDay(iso: string | null | undefined): string {
  const parts = parseDay(iso);
  return parts ? `${pad(parts.day)}.${pad(parts.month)}` : "?";
}

/** «16 мая 2026» — how a date is named as a heading. */
export function formatFullDay(iso: string | null | undefined): string {
  const parts = parseDay(iso);
  if (!parts) return "?";
  return `${parts.day} ${MONTH_NAMES_GENITIVE[parts.month - 1]} ${parts.year}`;
}

export function parseDay(iso: string | null | undefined): {year: number; month: number; day: number} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return null;
  return {year: Number(match[1]), month: Number(match[2]), day: Number(match[3])};
}

/**
 * The months to show: May–October, widened to cover every date the season
 * actually has. A winter game is planned by extending the view, so the view
 * has to come back extended.
 */
export function monthRangeFor(days: string[]): {first: number; last: number} {
  let first = DEFAULT_FIRST_MONTH;
  let last = DEFAULT_LAST_MONTH;
  for (const day of days) {
    const parts = parseDay(day);
    if (!parts) continue;
    first = Math.min(first, parts.month);
    last = Math.max(last, parts.month);
  }
  return {first, last};
}

export function buildMonths(
  year: number,
  first: number,
  last: number,
  slots: Slot[],
  today: string,
  currentPlayerId: number | undefined,
): MonthCard[] {
  const byDay = groupByDay(slots);
  const months: MonthCard[] = [];
  for (let month = first; month <= last; month++) {
    months.push({
      month,
      title: `${MONTH_NAMES[month - 1]} ${year}`,
      cells: buildCells(year, month, byDay, today, currentPlayerId),
    });
  }
  return months;
}

export function groupByDay(slots: Slot[]): Map<string, Slot[]> {
  const byDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const day = byDay.get(slot.slot_date);
    if (day) {
      day.push(slot);
    } else {
      byDay.set(slot.slot_date, [slot]);
    }
  }
  return byDay;
}

/**
 * The mark of a day holding several dates is the most interesting of them:
 * a linked game outranks your own date, which outranks somebody else's.
 */
export function markOf(slots: Slot[], currentPlayerId: number | undefined): SlotMark | null {
  if (slots.length === 0) return null;
  if (slots.some(slot => slot.game !== null)) return SlotMark.linked;
  if (currentPlayerId !== undefined && slots.some(slot => slot.owner?.id === currentPlayerId)) {
    return SlotMark.mine;
  }
  if (slots.some(slot => slot.owner !== null)) return SlotMark.taken;
  return SlotMark.free;
}

/**
 * Drafts rendered as dates, so a composed season and a published one go
 * through the same grid. The ids are negative and never leave the client.
 */
export function draftsAsSlots(drafts: SlotDraft[]): Slot[] {
  return drafts.map((draft, index) => ({
    id: -(index + 1),
    slot_date: draft.slot_date,
    note: draft.note,
    owner: null,
    author_kind: null,
    team: null,
    orgs: [],
    game: null,
    taken_at: null,
    is_free: true,
  }));
}

function buildCells(
  year: number,
  month: number,
  byDay: Map<string, Slot[]>,
  today: string,
  currentPlayerId: number | undefined,
): (DayCell | null)[] {
  const cells: (DayCell | null)[] = [];
  // JS weeks start on Sunday; ours start on Monday
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  for (let i = 0; i < leading; i++) {
    cells.push(null);
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIso(year, month, day);
    const slots = byDay.get(iso) ?? [];
    cells.push({
      day: iso,
      dayOfMonth: day,
      slots,
      mark: markOf(slots, currentPlayerId),
      isToday: iso === today,
      isPast: iso < today,
    });
  }
  return cells;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
