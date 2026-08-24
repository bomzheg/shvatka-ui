import {Injectable} from "@angular/core";
import {Observable, catchError, map, of, shareReplay} from "rxjs";

import {HttpAdapter} from "../http/http.adapter";
import {DocPage, DocPageLink} from "./doc-pages";

interface DocPagesResponse {
  pages: Record<string, DocPageLink>;
}

/**
 * The documentation pages the ui links its own hints to.
 *
 * The engine owns where the docs live and what each page is called, so the ui
 * asks for the table once instead of building urls: no docs configuration here,
 * and a page renamed in the docs needs no change on this side. Errors carry
 * their own `docUrl` and never come through here.
 */
@Injectable({providedIn: "root"})
export class DocsService {
  private pages?: Observable<Record<string, DocPageLink>>;

  constructor(private http: HttpAdapter) {}

  page(page: DocPage): Observable<DocPageLink | null> {
    return this.load().pipe(map(pages => pages[page] ?? null));
  }

  private load(): Observable<Record<string, DocPageLink>> {
    if (!this.pages) {
      this.pages = this.http.get<DocPagesResponse>("/docs/pages").pipe(
        map(response => response.pages ?? {}),
        // a hint without its link is still a hint; never fail the page for it
        catchError(() => of({})),
        shareReplay({bufferSize: 1, refCount: false}),
      );
    }
    return this.pages;
  }
}
