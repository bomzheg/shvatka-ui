/**
 * Picks the correct Russian plural form for a count.
 *
 * Russian has three forms governed by the count, e.g. for "игра":
 *   one  → 1 игра, 21 игра      (n % 10 === 1, except 11)
 *   few  → 2 игры, 23 игры      (n % 10 in 2..4, except 12..14)
 *   many → 5 игр, 11 игр, 0 игр (everything else)
 */
export function pluralRu(count: number, forms: {one: string; few: string; many: string}): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few;
  return forms.many;
}

/** Returns the declined "игра" noun matching `count` (игра / игры / игр). */
export function pluralizeGames(count: number): string {
  return pluralRu(count, {one: 'игра', few: 'игры', many: 'игр'});
}
