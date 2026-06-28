import {Component, Input} from '@angular/core';
import {RouterLink} from "@angular/router";

/** One step in a breadcrumb trail. The last crumb is usually the current page. */
export interface Breadcrumb {
  label: string;
  /** Router link target; omit (or leave empty) for the current, non-clickable page. */
  link?: string | unknown[];
}

/**
 * Renders a simple breadcrumb navigation trail. Crumbs with a `link` are
 * clickable router links; the final crumb (the current page) is plain text and
 * marked `aria-current="page"`.
 */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumbs.component.html',
  styleUrl: './breadcrumbs.component.scss',
})
export class BreadcrumbsComponent {
  @Input() crumbs: Breadcrumb[] = [];

  isLast(index: number): boolean {
    return index === this.crumbs.length - 1;
  }
}
