import { describe, expect, it } from 'vitest';
import { dungeonMap } from '../../src/logic/dungeonMap';

// Dungeon 1's shape: a cross of six rooms.
const CROSS = [
  { col: 1, row: 0 },
  { col: 1, row: 1 },
  { col: 0, row: 2 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
  { col: 1, row: 3 },
];
const boss = (col: number, row: number) => col === 1 && row === 0;

describe('dungeonMap', () => {
  it('shows only the room he is in, at first', () => {
    const m = dungeonMap(CROSS, () => false, { col: 1, row: 3 }, boss);
    expect(m).toEqual({
      cols: 3,
      rows: 4,
      rooms: [{ x: 1, y: 3, current: true, boss: false, secret: false }],
    });
  });

  it('adds every room he has been in, top to bottom, and marks the boss room', () => {
    const seen = new Set(['1,3', '1,2', '0,2', '1,1', '1,0']);
    const m = dungeonMap(CROSS, (c, r) => seen.has(`${c},${r}`), { col: 1, row: 1 }, boss);
    expect(m.rooms).toEqual([
      { x: 1, y: 0, current: false, boss: true, secret: false },
      { x: 1, y: 1, current: true, boss: false, secret: false },
      { x: 0, y: 2, current: false, boss: false, secret: false },
      { x: 1, y: 2, current: false, boss: false, secret: false },
      { x: 1, y: 3, current: false, boss: false, secret: false },
    ]);
  });

  it('measures from the top-left room, wherever the dungeon sits', () => {
    const shifted = CROSS.map((c) => ({ col: c.col + 4, row: c.row + 2 }));
    const m = dungeonMap(
      shifted,
      () => true,
      { col: 6, row: 4 }, // the east room
      () => false,
    );
    expect(m.cols).toBe(3);
    expect(m.rows).toBe(4);
    expect(m.rooms.find((r) => r.current)).toEqual({
      x: 2,
      y: 2,
      current: true,
      boss: false,
      secret: false,
    });
  });

  it('marks a secret room in its own colour once found (M10.3b)', () => {
    const m = dungeonMap(
      CROSS,
      () => true,
      { col: 1, row: 3 },
      boss,
      (c, r) => c === 0 && r === 2,
    );
    expect(m.rooms.filter((r) => r.secret).map((r) => `${r.x},${r.y}`)).toEqual(['0,2']);
  });
});
