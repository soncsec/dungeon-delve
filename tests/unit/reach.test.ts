import { describe, expect, it } from 'vitest';
import { explore } from '../../src/logic/reach';
import { buildWorld, type RoomDef } from '../../src/logic/world';
import { DUNGEON_1, DUNGEON_1_START } from '../../src/world/dungeon1';
import { SECRET_CAVES } from '../../src/world/caves';
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

  it('every overworld room, door and secret cave can be reached (some caves need the Axe or Fireball)', () => {
    const world = buildWorld(OVERWORLD);
    const r = explore(world, { ...START_ROOM, cx: 10, cy: 5 });
    expect(r.rooms).toEqual([...world.rooms.keys()].sort());
    // Hollow Oak's archway, the shop's door, and the holes down to the secret caves that
    // need no item; the false walls in front of some of them open on the way.
    const hole = (c: (typeof SECRET_CAVES)[number]) =>
      `${c.room.col},${c.room.row}/${c.hole.col},${c.hole.row}`;
    const doors = ['3,5/10,2', '3,5/9,2', '3,6/5,8'];
    const free = SECRET_CAVES.filter((c) => !c.opensWith).map(hole);
    expect(free).toHaveLength(7);
    expect(r.exits).toEqual([...doors, ...free].sort());
    expect(r.hollows).toHaveLength(4);
    // With the Axe and Fireball, every cave: through thorns, boulders and rubble.
    const all = explore(world, { ...START_ROOM, cx: 10, cy: 5 }, { axe: true, fireball: true });
    expect(all.exits).toEqual([...doors, ...SECRET_CAVES.map(hole)].sort());
    expect(SECRET_CAVES).toHaveLength(12);
    expect(SECRET_CAVES.filter((c) => c.chests.some((k) => k.kind === 'heart'))).toHaveLength(3);
  });
});

describe('explore, with false walls', () => {
  it('opens a false wall in reach, to reach what it hides', () => {
    // A closet in the top-left corner, sealed by a false wall (h) at column 4, row 2.
    const defs: RoomDef[] = [
      {
        col: 0,
        row: 0,
        lines: room({
          1: '#..C#..............#',
          2: '#...h..............#',
          3: '#####..............#',
        }),
        chests: [{ col: 3, row: 1, contents: { kind: 'gems', amount: 5 } }],
      },
    ];
    const r = explore(buildWorld(defs), { col: 0, row: 0, cx: 10, cy: 5 });
    expect(r.hollows).toEqual(['0,0/4,2']);
    expect(r.chests).toEqual(['0,0/3,1']);
  });
});

describe('explore, with items', () => {
  // A closet on the left behind rubble (x) at column 4, row 2; one on the right behind a
  // boulder (R, 2×2) at columns 14–15, rows 2–3; and one below behind thorns (t).
  const defs: RoomDef[] = [
    {
      col: 0,
      row: 0,
      lines: room({
        1: '#..C#.........#.C..#',
        2: '#...x.........R...##',
        3: '#####...........####',
        6: '#######t############',
        7: '#......C...........#',
      }),
      chests: [
        { col: 3, row: 1, contents: { kind: 'gems', amount: 1 } },
        { col: 16, row: 1, contents: { kind: 'gems', amount: 2 } },
        { col: 7, row: 7, contents: { kind: 'gems', amount: 3 } },
      ],
    },
  ];
  const start = { col: 0, row: 0, cx: 9, cy: 4 };

  it('breaks nothing without the items', () => {
    const r = explore(buildWorld(defs), start);
    expect(r.broken).toEqual([]);
    expect(r.chests).toEqual([]);
  });

  it('smashes rubble and whole boulders with the Axe, and burns thorns with Fireball', () => {
    const axe = explore(buildWorld(defs), start, { axe: true });
    expect(axe.broken).toEqual(['0,0/14,2', '0,0/14,3', '0,0/15,2', '0,0/15,3', '0,0/4,2']);
    expect(axe.chests).toEqual(['0,0/16,1', '0,0/3,1']);
    const fire = explore(buildWorld(defs), start, { fireball: true });
    expect(fire.broken).toEqual(['0,0/7,6']);
    expect(fire.chests).toEqual(['0,0/7,7']);
  });
});

describe('the overworld, stage by stage (M4.6)', () => {
  // Shards are the keys to the dungeons; items only open secrets. So every room and every
  // dungeon's doorway must be reachable with no items at all, and each item adds its caves.
  const world = buildWorld(OVERWORLD);
  const start = { ...START_ROOM, cx: 10, cy: 5 };
  const hole = (c: (typeof SECRET_CAVES)[number]) =>
    `${c.room.col},${c.room.row}/${c.hole.col},${c.hole.row}`;
  const caves = (items: ('axe' | 'fireball')[]) =>
    SECRET_CAVES.filter((c) => !c.opensWith || items.includes(c.opensWith))
      .map(hole)
      .sort();
  const reachedCaves = (r: ReturnType<typeof explore>) =>
    r.exits.filter((e) => SECRET_CAVES.some((c) => hole(c) === e)).sort();

  /** Every archway (A) and cave (V) on the map, by room, with its doorway's cells. */
  const sites = [...world.rooms].flatMap(([key, room]) =>
    room.cells.flatMap((row, y) =>
      row.flatMap((cell, x) =>
        cell.prop === 'arch'
          ? [{ key, prop: 'arch', door: [`${key}/${x + 1},${y + 1}`, `${key}/${x + 2},${y + 1}`] }]
          : cell.prop === 'cave'
            ? [{ key, prop: 'cave', door: [`${key}/${x + 1},${y + 1}`] }]
            : [],
      ),
    ),
  );

  it('has the eight dungeon sites where the plan puts them', () => {
    expect(sites.map((t) => `${t.key} ${t.prop}`).sort()).toEqual([
      '0,2 arch', // 6 Witchwood Tower
      '1,5 arch', // 2 Bog Grotto
      '2,0 arch', // 5 Thunder Spire
      '3,1 cave', // 4 Stonecrag Mine
      '3,5 arch', // 1 Hollow Oak
      '5,4 arch', // 3 Sunken Crypt
      '6,3 arch', // 7 Crimson Manor
      '7,0 cave', // 8 Dragon's Maw
    ]);
  });

  it('with no items: every room, every dungeon doorway, and the 7 caves that need nothing', () => {
    const r = explore(world, start);
    expect(r.rooms).toHaveLength(64);
    for (const site of sites) {
      expect(
        site.door.some((c) => r.cells.has(c)),
        `the doorway of the site in room ${site.key}`,
      ).toBe(true);
    }
    expect(reachedCaves(r)).toEqual(caves([]));
    expect(reachedCaves(r)).toHaveLength(7);
  });

  it('with Fireball (dungeon 2, and the starting kit until then): the 2 thorn caves too', () => {
    const r = explore(world, start, { fireball: true });
    expect(reachedCaves(r)).toEqual(caves(['fireball']));
    expect(reachedCaves(r)).toHaveLength(9);
  });

  it('with the Axe too (dungeon 4): all 12 caves', () => {
    const r = explore(world, start, { fireball: true, axe: true });
    expect(reachedCaves(r)).toEqual(caves(['fireball', 'axe']));
    expect(reachedCaves(r)).toHaveLength(12);
    // Every boulder on the map can be reached and smashed (none is out of reach).
    const boulders = [...world.rooms].flatMap(([key, room]) =>
      room.cells.flatMap((row, y) =>
        row.flatMap((cell, x) => (cell.prop === 'boulder' ? [`${key}/${x},${y}`] : [])),
      ),
    );
    expect(boulders.length).toBeGreaterThan(0);
    for (const b of boulders) expect(r.broken, b).toContain(b);
  });
});
