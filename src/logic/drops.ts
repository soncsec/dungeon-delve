/** What a defeated enemy leaves behind, and where (engine-free, unit tested; seeded). */
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/tuning';
import type { Point } from './movement';
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

/**
 * Where a drop lands: where the enemy fell, unless that cell is hidden under
 * art or out of Jarrett's reach (a bird over a tree, a ghost in a wall). Then
 * it is the nearest cell he can walk to from where he stands (`walkable`) that
 * shows its drop (`shows`), at that cell's bottom middle. If he can reach none
 * (he never should), it stays where it fell.
 */
export function dropSpot(
  at: Point,
  hero: Point,
  walkable: (cx: number, cy: number) => boolean,
  shows: (cx: number, cy: number) => boolean,
): Point {
  const cellOf = (p: Point) => ({ x: Math.floor(p.x / TILE), y: Math.floor((p.y - 1) / TILE) });
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < ROOM_COLS && y < ROOM_ROWS;
  // Every cell he can walk to from where he stands.
  const start = cellOf(hero);
  const reach = new Set<string>();
  const cells: { x: number; y: number }[] = [];
  if (inside(start.x, start.y) && walkable(start.x, start.y)) {
    const todo = [start];
    reach.add(`${start.x},${start.y}`);
    cells.push(start);
    while (todo.length > 0) {
      const c = todo.pop() as { x: number; y: number };
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (!inside(x, y) || reach.has(`${x},${y}`) || !walkable(x, y)) continue;
        reach.add(`${x},${y}`);
        cells.push({ x, y });
        todo.push({ x, y });
      }
    }
  }
  const fell = cellOf(at);
  const fine = (x: number, y: number) => reach.has(`${x},${y}`) && shows(x, y);
  if (fine(fell.x, fell.y)) return at;
  let best: { x: number; y: number; d: number } | null = null;
  for (const { x, y } of cells) {
    if (!shows(x, y)) continue;
    const d = (x - fell.x) ** 2 + (y - fell.y) ** 2;
    // Nearest first; on a tie, the higher cell, then the one further left (a fixed order).
    if (!best || d < best.d || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) {
      best = { x, y, d };
    }
  }
  return best ? { x: best.x * TILE + TILE / 2, y: (best.y + 1) * TILE - 1 } : at;
}
