/**
 * Shared navigation between the routing graph and the level it points at.
 *
 * The graph emits a level id; hosts render their level cards with the matching
 * {@link levelAnchorId}. {@link scrollToLevel} reveals that card — opening any
 * collapsed `<details>` around it — scrolls it into view and briefly highlights
 * it (see the `.scn-level-highlight` rule in `styles.scss`).
 */
export function levelAnchorId(id: string): string {
  return `scn-level-${id}`;
}

export function scrollToLevel(id: string): void {
  const el = document.getElementById(levelAnchorId(id));
  if (!el) {
    return;
  }

  let details: HTMLDetailsElement | null = el.closest('details');
  while (details) {
    details.open = true;
    details = details.parentElement?.closest('details') ?? null;
  }

  el.scrollIntoView({behavior: 'smooth', block: 'center'});
  el.classList.add('scn-level-highlight');
  window.setTimeout(() => el.classList.remove('scn-level-highlight'), 2500);
}
