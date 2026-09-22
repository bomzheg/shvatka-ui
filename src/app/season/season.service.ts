import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {HttpAdapter} from "../http/http.adapter";
import {
  DefaultSlotDates,
  Season,
  SeasonYears,
  Slot,
  SlotDraft,
  TakeSlotBody,
} from "./season.models";

/**
 * The season schedule API (SHEP-0003 §API surface).
 *
 * Reading is public — a published season renders for an anonymous visitor.
 * Every write needs an authenticated author; promotion is the whole gate, and
 * a date someone else took may still be moved, re-assigned or freed by any
 * author, with the change trail saying who did it.
 */
@Injectable({providedIn: "root"})
export class SeasonService {
  constructor(private http: HttpAdapter) {}

  /** The years that have a published season. */
  getYears(): Observable<SeasonYears> {
    return this.http.get<SeasonYears>("/seasons");
  }

  getSeason(year: number): Observable<Season> {
    return this.http.get<Season>(`/seasons/${year}`);
  }

  /** The nine dates the default rule generates. Nothing is persisted. */
  getDefaults(year: number): Observable<DefaultSlotDates> {
    const qs = new URLSearchParams({year: String(year)}).toString();
    return this.http.get<DefaultSlotDates>(`/seasons/defaults?${qs}`);
  }

  /** Publish a composed season — the whole list in one request. */
  publish(year: number, slots: SlotDraft[]): Observable<Season> {
    return this.http.post<Season>("/seasons", {year, slots});
  }

  addSlot(year: number, day: string, note: string | null): Observable<Slot> {
    return this.http.post<Slot>(`/seasons/${year}/slots`, {slot_date: day, note});
  }

  moveSlot(year: number, slotId: number, day: string): Observable<Slot> {
    return this.http.patch<Slot>(`/seasons/${year}/slots/${slotId}`, {slot_date: day});
  }

  /** An empty note clears it; an omitted one would leave it alone. */
  editNote(year: number, slotId: number, note: string | null): Observable<Slot> {
    return this.http.patch<Slot>(`/seasons/${year}/slots/${slotId}`, {note: note ?? ""});
  }

  removeSlot(year: number, slotId: number): Observable<void> {
    return this.http.del<void>(`/seasons/${year}/slots/${slotId}`);
  }

  takeSlot(year: number, slotId: number, body: TakeSlotBody): Observable<Slot> {
    return this.http.post<Slot>(`/seasons/${year}/slots/${slotId}/take`, body);
  }

  releaseSlot(year: number, slotId: number): Observable<Slot> {
    return this.http.del<Slot>(`/seasons/${year}/slots/${slotId}/take`);
  }

  setOrgs(year: number, slotId: number, orgPlayerIds: number[]): Observable<Slot> {
    return this.http.put<Slot>(`/seasons/${year}/slots/${slotId}/orgs`, {
      org_player_ids: orgPlayerIds,
    });
  }
}
