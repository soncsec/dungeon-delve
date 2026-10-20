import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/logic/room';
import {
  FOREST_COLUMNS,
  FOREST_FRAMES,
  PROP_REGIONS,
  forestFrame,
  propDraw,
  roomArt,
} from '../../src/logic/tiles';
import { hasPixels, pngAlpha } from './png';

const OPEN = '....................';
const room = (rows: Record<number, string>): string[] =>
  Array.from({ length: 10 }, (_, y) => rows[y] ?? OPEN);
const FOREST_PNG = pngAlpha(`${process.cwd()}/public/assets/tiles/forest.png`);

describe('forest frames', () => {
  it('are visible tiles on the forest sheet', () => {
    const frames = [
      FOREST_FRAMES.grass,
      ...[0, 1, 2].flatMap((i) => [
        FOREST_FRAMES.fill(i, 0),
        FOREST_FRAMES.fill(0, i),
        FOREST_FRAMES.left(i),
        FOREST_FRAMES.right(i),
        FOREST_FRAMES.aboveBottom(i),
        FOREST_FRAMES.bottom(i),
        FOREST_FRAMES.top(i),
      ]),
    ];
    for (const f of frames) {
      const x = (f % FOREST_COLUMNS) * 16;
      const y = Math.floor(f / FOREST_COLUMNS) * 16;
      expect(hasPixels(FOREST_PNG, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });

  it('repeat every 3 cells, including at negative positions', () => {
    expect(FOREST_FRAMES.fill(3, 4)).toBe(FOREST_FRAMES.fill(0, 1));
    expect(FOREST_FRAMES.fill(-1, -1)).toBe(FOREST_FRAMES.fill(2, 2));
  });
});

describe('forestFrame', () => {
  // Rows 2–6: a wall block columns 2–8 inside open grass.
  const r = parseRoom(
    room({
      2: '..FFFFFFF...........',
      3: '..FFFFFFF...........',
      4: '..FFFFFFF...........',
      5: '..FFFFFFF...........',
      6: '..FFFFFFF...........',
    }),
  );

  it('fills the inside', () => {
    expect(forestFrame(r, 5, 3)).toBe(FOREST_FRAMES.fill(5, 3));
  });

  it('uses the side pieces on the left and right edges', () => {
    expect(forestFrame(r, 2, 3)).toBe(FOREST_FRAMES.left(3));
    expect(forestFrame(r, 8, 3)).toBe(FOREST_FRAMES.right(3));
  });

  it('uses the trunk row at the bottom and the row above it, even at the corners', () => {
    expect(forestFrame(r, 5, 6)).toBe(FOREST_FRAMES.bottom(5));
    expect(forestFrame(r, 5, 5)).toBe(FOREST_FRAMES.aboveBottom(5));
    expect(forestFrame(r, 2, 6)).toBe(FOREST_FRAMES.bottom(2));
  });
});

describe('roomArt', () => {
  const r = parseRoom(room({ 0: 'FFFFFFFFFFFFFFFFFFFF', 3: 'FF..T...R.....O.....' }));
  const art = roomArt(r);

  it('lays grass under every cell, and forest on wall cells', () => {
    const grass = art.ground.filter((t) => t.frame === FOREST_FRAMES.grass);
    expect(grass).toHaveLength(200);
    expect(art.ground).toHaveLength(200 + 22);
  });

  it('puts tree tops above a wall top edge, but never above the room', () => {
    // Row 3's wall cells (0, 1) have grass above; row 0's run off the top of the room.
    expect(art.over).toEqual([
      { frame: FOREST_FRAMES.top(0), x: 0, y: 32 },
      { frame: FOREST_FRAMES.top(1), x: 16, y: 32 },
    ]);
  });

  it('places props by their anchors, sorted for depth', () => {
    expect(art.props.map((p) => p.prop)).toEqual(['pine', 'oak', 'boulder']);
    expect(art.props[0]).toEqual({ prop: 'pine', x: 72, y: 64 });
  });

  it('stands the boulder on its 2×2 block', () => {
    expect(propDraw('boulder', 8, 3)).toEqual({ prop: 'boulder', x: 144, y: 80 });
  });

  it.each(Object.entries(PROP_REGIONS))('prop %s art is on the sheet and visible', (_k, reg) => {
    expect(reg.x + reg.w).toBeLessThanOrEqual(FOREST_PNG.width);
    expect(reg.y + reg.h).toBeLessThanOrEqual(FOREST_PNG.alpha.length / FOREST_PNG.width);
    expect(hasPixels(FOREST_PNG, reg.x, reg.y, reg.w, reg.h)).toBe(true);
  });
});
