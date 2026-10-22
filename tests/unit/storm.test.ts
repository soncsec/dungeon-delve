import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/logic/rng';
import {
  markStrikes,
  patchUnder,
  patchesOf,
  stepStrikes,
  stormPatches,
  strikeHits,
} from '../../src/logic/storm';

/** An Rng whose int() always returns the lowest it may (so picks take the first left). */
const lowest: Rng = {
  next: () => 0,
  int: (min) => min,
  range: (min) => min,
  pick: (i) => i[0] as (typeof i)[number],
};
/** Cells 2-9 across, 2-5 down: 4 × 2 patches. */
const arena = { x: 2, y: 2, across: 4, down: 2 };

describe('the storm’s patches', () => {
  it('cover the arena in 2×2 patches, row by row', () => {
    expect(patchesOf(arena)).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 6, y: 2 },
      { x: 8, y: 2 },
      { x: 2, y: 4 },
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 8, y: 4 },
    ]);
  });

  it('the patch under a point, kept inside the arena', () => {
    expect(patchUnder(arena, { x: 72, y: 70 })).toEqual({ x: 4, y: 4 }); // cell 4,4
    expect(patchUnder(arena, { x: 88, y: 50 })).toEqual({ x: 4, y: 2 }); // cell 5,3
    expect(patchUnder(arena, { x: 0, y: 0 })).toEqual({ x: 2, y: 2 }); // off the arena: its corner
    expect(patchUnder(arena, { x: 300, y: 150 })).toEqual({ x: 8, y: 4 });
  });
});

describe('where the bolts fall', () => {
  const hero = { x: 72, y: 70 }; // patch 4,4

  it('calm: the patch under Jarrett, and a few others', () => {
    const p = stormPatches(arena, hero, false, 3, lowest);
    expect(p[0]).toEqual({ x: 4, y: 4 });
    expect(p).toHaveLength(4);
    expect(new Set(p.map((q) => `${q.x},${q.y}`)).size).toBe(4);
  });

  it('calm, asked for more than there are: every patch, once', () => {
    expect(stormPatches(arena, hero, false, 20, lowest)).toHaveLength(8);
  });

  it('fierce: every patch but one, and never his own spared', () => {
    const p = stormPatches(arena, hero, true, 3, lowest);
    expect(p).toHaveLength(7);
    expect(p).toContainEqual({ x: 4, y: 4 });
    expect(p).not.toContainEqual({ x: 2, y: 2 }); // the first of the rest, with this Rng
  });
});

describe('the bolts', () => {
  it('each strikes its delay after the marks go down', () => {
    let strikes = markStrikes(
      [
        { x: 2, y: 2 },
        { x: 4, y: 2 },
      ],
      800,
    );
    let step = stepStrikes(strikes, 500);
    expect(step.landed).toEqual([]);
    expect(step.pending.map((s) => s.inMs)).toEqual([300, 300]);
    strikes = step.pending;
    step = stepStrikes(strikes, 300);
    expect(step.landed).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 2 },
    ]);
    expect(step.pending).toEqual([]);
  });

  it('catch a body that overlaps the patch, not one beside it', () => {
    const patch = { x: 4, y: 4 }; // x 64-96, y 64-96
    expect(strikeHits(patch, { x: 60, y: 70, w: 10, h: 20 })).toBe(true);
    expect(strikeHits(patch, { x: 96, y: 70, w: 10, h: 20 })).toBe(false); // flush to its right
    expect(strikeHits(patch, { x: 70, y: 44, w: 10, h: 20 })).toBe(false); // flush above
    expect(strikeHits(patch, { x: 70, y: 96, w: 10, h: 20 })).toBe(false); // flush below
    expect(strikeHits(patch, { x: 54, y: 70, w: 10, h: 20 })).toBe(false); // flush to its left
  });
});
