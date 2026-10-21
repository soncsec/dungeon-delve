import { describe, expect, it } from 'vitest';
import {
  cellAt,
  edgeOpenings,
  isForest,
  exitsIn,
  fixturesIn,
  gatesOpen,
  isPassage,
  isSolid,
  isWall,
  parseRoom,
  sealCells,
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
    expect(isWall({ cells: [], stones: [] } as Room, 0, 0)).toBe(false);
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
    expect(isForest({ cells: [], stones: [] } as Room, 0, 0)).toBe(false);
  });

  it('edgeOpenings lists open cells along each edge', () => {
    expect(edgeOpenings(r, 'north').every((open) => !open)).toBe(true);
    expect(edgeOpenings(r, 'south')).toEqual([false, ...Array<boolean>(19).fill(true)]);
    expect(edgeOpenings(r, 'west')).toEqual([false, ...Array<boolean>(8).fill(true), false]);
    expect(edgeOpenings(r, 'east')).toEqual([false, ...Array<boolean>(9).fill(true)]);
  });
});

describe('sealCells', () => {
  const sorted = (cells: { x: number; y: number }[]) => cells.map(({ x, y }) => `${x},${y}`).sort();

  it('closes each way out one cell in from the edge', () => {
    const hub = parseRoom([
      '#########..#########',
      '#########..#########',
      '##................##',
      '##................##',
      '....................',
      '....................',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ]);
    expect(sorted(sealCells(hub))).toEqual(
      sorted([
        { x: 9, y: 1 },
        { x: 10, y: 1 },
        { x: 9, y: 8 },
        { x: 10, y: 8 },
        { x: 1, y: 4 },
        { x: 1, y: 5 },
        { x: 18, y: 4 },
        { x: 18, y: 5 },
      ]),
    );
  });

  it('leaves closed rooms, walls, locked doors and doorways to other maps alone', () => {
    const closed = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 0 || y === 9 ? '####################' : '#..................#',
      ),
    );
    expect(sealCells(closed)).toEqual([]);
    const doors = parseRoom([
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ]);
    expect(sealCells(doors)).toEqual([]);
  });
});

describe('village rooms', () => {
  it('reads paths, flowers and tall grass as open ground', () => {
    const r = parseRoom(room({ 4: 'p,"q................' }));
    expect(r.cells[4]?.[0]).toMatchObject({ solid: false, ground: 'path' });
    expect(r.cells[4]?.[1]).toMatchObject({ solid: false, ground: 'flowers' });
    expect(r.cells[4]?.[2]).toMatchObject({ solid: false, ground: 'tall' });
    expect(r.cells[4]?.[3]).toMatchObject({ solid: false, ground: 'paving' });
    expect(r.cells[4]?.[4]?.ground).toBeUndefined();
  });

  it('blocks a house\u2019s 5×3 walls, and the village props\u2019 trunks', () => {
    const r = parseRoom(
      room({
        2: '.H....M.......S..nw.',
      }),
    );
    for (let y = 2; y <= 4; y++) {
      for (let x = 1; x <= 5; x++) expect(isSolid(r, x, y), `${x},${y}`).toBe(true);
    }
    expect(isSolid(r, 6, 2)).toBe(true); // the maple's two trunk cells: 6 and 7
    expect(isSolid(r, 7, 2)).toBe(true);
    expect(isSolid(r, 8, 2)).toBe(false); // nothing past the maple's trunk
    expect(isSolid(r, 15, 2)).toBe(true); // the stump's two: 14 and 15
    expect(isSolid(r, 17, 2) && isSolid(r, 18, 2)).toBe(true); // cone bush and shrub
    expect(r.cells[2]?.[1]?.prop).toBe('house');
  });
});

describe('ponds', () => {
  it('reads water as solid', () => {
    const r = parseRoom(room({ 3: '....WW..............', 4: '....WW..............' }));
    expect(r.cells[3]?.[4]).toMatchObject({ solid: true, water: true });
    expect(r.cells[3]?.[3]?.water).toBeUndefined();
  });

  it('allows rectangles at least 2×2, also against the room edge', () => {
    expect(() =>
      parseRoom(room({ 2: 'WWW.................', 3: 'WWW.................' })),
    ).not.toThrow();
  });

  it.each([
    ['one cell', { 3: '....W...............' }],
    ['one row', { 3: '....WWW.............' }],
    ['one column', { 3: '....W...............', 4: '....W...............' }],
    ['an L', { 3: '....WW..............', 4: '....WW..............', 5: '....WWW.............' }],
    [
      'a notch',
      { 3: '....WWW.............', 4: '....WW.W............', 5: '....WWWW............' },
    ],
  ])('rejects %s', (_, rows) => {
    expect(() => parseRoom(room(rows), 'pond')).toThrow("isn't a rectangle at least 2×2");
  });
});

describe('caves', () => {
  it('blocks the rock round a cave but not its doorway', () => {
    const r = parseRoom(room({ 1: '........V...........' }));
    for (const [x, y] of [
      [8, 1],
      [9, 1],
      [10, 1],
      [8, 2],
      [10, 2],
      [8, 3],
      [10, 3],
    ] as const) {
      expect(isSolid(r, x, y), `${x},${y}`).toBe(true);
    }
    expect(isSolid(r, 9, 2)).toBe(false);
    expect(isSolid(r, 9, 3)).toBe(false);
  });
});

describe('secrets in rooms', () => {
  it('reads false walls, holes, and stones on holes', () => {
    const r = parseRoom(room({ 3: 'hoQ.................' }));
    expect(r.cells[3]?.[0]).toMatchObject({ solid: true, forest: true, fixture: 'hollow' });
    expect(r.cells[3]?.[1]).toMatchObject({ solid: false, exit: true, ground: 'hole' });
    expect(r.cells[3]?.[2]).toMatchObject({ solid: false, exit: true, ground: 'hole' });
    expect(r.stones).toEqual([{ cx: 2, cy: 3 }]);
  });
});

describe('things the Axe and Fireball open', () => {
  it('reads cracked walls, thorn bushes, and boulders as breakable', () => {
    const r = parseRoom(room({ 3: 'x.t..R..............' }));
    expect(r.cells[3]?.[0]).toMatchObject({ solid: true, forest: true, fixture: 'cracked' });
    expect(r.cells[3]?.[2]).toMatchObject({ solid: true, prop: 'thorns', fixture: 'thorns' });
    for (const [x, y] of [
      [5, 3],
      [6, 3],
      [5, 4],
      [6, 4],
    ] as const) {
      expect(r.cells[y]?.[x], `${x},${y}`).toMatchObject({
        solid: true,
        fixture: 'boulder',
        anchor: { x: 5, y: 3 },
      });
    }
  });
});

describe('crystal switches and gates (Lightning)', () => {
  // A switch in the top wall at column 3; a gate across the way south at columns 9-10.
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 0 ? '###z################' : y === 9 ? '#########gg#########' : '#..................#',
    ),
  );

  it('parses a switch as part of the wall, and a gate as a blocking way through', () => {
    expect(cellAt(r, 3, 0)).toMatchObject({ solid: true, wall: true, fixture: 'switch' });
    expect(cellAt(r, 9, 9)).toMatchObject({ solid: true, wall: false, fixture: 'gate' });
    expect(isPassage(r, 9, 9)).toBe(true);
    expect(edgeOpenings(r, 'south').filter(Boolean)).toHaveLength(2);
  });

  it('opens its gates once a switch in the room is powered', () => {
    expect(gatesOpen(r, () => false)).toBe(false);
    expect(gatesOpen(r, (x, y) => x === 3 && y === 0)).toBe(true);
    expect(gatesOpen(r, (x, y) => x === 9 && y === 9)).toBe(false); // a gate isn't a switch
  });
});
