import { describe, expect, it } from 'vitest';
import { explore } from '../../src/logic/reach';
import { buildWorld, type RoomDef } from '../../src/logic/world';
import { DUNGEON_1, DUNGEON_1_START } from '../../src/world/dungeon1';
import { OVERWORLD, START_ROOM } from '../../src/world/overworld';

const WALL = '####################';
/** A closed dungeon room with the given rows replaced (rows 1–8 default to open floor). */
const room = (rows: Record<number, string> = {}): string[] =>
  Array.from(
    { length: 10 },
    (_, y) => rows[y] ?? (y === 0 || y === 9 ? WALL : '#..................#'),
  );

describe('explore', () => {
  it('opens a key chest, then the locked door, then the chest behind it', () => {
    // A key chest above a locked door, and another chest below it.
    const defs: RoomDef[] = [
      {
        col: 0,
        row: 0,
        lines: room({
          2: '#..C...............#',
          5: '#########KK#########',
          7: '#..............C...#',
        }),
        chests: [
          { col: 3, row: 2, contents: { kind: 'key' } },
          { col: 15, row: 7, contents: { kind: 'gems', amount: 5 } },
        ],
      },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 5, cy: 3 });
    expect(r.chests).toEqual(['0,0/15,7', '0,0/3,2']);
    expect(r.doors).toEqual(['0,0/10,5', '0,0/9,5']); // both halves, for one key
    expect(r.keys).toBe(0);
  });

  it('leaves a locked door shut without a key, and what is behind it unreached', () => {
    const defs: RoomDef[] = [
      { col: 0, row: 0, lines: room({ 9: '#########KK#########' }) },
      { col: 0, row: 1, lines: room({ 0: '#########..#########' }) },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 5, cy: 3 });
    expect(r.rooms).toEqual(['0,0']);
    expect(r.doors).toEqual([]);
  });

  it('walks between rooms, and records doorways to other maps', () => {
    const defs: RoomDef[] = [
      { col: 0, row: 0, lines: room({ 9: '#########..#########' }) },
      {
        col: 0,
        row: 1,
        lines: room({ 0: '#########..#########', 9: '#########DD#########' }),
        exits: [
          {
            cells: [
              { col: 9, row: 9 },
              { col: 10, row: 9 },
            ],
            to: {
              map: 'overworld',
              room: { col: 0, row: 0 },
              feet: { x: 0, y: 0 },
              facing: 'down',
            },
          },
        ],
      },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 5, cy: 3 });
    expect(r.rooms).toEqual(['0,0', '0,1']);
    expect(r.exits).toEqual(['0,1/10,9', '0,1/9,9']);
  });

  it('pushes a stone more than once to get past it', () => {
    // A closet (columns 1–4) whose doorway (column 5, row 5) a stone blocks. Pushed
    // in once, the stone still blocks; pushed again, the way past it opens.
    const defs: RoomDef[] = [
      {
        col: 0,
        row: 0,
        lines: room({
          2: '#..C.#.............#',
          3: '#....#.............#',
          4: '#....#.............#',
          5: '#....B.............#',
          6: '######.............#',
        }),
        chests: [{ col: 3, row: 2, contents: { kind: 'key' } }],
      },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 12, cy: 5 });
    expect(r.chests).toEqual(['0,0/3,2']);
    expect(r.keys).toBe(1);
  });

  it('cannot push a stone into something solid', () => {
    // The chest sits at the end of a one-cell passage, behind a stone; pushing the
    // stone on would push it into the chest.
    const defs: RoomDef[] = [
      {
        col: 0,
        row: 0,
        lines: room({
          1: '###................#',
          2: '#C#................#',
          3: '#B#................#',
          4: '#.#................#',
        }),
        chests: [{ col: 1, row: 2, contents: { kind: 'key' } }],
      },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 5, cy: 5 });
    expect(r.chests).toEqual([]);
  });

  it('cannot push a stone out of its room', () => {
    // The only way west is the cell a stone fills, on the room's west edge.
    const west = room({ 3: '#....C..............' });
    const defs: RoomDef[] = [
      { col: 0, row: 0, lines: west, chests: [{ col: 5, row: 3, contents: { kind: 'key' } }] },
      { col: 1, row: 0, lines: room({ 3: 'B..................#' }) },
    ];
    const r = explore(buildWorld(defs), { col: 1, row: 0, cx: 5, cy: 3 });
    expect(r.rooms).toEqual(['1,0']);
    expect(r.chests).toEqual([]);
  });

  it('cannot push a stone onto another stone', () => {
    const defs: RoomDef[] = [
      {
        col: 0,
        row: 0,
        lines: room({ 2: '#C.................#', 3: '#BB################' + '#' }),
        chests: [{ col: 1, row: 2, contents: { kind: 'key' } }],
      },
    ];
    // Standing below-left can't happen (wall); the only push is east into the other stone.
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 5, cy: 2 });
    expect(r.chests).toEqual(['0,0/1,2']);
  });
});

describe('explore, from nowhere', () => {
  it('needs a real start room', () => {
    expect(() =>
      explore(buildWorld([{ col: 0, row: 0, lines: room() }]), { col: 5, row: 5, cx: 1, cy: 1 }),
    ).toThrow('no room at 5,5');
  });
});

describe('the real maps', () => {
  it('dungeon 1 can be finished: every room, chest and door, in some order', () => {
    const world = buildWorld(DUNGEON_1);
    // He arrives through the doorway in the entrance's south wall (row 8 above it).
    const r = explore(world, { ...DUNGEON_1_START, cx: 10, cy: 8 });
    expect(r.rooms).toEqual([...world.rooms.keys()].sort());
    const chests = [...world.chests].flatMap(([key, list]) =>
      list.map((c) => `${key}/${c.col},${c.row}`),
    );
    expect(r.chests).toEqual(chests.sort());
    const doors = [...world.rooms].flatMap(([key, rm]) =>
      rm.cells.flatMap((rowCells, y) =>
        rowCells.flatMap((c, x) => (c.fixture === 'door' ? [`${key}/${x},${y}`] : [])),
      ),
    );
    expect(r.doors).toEqual(doors.sort());
    expect(r.exits).toEqual(['1,3/10,9', '1,3/9,9']); // and the way back out
    expect(r.keys).toBe(0); // every key has a door
  });

  it('every overworld room can be walked to, and the archway into dungeon 1 and the shop door', () => {
    const world = buildWorld(OVERWORLD);
    const r = explore(world, { ...START_ROOM, cx: 10, cy: 5 });
    expect(r.rooms).toEqual([...world.rooms.keys()].sort());
    // Hollow Oak's archway, and the shop's door.
    expect(r.exits).toEqual(['3,5/10,2', '3,5/9,2', '3,6/5,8']);
  });
});
