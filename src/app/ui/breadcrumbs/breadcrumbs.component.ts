import {Component, Input} from '@angular/core';
import {Router, RouterLink} from "@angular/router";

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

  constructor(private router: Router) {
  }

  isLast(index: number): boolean {
    return index === this.crumbs.length - 1;
  }

  /**
   * The current (last) crumb links to itself: clicking it reloads the current
   * route by navigating away and straight back, which re-creates the component
   * and re-runs its data loading.
   */
  reloadCurrent(event: Event): void {
    event.preventDefault();
    const url = this.router.url;
    this.router.navigateByUrl('/', {skipLocationChange: true})
      .then(() => this.router.navigateByUrl(url));
  }
}
