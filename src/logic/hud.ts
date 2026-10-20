/** What the status bar shows (engine-free, unit tested). */
import { heartStates, type Health } from './health';

export interface HeartIcon {
  x: number;
  state: 'full' | 'half' | 'empty';
}

/** One icon per heart, left to right from `x0`, `spacing` pixels apart. */
export function heartIcons(h: Health, x0: number, spacing: number): HeartIcon[] {
  return heartStates(h).map((state, i) => ({ x: x0 + i * spacing, state }));
}

/** The gem count as shown: three digits, capped at the most the bar can show. */
export function gemLabel(gems: number, max: number): string {
  const n = Math.min(max, Math.max(0, Math.floor(gems)));
  return String(n).padStart(String(max).length, '0');
}
