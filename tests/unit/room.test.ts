import { describe, expect, it } from 'vitest';
import {
  cellAt,
  edgeOpenings,
  isForest,
  exitsIn,
  fixturesIn,
  isPassage,
  isSolid,
  isWall,
  parseRoom,
  type Room,
} from '../../src/logic/room';

const OPEN = '....................';
const WALL = 'FFFFFFFFFFFFFFFFFFFF';
/** A room of grass with the given rows replaced. */
const room = (rows: Record<number, string> = {}): string[] =>
  Array.from({ length: 10 }, (_, y) => rows[y] ?? OPEN);

describe('parseRoom', () => {
  it('reads grass and forest', () => {
    const r = parseRoom(room({ 0: WALL }));
    expect(cellAt(r, 0, 0)).toEqual({
      solid: true,
      forest: true,
      wall: false,
      prop: null,
      fixture: null,
      exit: false,
    });
    expect(cellAt(r, 0, 1)).toEqual({
      solid: false,
      forest: false,
      wall: false,
      prop: null,
      fixture: null,
      exit: false,
    });
  });

  it('reads dungeon walls', () => {
    const r = parseRoom(room({ 0: '####################' }));
    expect(cellAt(r, 3, 0)).toEqual({
      solid: true,
      forest: false,
      wall: true,
      prop: null,
      fixture: null,
      exit: false,
    });
    expect(isWall(r, 3, 0)).toBe(true);
    expect(isWall(r, 3, 1)).toBe(false);
    // Outside the room, walls run on from the nearest edge cell.
    expect(isWall(r, 3, -2)).toBe(true);
    expect(isWall(r, -1, 5)).toBe(false);
    expect(isWall({ cells: [] } as Room, 0, 0)).toBe(false);
  });

  it('reads locked doors and chests, which block, and lists them', () => {
    const r = parseRoom(room({ 0: '#########KK#########', 4: '.....C..............' }));
    expect(cellAt(r, 9, 0)).toMatchObject({ solid: true, fixture: 'door' });
    expect(cellAt(r, 5, 4)).toMatchObject({ solid: true, fixture: 'chest' });
    expect(fixturesIn(r)).toEqual([
      { x: 9, y: 0, fixture: 'door' },
      { x: 10, y: 0, fixture: 'door' },
      { x: 5, y: 4, fixture: 'chest' },
    ]);
    // A door is a way through (once opened); a chest is not.
    expect(isPassage(r, 9, 0)).toBe(true);
    expect(isPassage(r, 5, 4)).toBe(false);
    expect(isPassage(r, 3, 3)).toBe(true);
    expect(isPassage(r, 30, 3)).toBe(true);
    expect(edgeOpenings(r, 'north').filter(Boolean)).toHaveLength(2);
  });

  it('reads an archway and its doorway', () => {
    const r = parseRoom(
      room({
        1: '........A...........',
        2: '.........DD.........',
      }),
    );
    expect(cellAt(r, 8, 1)?.prop).toBe('arch');
    // Lintel and pillars are solid; the opening is not.
    for (const [x, y] of [
      [8, 1],
      [11, 1],
      [8, 2],
      [11, 2],
      [8, 3],
      [11, 3],
    ] as const) {
      expect(isSolid(r, x, y), `${x},${y}`).toBe(true);
    }
    expect(isSolid(r, 9, 2)).toBe(false);
    expect(isSolid(r, 9, 3)).toBe(false);
    expect(cellAt(r, 9, 2)).toMatchObject({ solid: false, exit: true });
    expect(exitsIn(r)).toEqual([
      { x: 9, y: 2 },
      { x: 10, y: 2 },
    ]);
    // A doorway to another map is not a way into the room next door.
    expect(isPassage(r, 9, 2)).toBe(false);
  });

  it('lists pushable stones, with open floor under them', () => {
    const r = parseRoom(room({ 3: '..B.....B...........' }));
    expect(r.stones).toEqual([
      { cx: 2, cy: 3 },
      { cx: 8, cy: 3 },
    ]);
    expect(isSolid(r, 2, 3)).toBe(false);
    expect(parseRoom(room()).stones).toEqual([]);
  });

  it('anchors props and blocks their footprints', () => {
    const r = parseRoom(room({ 2: '.T...O...R....r..b.' + '.' }));
    expect(cellAt(r, 1, 2)?.prop).toBe('pine');
    expect(cellAt(r, 5, 2)?.prop).toBe('oak');
    // The oak blocks its whole 3-cell base, but only the anchor holds the prop.
    expect([4, 5, 6].map((x) => isSolid(r, x, 2))).toEqual([true, true, true]);
    expect(cellAt(r, 4, 2)?.prop).toBeNull();
    // The boulder blocks 2×2 from its top-left anchor.
    expect([isSolid(r, 9, 2), isSolid(r, 10, 2), isSolid(r, 9, 3), isSolid(r, 10, 3)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isSolid(r, 11, 2)).toBe(false);
    expect(cellAt(r, 14, 2)?.prop).toBe('rock');
    expect(cellAt(r, 17, 2)?.prop).toBe('bush');
  });

  it('rejects the wrong number of rows or columns', () => {
    expect(() => parseRoom(room().slice(1), 'r')).toThrow('r: expected 10 rows, got 9');
    expect(() => parseRoom(room({ 3: '...' }), 'r')).toThrow('r: row 3 has 3 columns, expected 20');
  });

  it('rejects unknown characters', () => {
    expect(() => parseRoom(room({ 4: '...?' + OPEN.slice(4) }), 'r')).toThrow(
      "r: unknown character '?' at column 3, row 4",
    );
  });

  it('rejects props that reach outside the room', () => {
    expect(() => parseRoom(room({ 1: 'O' + OPEN.slice(1) }), 'r')).toThrow(
      'r: oak at column 0, row 1 reaches outside the room',
    );
    expect(() => parseRoom(room({ 9: OPEN.slice(1) + 'R' }), 'r')).toThrow(
      'reaches outside the room',
    );
  });

  it('rejects props that overlap walls or each other', () => {
    expect(() => parseRoom(room({ 1: '.OF' + OPEN.slice(3) }), 'r')).toThrow(
      'r: oak at column 1, row 1 overlaps something at column 2, row 1',
    );
    // Two oaks sharing a base cell: each anchor is fine on its own.
    expect(() => parseRoom(room({ 1: '.O.O' + OPEN.slice(4) }), 'r')).toThrow('overlaps');
    // A boulder's footprint landing on another prop's anchor.
    expect(() =>
      parseRoom(room({ 1: '.R' + OPEN.slice(2), 2: '..r' + OPEN.slice(3) }), 'r'),
    ).toThrow('overlaps');
  });
});

describe('room queries', () => {
  const r = parseRoom(room({ 0: WALL, 9: 'F' + OPEN.slice(1) }));

  it('cellAt is null outside the room', () => {
    expect(cellAt(r, -1, 0)).toBeNull();
    expect(cellAt(r, 0, 10)).toBeNull();
  });

  it('isSolid treats outside the room as open', () => {
    expect(isSolid(r, 5, 0)).toBe(true);
    expect(isSolid(r, 5, -1)).toBe(false);
  });

  it('isForest continues the nearest edge cell outside the room', () => {
    expect(isForest(r, 5, -3)).toBe(true);
    expect(isForest(r, -1, 9)).toBe(true);
    expect(isForest(r, 25, 9)).toBe(false);
    // A malformed room with no cells has no forest anywhere.
    expect(isForest({ cells: [] } as Room, 0, 0)).toBe(false);
  });

  it('edgeOpenings lists open cells along each edge', () => {
    expect(edgeOpenings(r, 'north').every((open) => !open)).toBe(true);
    expect(edgeOpenings(r, 'south')).toEqual([false, ...Array<boolean>(19).fill(true)]);
    expect(edgeOpenings(r, 'west')).toEqual([false, ...Array<boolean>(8).fill(true), false]);
    expect(edgeOpenings(r, 'east')).toEqual([false, ...Array<boolean>(9).fill(true)]);
  });
});
