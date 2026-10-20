import { describe, expect, it } from 'vitest';
import {
  buildWorld,
  enterFrom,
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
