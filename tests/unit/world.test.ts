import { describe, expect, it } from 'vitest';
import { buildWorld, joinProblems, neighbour, roomKey, type RoomDef } from '../../src/logic/world';
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
