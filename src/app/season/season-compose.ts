import {SlotDraft} from "./season.models";

/**
 * The working list of a season being composed.
 *
 * The engine never stores a half-built calendar (SHEP-0003 §No draft entity):
 * a season row exists only published, so composing one lives here — in
 * component state, mirrored to `localStorage` so a refresh does not lose nine
 * dates. It is a per-device draft like the theme: it never reaches the account
 * and never reaches another browser.
 *
 * The list is keyed by day, so composing two dates on one day is not possible;
 * the schema allows it and a published season can have one added.
 */

const STORAGE_PREFIX = "shvatka.season.compose.";

export function storageKey(year: number): string {
  return `${STORAGE_PREFIX}${year}`;
}

/** The saved draft of that year, or null when there is none to restore. */
export function loadDraft(year: number): SlotDraft[] | null {
  try {
    const raw = window.localStorage?.getItem(storageKey(year));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const drafts = parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .filter(item => typeof item["slot_date"] === "string")
      .map(item => ({
        slot_date: item["slot_date"] as string,
        note: typeof item["note"] === "string" ? item["note"] : null,
      }));
    return sortDrafts(drafts);
  } catch {
    // a private window, cleared site data, or somebody else's json: compose anew
    return null;
  }
}

export function saveDraft(year: number, drafts: SlotDraft[]): void {
  try {
    window.localStorage?.setItem(storageKey(year), JSON.stringify(drafts));
  } catch {
    // out of quota or storage denied: the draft still lives in component state
  }
}

export function clearDraft(year: number): void {
  try {
    window.localStorage?.removeItem(storageKey(year));
  } catch {
    // nothing to do — the caller is dropping the draft either way
  }
}

export function draftsFromDates(dates: string[]): SlotDraft[] {
  return sortDrafts(dates.map(slot_date => ({slot_date, note: null})));
}

export function addDraft(drafts: SlotDraft[], day: string, note: string | null = null): SlotDraft[] {
  if (drafts.some(draft => draft.slot_date === day)) {
    return drafts;
  }
  return sortDrafts([...drafts, {slot_date: day, note}]);
}

export function removeDraft(drafts: SlotDraft[], day: string): SlotDraft[] {
  return drafts.filter(draft => draft.slot_date !== day);
}

/** Moving onto a day that already holds a date drops the one being moved. */
export function moveDraft(drafts: SlotDraft[], from: string, to: string): SlotDraft[] {
  const moved = drafts.find(draft => draft.slot_date === from);
  if (!moved || from === to) {
    return drafts;
  }
  return addDraft(removeDraft(drafts, from), to, moved.note);
}

export function setDraftNote(drafts: SlotDraft[], day: string, note: string | null): SlotDraft[] {
  return drafts.map(draft => (draft.slot_date === day ? {...draft, note} : draft));
}

export function sortDrafts(drafts: SlotDraft[]): SlotDraft[] {
  return [...drafts].sort((a, b) => a.slot_date.localeCompare(b.slot_date));
}
