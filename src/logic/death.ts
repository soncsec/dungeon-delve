/**
 * What happens when Jarrett runs out of hearts (engine-free, unit tested;
 * PROJECT.md §3a): he starts again at the last safe place with full hearts and
 * mana, keeping his items, keys and shards, but drops some of his gems.
 */

/** Gems he keeps after falling: he loses `percent` of them, rounded down (so a few gems are never lost). */
export function gemsAfterFalling(gems: number, percent: number): number {
  if (percent < 0 || percent > 100) throw new RangeError('percent must be 0–100');
  return gems - Math.floor((gems * percent) / 100);
}

/** The message shown while the screen is dark. */
export function fallMessage(lost: number): string[] {
  return lost > 0 ? ['JARRETT FELL...', `-${lost} GEMS`] : ['JARRETT FELL...'];
}
