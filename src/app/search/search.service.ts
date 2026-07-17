import {Injectable} from '@angular/core';
import {map, Observable, of} from "rxjs";
import {HttpAdapter} from "../http/http.adapter";
import {Page} from "../games/games.service";
import {SearchResult, SearchScope} from "./search.models";

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  constructor(private http: HttpAdapter) {
  }

  search(query: string, scope: SearchScope): Observable<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of([]);
    }

    const params = new URLSearchParams({query: trimmed});
    // The backend defaults every filter to true — only send the disabled ones.
    (["games", "levels", "teams", "players"] as const)
      .filter(key => !scope[key])
      .forEach(key => params.set(key, "false"));

    return this.http.get<Page<SearchResult>>(`/search?${params.toString()}`)
      .pipe(map(page => page.content ?? []));
  }
}
