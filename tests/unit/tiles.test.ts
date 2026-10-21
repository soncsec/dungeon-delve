import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/logic/room';
import {
  DUNGEON_COLUMNS,
  DUNGEON_FRAMES,
  FOREST_COLUMNS,
  FOREST_FRAMES,
  PROP_REGIONS,
  PROP_SHEET,
  crackAt,
  dungeonArt,
  dungeonFrame,
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

  it('stands the archway on its 4×3 block, drawn from the dungeon sheet', () => {
    expect(propDraw('arch', 8, 1)).toEqual({ prop: 'arch', x: 160, y: 64 });
    expect(PROP_SHEET.arch).toBe('dungeon');
    expect(PROP_SHEET.pine).toBe('forest');
  });

  it('stands the boulder on its 2×2 block', () => {
    expect(propDraw('boulder', 8, 3)).toEqual({ prop: 'boulder', x: 144, y: 80 });
  });

  it.each(Object.entries(PROP_REGIONS))('prop %s art is on its sheet and visible', (k, reg) => {
    const png =
      PROP_SHEET[k as keyof typeof PROP_SHEET] === 'dungeon'
        ? pngAlpha(`${process.cwd()}/public/assets/tiles/dungeon.png`)
        : FOREST_PNG;
    expect(reg.x + reg.w).toBeLessThanOrEqual(png.width);
    expect(reg.y + reg.h).toBeLessThanOrEqual(png.alpha.length / png.width);
    expect(hasPixels(png, reg.x, reg.y, reg.w, reg.h)).toBe(true);
  });
});

describe('dungeon tiles', () => {
  const DUNGEON_PNG = pngAlpha(`${process.cwd()}/public/assets/tiles/dungeon.png`);
  // Walls along the top two rows and down the left side, floor elsewhere.
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) => (y < 2 ? '####################' : '##..................')),
  );

  it('draws wall tops, and the brick face where a wall meets the floor', () => {
    expect(dungeonFrame(r, 5, 0)).toBe(DUNGEON_FRAMES.top);
    expect(dungeonFrame(r, 5, 1)).toBe(DUNGEON_FRAMES.face);
    // The left wall runs down to the room's bottom edge, and on past it: all tops.
    expect(dungeonFrame(r, 0, 9)).toBe(DUNGEON_FRAMES.top);
  });

  it('shades floor next to a wall on its left, and scatters cracks elsewhere', () => {
    expect(dungeonFrame(r, 2, 5)).toBe(DUNGEON_FRAMES.shadow);
    const floors = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 17 }, (_, x) => dungeonFrame(r, x + 3, y + 2)),
    ).flat();
    const cracked = floors.filter((f) => f !== DUNGEON_FRAMES.floor);
    expect(cracked.length).toBeGreaterThan(0);
    expect(cracked.length).toBeLessThan(floors.length / 4);
    for (const f of cracked) expect(DUNGEON_FRAMES.cracks).toContain(f);
  });

  it('crackAt is the same every time', () => {
    expect(crackAt(4, 7)).toBe(crackAt(4, 7));
    expect(crackAt(0, 0)).not.toBeNull();
  });

  it('lays one tile per cell and nothing else', () => {
    const art = dungeonArt(r);
    expect(art.ground).toHaveLength(200);
    expect(art.over).toEqual([]);
    expect(art.props).toEqual([]);
    expect(art.ground[0]).toEqual({ frame: DUNGEON_FRAMES.top, x: 0, y: 0 });
  });

  it('draws a locked door as the barred gate, and as floor once opened', () => {
    const d = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 0
          ? '#########KK#########'
          : y === 4
            ? '##..C...............'
            : '##..................',
      ),
    );
    expect(dungeonFrame(d, 9, 0)).toBe(DUNGEON_FRAMES.gate);
    expect(dungeonFrame(d, 9, 0, true)).not.toBe(DUNGEON_FRAMES.gate);
    const closed = dungeonArt(d);
    expect(closed.chests).toEqual([{ x: 64, y: 64 }]);
    expect(closed.ground[9]?.frame).toBe(DUNGEON_FRAMES.gate);
    // Opened: the door is floor and the chest is gone.
    const open = dungeonArt(d, () => true);
    expect(open.chests).toEqual([]);
    expect(open.ground[9]?.frame).not.toBe(DUNGEON_FRAMES.gate);
  });

  it('every dungeon frame is visible art on the sheet', () => {
    for (const f of [
      DUNGEON_FRAMES.top,
      DUNGEON_FRAMES.face,
      DUNGEON_FRAMES.floor,
      DUNGEON_FRAMES.shadow,
      DUNGEON_FRAMES.gate,
      ...DUNGEON_FRAMES.cracks,
    ]) {
      const x = (f % DUNGEON_COLUMNS) * 16;
      const y = Math.floor(f / DUNGEON_COLUMNS) * 16;
      expect(hasPixels(DUNGEON_PNG, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });
});
