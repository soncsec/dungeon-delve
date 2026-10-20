/** What a defeated enemy leaves behind (engine-free, unit tested; seeded). */
import type { Rng } from './rng';

export type Drop = 'gem' | 'heart';

/** Chances of each drop in whole percent; whatever is left of 100 drops nothing. */
export interface DropTable {
  gem: number;
  heart: number;
}

export function rollDrop(rng: Rng, table: DropTable): Drop | null {
  const { gem, heart } = table;
  if (![gem, heart].every((n) => Number.isInteger(n) && n >= 0) || gem + heart > 100) {
    throw new RangeError('drop chances must be whole percentages adding up to at most 100');
  }
  // A whole number 0–99, so the boundaries are exact.
  const roll = rng.int(0, 99);
  if (roll < gem) return 'gem';
  if (roll < gem + heart) return 'heart';
  return null;
}
