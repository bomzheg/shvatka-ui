/**
 * Backend contracts for the season schedule (`/seasons`, SHEP-0003).
 *
 * A *season* is one calendar year's plan of games, as a list of *dates*
 * («дата игры», `slot` in the API). It exists on the server only once
 * published — composing one lives in component state, see
 * {@link ./season-compose}.
 *
 * `slot_date` is a plain `YYYY-MM-DD` day with no time of day: the time comes
 * from the real game linked to it.
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

/** Who is going to author the game on a taken date (open enum). */
export const SlotAuthorKind = {
  player: "player",
  team: "team",
} as const;

export type SlotAuthorKindValue = typeof SlotAuthorKind[keyof typeof SlotAuthorKind];

export interface Slot {
  id: number;
  slot_date: string;
  note: string | null;
  owner: SeasonPlayer | null;
  author_kind: string | null;
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
  slot_date: string;
  note: string | null;
}

/** Body of `POST /seasons/{year}/slots/{id}/take`. */
export interface TakeSlotBody {
  author_kind: SlotAuthorKindValue;
  team_id: number | null;
  org_player_ids: number[];
}

/** The name shown on a taken date: the team when it authors, else the owner. */
export function slotAuthorName(slot: Slot): string | null {
  if (slot.author_kind === SlotAuthorKind.team && slot.team) {
    return slot.team.name;
  }
  return slot.owner?.name_mention ?? null;
}

/** Whether the date belongs to the given player — «моя дата». */
export function isMySlot(slot: Slot, playerId: number | undefined): boolean {
  return playerId !== undefined && slot.owner?.id === playerId;
}
