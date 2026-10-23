/**
 * The fastest finish (owner 2026-10-20: instead of a high score). Engine-free
 * and unit tested; src/storage/fastestStore.ts keeps it in localStorage, as a
 * whole number of milliseconds. Runs that used the ?dungeon=n skip don't count.
 */

/** Longer than this (a year) can't be a real finish: such a stored value is ignored. */
const MAX_MS = 1000 * 60 * 60 * 24 * 365;

/** A stored fastest time, if it is a sensible one (a whole number of ms, more than none); else null. */
export function parseFastest(raw: string | null): number | null {
  if (raw === null || !/^\d{1,12}$/.test(raw)) return null;
  const ms = Number(raw);
  return ms > 0 && ms <= MAX_MS ? ms : null;
}

/** Whether a finish in `ms` is a new fastest: not a play-test run, and quicker than the best (or the first). */
export function isNewBest(best: number | null, ms: number, cheated: boolean): boolean {
  return !cheated && ms > 0 && (best === null || ms < best);
}
