import {Component, Input} from "@angular/core";

import {DocPage} from "../docs/doc-pages";
import {DocsService} from "../docs/docs.service";

/**
 * A hint next to a form or a list: what the thing does, what happens next.
 *
 * Give it a `doc` and it also offers the documentation page that explains the
 * rule in full — the same idea as the «Справка» action on an error, for the
 * hints shown before anything went wrong.
 */
@Component({
  selector: "app-info-notice",
  standalone: true,
  template: `
    <span class="notice-icon">ℹ️</span>
    <div class="notice-body">
      <p class="notice-text"><ng-content/></p>
      @if (doc) {
        <a class="notice-doc" [href]="url" target="_blank" rel="noopener">Подробнее в документации</a>
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
export class InfoNoticeComponent {
  @Input() doc?: DocPage;

  constructor(private docs: DocsService) {}

  get url(): string {
    return this.doc ? this.docs.pageUrl(this.doc) : "";
  }
}
