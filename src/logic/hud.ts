/** What the status bar shows (engine-free, unit tested). */
import { heartStates, type Health } from './health';

export interface HeartIcon {
  x: number;
  /** Row: 0 on top, 1 below. */
  row: number;
  state: 'full' | 'half' | 'empty';
}

/** One icon per heart, left to right from `x0`, `spacing` pixels apart, `perRow` to a row (as in the NES Zelda). */
export function heartIcons(h: Health, x0: number, spacing: number, perRow: number): HeartIcon[] {
  return heartStates(h).map((state, i) => ({
    x: x0 + (i % perRow) * spacing,
    row: Math.floor(i / perRow),
    state,
  }));
}

/**
 * The mana bar's inner width for a given most-mana: `baseWidth` holds `base`
 * mana, and the bar grows in proportion (a Mana Crystal makes it longer).
 */
export function manaBarInner(max: number, base: number, baseWidth: number): number {
  return Math.round((baseWidth * max) / base);
}

/** The gem count as shown: three digits, capped at the most the bar can show. */
export function gemLabel(gems: number, max: number): string {
  const n = Math.min(max, Math.max(0, Math.floor(gems)));
  return String(n).padStart(String(max).length, '0');
}
