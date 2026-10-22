/**
 * The Ward spell (Thunder Spire's prize, owner 2026-10-21) and the spark
 * barriers it lets Jarrett through. Engine-free and unit tested.
 *
 * The Ward is a bubble round Jarrett for a few seconds: while it is up,
 * nothing hurts him, and he can walk through spark barriers. It can't be cast
 * again while it is up. Near its end it starts to break up, as a warning.
 */
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/tuning';
import type { Point } from './movement';
import type { Room } from './room';

/** When the Ward drops (game time, ms); 0 before he has ever cast it. */
export type Ward = number;

export const NO_WARD: Ward = 0;

/** Raises the Ward at `now` for `ms`. */
export function raiseWard(now: number, ms: number): Ward {
  return now + ms;
}

/** Whether the Ward is up at `now`. */
export function isWarded(ward: Ward, now: number): boolean {
  return now < ward;
}

/** Whether the Ward is in its last `breakMs`, breaking up (still up, and still protecting him). */
export function isBreaking(ward: Ward, now: number, breakMs: number): boolean {
  return isWarded(ward, now) && now >= ward - breakMs;
}

/**
 * Whether Jarrett may pass through spark barriers: with the Ward up, or while
 * he is still in one when it drops (so he is never shut inside; the sparks
 * zap him instead and he walks out).
 */
export function sparksLetThrough(warded: boolean, inSparks: boolean): boolean {
  return warded || inSparks;
}

/** Whether any of the cells under Jarrett's feet box is a spark barrier. */
export function standsInSparks(
  room: Room,
  feet: Point,
  box: { halfWidth: number; height: number },
): boolean {
  // A hair inside the far edges, so a box flush against a cell line isn't in the next cell.
  const EPS = 1e-6;
  const left = Math.floor((feet.x - box.halfWidth) / TILE);
  const right = Math.floor((feet.x + box.halfWidth - EPS) / TILE);
  const top = Math.floor((feet.y - box.height) / TILE);
  const bottom = Math.floor((feet.y - EPS) / TILE);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (room.cells[y]?.[x]?.fixture === 'spark') return true;
    }
  }
  return false;
}

/** Which way a barrier's crackle runs: across a gap in a wall, so along the wall. */
export type SparkAxis = 'across' | 'down';

/**
 * Every spark barrier cell in a room, and which way its crackle runs: down
 * when it fills a gap in an upright wall (wall or barrier above and below it,
 * open ground both sides), across otherwise (a gap in a wall that runs across).
 */
export function sparksIn(room: Room): { x: number; y: number; axis: SparkAxis }[] {
  const blocks = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= ROOM_COLS || y >= ROOM_ROWS) return true;
    const cell = room.cells[y]?.[x];
    return cell?.wall === true || cell?.fixture === 'spark';
  };
  return room.cells.flatMap((row, y) =>
    row.flatMap((cell, x) => {
      if (cell.fixture !== 'spark') return [];
      const sides = blocks(x - 1, y) || blocks(x + 1, y);
      const ends = blocks(x, y - 1) && blocks(x, y + 1);
      const axis: SparkAxis = ends && !sides ? 'down' : 'across';
      return [{ x, y, axis }];
    }),
  );
}
