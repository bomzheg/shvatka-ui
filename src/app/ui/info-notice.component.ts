import {AsyncPipe} from "@angular/common";
import {Component, Input, OnChanges} from "@angular/core";
import {Observable, combineLatest, map, of} from "rxjs";

import {DocPage, DocPageLink} from "../docs/doc-pages";
import {DocsService} from "../docs/docs.service";

/**
 * A hint next to a form or a list: what the thing does, what happens next.
 *
 * Give it a `doc` and it also offers the documentation page that explains the
 * rule in full — the same idea as the «Справка» action on an error, for the
 * hints shown before anything went wrong. The url and the page's title come
 * from the engine (`DocsService`), so this only ever names the page.
 */
@Component({
  selector: "app-info-notice",
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <span class="notice-icon">ℹ️</span>
    <div class="notice-body">
      <p class="notice-text"><ng-content/></p>
      @if (links | async; as pages) {
        @if (pages.length) {
          <p class="notice-docs">Подробнее:
            @for (page of pages; track page.url; let last = $last) {
              <a class="notice-doc" [href]="page.url" target="_blank" rel="noopener">{{ page.title }}</a>@if (!last) {<span aria-hidden="true"> · </span>}
            }
          </p>
        }
      }
    </div>
    <ng-content select="[notice-action]"/>
  `,
  styles: [`
    :host {
      display: flex;
      gap: 0.65rem;
      align-items: flex-start;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 10px;
      padding: 0.75rem;
    }

    .notice-body {
      flex: 1;
      min-width: 0;
    }

    .notice-text {
      margin: 0;
      font-size: 0.9rem;
      color: var(--app-text);
    }

    .notice-text ::ng-deep a {
      color: inherit;
    }

    .notice-docs {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: var(--app-text);
    }

    .notice-doc {
      color: var(--app-accent);
    }
  `],
})
export class InfoNoticeComponent implements OnChanges {
  /** The page — or pages, when a hint spans two of them — that explain it. */
  @Input() doc?: DocPage | DocPage[];
  links: Observable<DocPageLink[]> = of([]);

  constructor(private docs: DocsService) {}

  ngOnChanges(): void {
    const pages = this.doc === undefined ? [] : ([] as DocPage[]).concat(this.doc);
    this.links = pages.length
      ? combineLatest(pages.map(page => this.docs.page(page))).pipe(
          map(links => links.filter((link): link is DocPageLink => link !== null)),
        )
      : of([]);
  }
}
