import { describe, expect, it } from 'vitest';
import {
  buildWorld,
  cellsAhead,
  enterFrom,
  exitAt,
  exitDirection,
  joinProblems,
  neighbour,
  roomKey,
  solidInWorld,
  type RoomDef,
} from '../../src/logic/world';
import { OVERWORLD, START_ROOM } from '../../src/world/overworld';

const OPEN = '....................';
const WALL = 'FFFFFFFFFFFFFFFFFFFF';
const SIDES = 'F..................F';
/** A walled room with optional gaps: north/south at columns 9–10, east/west at rows 4–5. */
function walled(
  col: number,
  row: number,
  gaps: { n?: boolean; s?: boolean; e?: boolean; w?: boolean },
): RoomDef {
  const lines = Array.from({ length: 10 }, (_, y) => {
    if (y === 0) return gaps.n ? 'FFFFFFFFF..FFFFFFFFF' : WALL;
    if (y === 9) return gaps.s ? 'FFFFFFFFF..FFFFFFFFF' : WALL;
    if (y === 4 || y === 5) return `${gaps.w ? '.' : 'F'}${OPEN.slice(2)}${gaps.e ? '.' : 'F'}`;
    return SIDES;
  });
  return { col, row, lines };
}

describe('world', () => {
  it('builds rooms by grid position', () => {
    const w = buildWorld([walled(0, 0, {}), walled(3, 1, {})]);
    expect([...w.rooms.keys()]).toEqual(['0,0', '3,1']);
  });

  it('rejects two rooms in one place', () => {
    expect(() => buildWorld([walled(0, 0, {}), walled(0, 0, {})])).toThrow('two rooms at 0,0');
  });

  it('names rooms in parse errors', () => {
    expect(() => buildWorld([{ col: 2, row: 5, lines: [] }])).toThrow('room 2,5: expected 10 rows');
  });

  it('finds neighbours in each direction', () => {
    expect(neighbour(1, 1, 'north')).toEqual({ col: 1, row: 0 });
    expect(neighbour(1, 1, 'south')).toEqual({ col: 1, row: 2 });
    expect(neighbour(1, 1, 'east')).toEqual({ col: 2, row: 1 });
    expect(neighbour(1, 1, 'west')).toEqual({ col: 0, row: 1 });
    expect(roomKey(4, 7)).toBe('4,7');
  });

  it('accepts rooms whose gaps line up', () => {
    const w = buildWorld([
      walled(0, 0, { e: true, s: true }),
      walled(1, 0, { w: true }),
      walled(0, 1, { n: true }),
    ]);
    expect(joinProblems(w)).toEqual([]);
  });

  it('reports a gap with no room behind it', () => {
    const w = buildWorld([walled(0, 0, { n: true })]);
    expect(joinProblems(w)).toEqual(['room 0,0: north edge is open but there is no room there']);
  });

  it('reports gaps that do not line up', () => {
    const w = buildWorld([walled(0, 0, { e: true }), walled(1, 0, {})]);
    expect(joinProblems(w)).toEqual([
      'room 0,0: east edge cell 4 is open but the room next door is not',
      'room 0,0: east edge cell 5 is open but the room next door is not',
      'room 1,0: west edge cell 4 is blocked but the room next door is not',
      'room 1,0: west edge cell 5 is blocked but the room next door is not',
    ]);
  });
});

describe('the overworld data', () => {
  const world = buildWorld(OVERWORLD);

  it('parses, and every gap lines up with the room next door', () => {
    expect(joinProblems(world)).toEqual([]);
  });

  it('has the start room', () => {
    expect(world.rooms.has(roomKey(START_ROOM.col, START_ROOM.row))).toBe(true);
  });
});

describe('moving between rooms', () => {
  // Two rooms side by side, joined at rows 4–5; the west room also has a north gap with nothing behind it.
  const w = buildWorld([walled(0, 0, { e: true }), walled(1, 0, { w: true })]);

  it('solidInWorld looks inside the room, then into the neighbours', () => {
    expect(solidInWorld(w, 0, 0, 5, 5)).toBe(false);
    expect(solidInWorld(w, 0, 0, 0, 0)).toBe(true);
    // Column 20 of room 0,0 is column 0 of room 1,0: open at rows 4–5, wall elsewhere.
    expect(solidInWorld(w, 0, 0, 20, 4)).toBe(false);
    expect(solidInWorld(w, 0, 0, 20, 3)).toBe(true);
    // From room 1,0 looking west.
    expect(solidInWorld(w, 1, 0, -1, 5)).toBe(false);
    expect(solidInWorld(w, 1, 0, -1, 6)).toBe(true);
  });

  it('solidInWorld treats places with no room as solid', () => {
    expect(solidInWorld(w, 0, 0, -1, 4)).toBe(true);
    expect(solidInWorld(w, 0, 0, 5, -1)).toBe(true);
    expect(solidInWorld(w, 1, 0, 5, 10)).toBe(true);
  });

  it('exitDirection fires when the middle of the box leaves the room', () => {
    expect(exitDirection({ x: 160, y: 80 }, 6)).toBeNull();
    expect(exitDirection({ x: -0.5, y: 80 }, 6)).toBe('west');
    expect(exitDirection({ x: 320, y: 80 }, 6)).toBe('east');
    expect(exitDirection({ x: 319.9, y: 80 }, 6)).toBeNull();
    expect(exitDirection({ x: 160, y: 2.9 }, 6)).toBe('north');
    expect(exitDirection({ x: 160, y: 3 }, 6)).toBeNull();
    expect(exitDirection({ x: 160, y: 163 }, 6)).toBe('south');
    expect(exitDirection({ x: 160, y: 162.9 }, 6)).toBeNull();
  });

  it('enterFrom gives the same spot in the next room', () => {
    expect(enterFrom({ x: 321, y: 80 }, 'east')).toEqual({ x: 1, y: 80 });
    expect(enterFrom({ x: -1, y: 80 }, 'west')).toEqual({ x: 319, y: 80 });
    expect(enterFrom({ x: 150, y: 2 }, 'north')).toEqual({ x: 150, y: 162 });
    expect(enterFrom({ x: 150, y: 164 }, 'south')).toEqual({ x: 150, y: 4 });
  });
});

describe('enemy placements', () => {
  it('keeps each room’s enemy cells', () => {
    const w = buildWorld([
      { ...walled(0, 0, {}), enemies: [{ kind: 'wolf', col: 3, row: 4 }] },
      walled(1, 0, {}),
    ]);
    expect(w.enemies.get('0,0')).toEqual([{ kind: 'wolf', col: 3, row: 4 }]);
    expect(w.enemies.get('1,0')).toEqual([]);
  });

  it('rejects an enemy in a wall or outside the room', () => {
    expect(() =>
      buildWorld([{ ...walled(0, 0, {}), enemies: [{ kind: 'robot', col: 0, row: 0 }] }]),
    ).toThrow('room 0,0: robot at column 0, row 0 is not on open ground');
    expect(() =>
      buildWorld([{ ...walled(0, 0, {}), enemies: [{ kind: 'eye', col: 25, row: 3 }] }]),
    ).toThrow('room 0,0: eye at column 25, row 3 is not on open ground');
  });

  it('every enemy in the overworld starts on open ground', () => {
    expect(() => buildWorld(OVERWORLD)).not.toThrow();
    expect([...buildWorld(OVERWORLD).enemies.values()].flat().length).toBeGreaterThan(0);
  });
});

describe('doors and chests', () => {
  const lines = (rows: Record<number, string>): string[] =>
    Array.from({ length: 10 }, (_, y) => rows[y] ?? '#..................#');
  const room = lines({
    0: '#########KK#########',
    4: '#....C.............#',
    9: '####################',
  });

  it('a locked door counts as a doorway when rooms join up', () => {
    const above = {
      col: 0,
      row: -1,
      lines: lines({ 0: '####################', 9: '#########..#########' }),
    };
    const w = buildWorld([
      { col: 0, row: 0, lines: room, chests: [{ col: 5, row: 4, contents: { kind: 'key' } }] },
      above,
    ]);
    expect(joinProblems(w)).toEqual([]);
    expect(w.chests.get('0,0')).toEqual([{ col: 5, row: 4, contents: { kind: 'key' } }]);
  });

  it('every chest needs exactly one list of contents, on a chest', () => {
    expect(() => buildWorld([{ col: 0, row: 0, lines: room }])).toThrow(
      'room 0,0: the chest at column 5, row 4 has 0 lists of contents, not 1',
    );
    expect(() =>
      buildWorld([
        {
          col: 0,
          row: 0,
          lines: room,
          chests: [
            { col: 5, row: 4, contents: { kind: 'key' } },
            { col: 5, row: 4, contents: { kind: 'gems', amount: 5 } },
          ],
        },
      ]),
    ).toThrow('has 2 lists of contents');
    expect(() =>
      buildWorld([
        {
          col: 0,
          row: 0,
          lines: room,
          chests: [
            { col: 5, row: 4, contents: { kind: 'key' } },
            { col: 6, row: 4, contents: { kind: 'potion', potion: 'mana' } },
          ],
        },
      ]),
    ).toThrow('room 0,0: chest contents at column 6, row 4, but no chest there');
  });

  it('doors and chests block until opened', () => {
    const w = buildWorld([
      {
        col: 0,
        row: 0,
        lines: room,
        chests: [{ col: 5, row: 4, contents: { kind: 'item', item: 'daggers' } }],
      },
    ]);
    expect(solidInWorld(w, 0, 0, 9, 0)).toBe(true);
    expect(solidInWorld(w, 0, 0, 5, 4)).toBe(true);
    const opened = (key: string, x: number, y: number): boolean =>
      key === '0,0' && x === 9 && y === 0;
    expect(solidInWorld(w, 0, 0, 9, 0, opened)).toBe(false);
    expect(solidInWorld(w, 0, 0, 5, 4, opened)).toBe(true);
    // Being "opened" only matters for doors and chests: a wall stays a wall.
    expect(solidInWorld(w, 0, 0, 0, 0, () => true)).toBe(true);
  });

  it('cellsAhead finds every cell the leading edge of the feet box touches', () => {
    const box = { halfWidth: 5, height: 6 };
    // Box x 35–45, y 42–48: all in cell (2, 2).
    const feet = { x: 40, y: 48 };
    expect(cellsAhead(feet, 'left', box)).toEqual([{ cx: 2, cy: 2 }]); // x 34 is still cell 2
    expect(cellsAhead({ x: 37, y: 48 }, 'left', box)).toEqual([{ cx: 1, cy: 2 }]);
    expect(cellsAhead({ x: 43, y: 48 }, 'right', box)).toEqual([{ cx: 3, cy: 2 }]);
    expect(cellsAhead({ x: 40, y: 38 }, 'up', box)).toEqual([{ cx: 2, cy: 1 }]);
    expect(cellsAhead(feet, 'down', box)).toEqual([{ cx: 2, cy: 3 }]);
    // Straddling two columns (x 155–165: cells 9 and 10), both are ahead.
    expect(cellsAhead({ x: 160, y: 70 }, 'up', box)).toEqual([
      { cx: 9, cy: 3 },
      { cx: 10, cy: 3 },
    ]);
    expect(cellsAhead({ x: 160, y: 70 }, 'down', box)).toEqual([
      { cx: 9, cy: 4 },
      { cx: 10, cy: 4 },
    ]);
    // Straddling two rows (y 60–66: rows 3 and 4).
    expect(cellsAhead({ x: 40, y: 66 }, 'left', box)).toEqual([
      { cx: 2, cy: 3 },
      { cx: 2, cy: 4 },
    ]);
    expect(cellsAhead({ x: 43, y: 66 }, 'right', box)).toEqual([
      { cx: 3, cy: 3 },
      { cx: 3, cy: 4 },
    ]);
  });
});

describe('doorways to other maps', () => {
  const lines = Array.from({ length: 10 }, (_, y) =>
    y === 9 ? '#########DD#########' : y === 0 ? '####################' : '#..................#',
  );
  const exit = {
    cells: [
      { col: 9, row: 9 },
      { col: 10, row: 9 },
    ],
    to: {
      map: 'overworld',
      room: { col: 1, row: 0 },
      feet: { x: 160, y: 78 },
      facing: 'down' as const,
    },
  };

  it('a doorway on an edge is not a gap to a room next door', () => {
    expect(joinProblems(buildWorld([{ col: 0, row: 0, lines, exits: [exit] }]))).toEqual([]);
  });

  it('finds the exit for a doorway cell', () => {
    const w = buildWorld([{ col: 0, row: 0, lines, exits: [exit] }]);
    expect(exitAt(w, '0,0', 10, 9)).toBe(w.exits.get('0,0')?.[0]);
    expect(exitAt(w, '0,0', 5, 5)).toBeNull();
    expect(exitAt(w, '9,9', 10, 9)).toBeNull();
  });

  it('every doorway belongs to one exit, and every exit cell is a doorway', () => {
    expect(() => buildWorld([{ col: 0, row: 0, lines }])).toThrow(
      'room 0,0: the doorway at column 9, row 9 belongs to 0 exits, not 1',
    );
    expect(() =>
      buildWorld([
        { col: 0, row: 0, lines, exits: [exit, { ...exit, cells: [{ col: 9, row: 9 }] }] },
      ]),
    ).toThrow('belongs to 2 exits');
    expect(() =>
      buildWorld([
        { col: 0, row: 0, lines, exits: [{ ...exit, cells: [...exit.cells, { col: 5, row: 5 }] }] },
      ]),
    ).toThrow('room 0,0: exit lists column 5, row 5, which is not a doorway');
  });
});

describe('bosses', () => {
  const lines = Array.from({ length: 10 }, (_, y) =>
    y === 0 || y === 9 ? '####################' : '#..................#',
  );

  it('keeps the room\u2019s boss', () => {
    const w = buildWorld([{ col: 0, row: 0, lines, boss: { kind: 'treant', col: 10, row: 4 } }]);
    expect(w.bosses.get('0,0')).toEqual({ kind: 'treant', col: 10, row: 4 });
    expect(buildWorld([{ col: 0, row: 0, lines }]).bosses.size).toBe(0);
  });

  it('rejects a boss in a wall or outside the room', () => {
    expect(() =>
      buildWorld([{ col: 0, row: 0, lines, boss: { kind: 'treant', col: 0, row: 0 } }]),
    ).toThrow('room 0,0: the boss at column 0, row 0 is not on open ground');
    expect(() =>
      buildWorld([{ col: 0, row: 0, lines, boss: { kind: 'treant', col: 30, row: 3 } }]),
    ).toThrow('not on open ground');
  });
});

describe('regions', () => {
  it('keeps each room\u2019s region, forest unless given', () => {
    const lines = Array.from({ length: 10 }, () => 'FFFFFFFFFFFFFFFFFFFF');
    const w = buildWorld([
      { col: 0, row: 0, lines, region: 'village' },
      { col: 1, row: 0, lines },
    ]);
    expect(w.regions.get('0,0')).toBe('village');
    expect(w.regions.get('1,0')).toBe('forest');
  });
});

describe('gates in the world', () => {
  const lines = Array.from({ length: 10 }, (_, y) =>
    y === 0 ? '###z################' : y === 9 ? '#########gg#########' : '#..................#',
  );
  const w = buildWorld([{ col: 0, row: 0, lines }]);

  it('a gate blocks until its room’s switch is powered; then it is open ground', () => {
    expect(solidInWorld(w, 0, 0, 9, 9)).toBe(true);
    const powered = (key: string, x: number, y: number) => key === '0,0' && x === 3 && y === 0;
    expect(solidInWorld(w, 0, 0, 9, 9, powered)).toBe(false);
    expect(solidInWorld(w, 0, 0, 3, 0, powered)).toBe(false); // the switch itself: opened
    expect(solidInWorld(w, 0, 0, 4, 0, powered)).toBe(true); // the wall beside it
  });
});
