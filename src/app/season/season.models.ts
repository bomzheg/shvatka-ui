/**
 * The season schedule as the engine serves it (`/seasons`, SHEP-0003).
 *
 * A season is one calendar year's plan of games, as a list of dates. A date is
 * a `Slot` in the api because `date` is unusable as an identifier — in Russian
 * copy it is always «дата», never «слот».
 */

export interface SeasonPlayer {
  id: number;
  can_be_author: boolean;
  name_mention: string;
  username: string | null;
}

export interface SeasonTeam {
  id: number;
  name: string;
  captain: SeasonPlayer | null;
  description: string | null;
}

/** The little a date knows about the game sitting in it. */
export interface LinkedGame {
  id: number;
  name: string;
  start_at: string | null;
  number: number | null;
}

export type SlotAuthorKind = "player" | "team";

export interface Slot {
  id: number;
  /** ISO date, no time of day: the time comes from the real game. */
  date: string;
  note: string | null;
  owner: SeasonPlayer | null;
  author_kind: SlotAuthorKind | null;
  team: SeasonTeam | null;
  orgs: SeasonPlayer[];
  game: LinkedGame | null;
  taken_at: string | null;
  is_free: boolean;
}

export interface Season {
  id: number;
  year: number;
  published_at: string;
  updated_at: string;
  slots: Slot[];
}

export interface SeasonYears {
  years: number[];
}

export interface DefaultSlotDates {
  year: number;
  dates: string[];
}

/** One date of a season being composed. Nothing of it is persisted yet. */
export interface SlotDraft {
  date: string;
  note?: string | null;
}

export interface TakeSlotBody {
  author_kind: SlotAuthorKind;
  team_id?: number | null;
  org_player_ids?: number[];
}

/** Who the date belongs to, for display. */
export function slotAuthorName(slot: Slot): string | null {
  if (slot.author_kind === "team" && slot.team) return slot.team.name;
  return slot.owner?.name_mention ?? null;
}

export function isMine(slot: Slot, playerId: number | undefined): boolean {
  return playerId !== undefined && slot.owner?.id === playerId;
}
