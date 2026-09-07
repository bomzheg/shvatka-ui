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
 * Api access for the season schedule. Reading is public; every write needs an
 * authenticated author, and the engine is the one that says so.
 */
@Injectable({providedIn: "root"})
export class SeasonService {
  constructor(private http: HttpAdapter) {}

  listYears(): Observable<SeasonYears> {
    return this.http.get<SeasonYears>("/seasons");
  }

  getSeason(year: number): Observable<Season> {
    return this.http.get<Season>(`/seasons/${year}`);
  }

  getCurrent(): Observable<Season> {
    return this.http.get<Season>("/seasons/current");
  }

  /** The nine dates a season is composed from. Nothing is persisted. */
  getDefaults(year: number): Observable<DefaultSlotDates> {
    return this.http.get<DefaultSlotDates>(`/seasons/defaults?year=${year}`);
  }

  publish(year: number, slots: SlotDraft[]): Observable<Season> {
    return this.http.post<Season>("/seasons", {year, slots});
  }

  addSlot(year: number, date: string, note?: string | null): Observable<Slot> {
    return this.http.post<Slot>(`/seasons/${year}/slots`, {date, note: note ?? null});
  }

  /** An omitted note leaves it alone; an empty string clears it. */
  editSlot(
    year: number,
    slotId: number,
    changes: {date?: string; note?: string},
  ): Observable<Slot> {
    return this.http.patch<Slot>(`/seasons/${year}/slots/${slotId}`, changes);
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

  linkGame(year: number, slotId: number, gameId: number): Observable<Slot> {
    return this.http.post<Slot>(`/seasons/${year}/slots/${slotId}/game`, {game_id: gameId});
  }

  unlinkGame(year: number, slotId: number): Observable<Slot> {
    return this.http.del<Slot>(`/seasons/${year}/slots/${slotId}/game`);
  }

  /** Dates within ±3 days of a planned start that are free or already yours. */
  suggest(at: string): Observable<Slot[]> {
    return this.http.get<Slot[]>(`/seasons/slots/suggest?at=${encodeURIComponent(at)}`);
  }
}
