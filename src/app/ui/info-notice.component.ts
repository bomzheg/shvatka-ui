import {AsyncPipe} from "@angular/common";
import {Component, Input, OnChanges} from "@angular/core";
import {Observable, of} from "rxjs";

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
      @if (link | async; as page) {
        <a class="notice-doc" [href]="page.url" target="_blank" rel="noopener">
          Подробнее: {{ page.title }}
        </a>
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

    .notice-doc {
      display: inline-block;
      margin-top: 0.35rem;
      font-size: 0.85rem;
      color: var(--app-accent);
    }
  `],
})
export class InfoNoticeComponent implements OnChanges {
  @Input() doc?: DocPage;
  link: Observable<DocPageLink | null> = of(null);

  constructor(private docs: DocsService) {}

  ngOnChanges(): void {
    this.link = this.doc ? this.docs.page(this.doc) : of(null);
  }
}
