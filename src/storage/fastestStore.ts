/**
 * The fastest finish time, in localStorage under its own key (owner
 * 2026-10-20). Guarded like the save: with no storage, nothing is kept.
 */
import { parseFastest } from '../logic/fastest';

const KEY = 'dungeon-delve:fastest';

export function readFastest(): number | null {
  try {
    return parseFastest(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function writeFastest(ms: number): void {
  try {
    window.localStorage.setItem(KEY, String(Math.round(ms)));
  } catch {
    // No storage: nothing is kept.
  }
}
