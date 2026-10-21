/**
 * Pushable stones (engine-free, unit tested): leaning on a stone for a moment
 * slides it one cell, if the cell beyond is clear. Stones are reset whenever
 * Jarrett comes back into the room, as in Zelda.
 */
import type { Facing } from './hero';

export interface Stone {
  cx: number;
  cy: number;
}

/** How long he has been leaning on which stone. */
export interface Lean {
  stone: number | null;
  ms: number;
}

export const NO_LEAN: Lean = { stone: null, ms: 0 };

const STEP: Readonly<Record<Facing, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** The stone (by index) in a cell, or -1. */
export function stoneAt(stones: readonly Stone[], cx: number, cy: number): number {
  return stones.findIndex((s) => s.cx === cx && s.cy === cy);
}

/**
 * Leaning on stone `index` for `dtMs` more. Once he has leant for `pushMs`,
 * it slides one cell the way he faces, if `free` says the cell beyond is
 * clear; then the lean starts again. Returns the stones (moved or not), the
 * lean, and which stone moved, if any.
 */
export function lean(
  stones: readonly Stone[],
  state: Lean,
  index: number,
  facing: Facing,
  dtMs: number,
  pushMs: number,
  free: (cx: number, cy: number) => boolean,
): { stones: readonly Stone[]; lean: Lean; moved: number | null } {
  const ms = state.stone === index ? state.ms + dtMs : dtMs;
  const stone = stones[index];
  if (!stone || ms < pushMs) return { stones, lean: { stone: index, ms }, moved: null };
  const [dx, dy] = STEP[facing];
  const to = { cx: stone.cx + dx, cy: stone.cy + dy };
  if (!free(to.cx, to.cy) || stoneAt(stones, to.cx, to.cy) >= 0) {
    return { stones, lean: { stone: index, ms }, moved: null };
  }
  return { stones: stones.map((s, i) => (i === index ? to : s)), lean: NO_LEAN, moved: index };
}
