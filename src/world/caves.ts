/**
 * Secret caves (owner 2026-10-21): 12 across the overworld, and 8 more
 * (M10.2, owner 2026-10-24) for 20, each down a hole hidden behind a false
 * wall, under a pushable stone, or behind thorns (Fireball), a boulder or
 * rubble (the Axe). Each cave is one small room on the `caves` map, with a
 * chest or two; three caves hold heart containers.
 *
 * This list makes both sides: the cave rooms, and the holes' doorways in the
 * overworld rooms (whose text marks each hole with `o`, or `Q` under a stone).
 */
import type { ChestContents, MapExit, RoomDef } from '../logic/world';

export interface SecretCave {
  /** The overworld room with the hole, and the hole's cell. */
  room: { col: number; row: number };
  hole: { col: number; row: number };
  /** Where Jarrett comes back up: beside the hole, on open ground. */
  landing: { col: number; row: number };
  /** What its chests hold: one or two. */
  chests: readonly ChestContents[];
  /** The item that opens the way to its hole, if any (thorns: Fireball; boulders, rubble: the Axe). */
  opensWith?: 'axe' | 'fireball';
}

export const SECRET_CAVES: readonly SecretCave[] = [
  // Under a stone in the east meadow.
  {
    room: { col: 10, row: 11 },
    hole: { col: 14, row: 6 },
    landing: { col: 14, row: 7 },
    chests: [{ kind: 'gems', amount: 20 }],
  },
  // Behind a false wall in the deep forest.
  {
    room: { col: 2, row: 3 },
    hole: { col: 2, row: 2 },
    landing: { col: 4, row: 2 },
    chests: [{ kind: 'potion', potion: 'health' }],
  },
  // Under a stone in the marsh.
  {
    room: { col: 0, row: 9 },
    hole: { col: 5, row: 7 },
    landing: { col: 6, row: 7 },
    chests: [{ kind: 'gems', amount: 30 }],
  },
  // Behind a false wall in the ruins: a heart container.
  {
    room: { col: 14, row: 6 },
    hole: { col: 17, row: 3 },
    landing: { col: 15, row: 3 },
    chests: [{ kind: 'heart' }],
  },
  // Behind a false wall in the north-west mountains.
  {
    room: { col: 0, row: 0 },
    hole: { col: 18, row: 2 },
    landing: { col: 16, row: 2 },
    chests: [{ kind: 'gems', amount: 50 }],
  },
  // Behind a false wall at the forest's dead end.
  {
    room: { col: 0, row: 5 },
    hole: { col: 1, row: 4 },
    landing: { col: 3, row: 4 },
    chests: [
      { kind: 'potion', potion: 'mana' },
      { kind: 'gems', amount: 20 },
    ],
  },
  // Under a stone in the ruins by the forest.
  {
    room: { col: 8, row: 3 },
    hole: { col: 8, row: 7 },
    landing: { col: 8, row: 6 },
    chests: [{ kind: 'potion', potion: 'health' }],
  },
  // Behind thorns in the heart of the marsh (Fireball): a heart container.
  {
    room: { col: 2, row: 9 },
    hole: { col: 2, row: 7 },
    landing: { col: 4, row: 7 },
    chests: [{ kind: 'heart' }],
    opensWith: 'fireball',
  },
  // Behind thorns in the forest west of the vault grounds (Fireball).
  {
    room: { col: 4, row: 5 },
    hole: { col: 0, row: 7 },
    landing: { col: 2, row: 7 },
    chests: [{ kind: 'gems', amount: 30 }],
    opensWith: 'fireball',
  },
  // Under a boulder in the far east meadow (Axe).
  {
    room: { col: 12, row: 11 },
    hole: { col: 9, row: 8 },
    landing: { col: 8, row: 7 },
    chests: [{ kind: 'gems', amount: 50 }],
    opensWith: 'axe',
  },
  // Behind rubble in the high pass (Axe): a heart container.
  {
    room: { col: 10, row: 0 },
    hole: { col: 1, row: 2 },
    landing: { col: 3, row: 2 },
    chests: [{ kind: 'heart' }],
    opensWith: 'axe',
  },
  // Behind rubble above the ruins (Axe).
  {
    room: { col: 12, row: 2 },
    hole: { col: 18, row: 2 },
    landing: { col: 16, row: 2 },
    chests: [
      { kind: 'potion', potion: 'health' },
      { kind: 'potion', potion: 'mana' },
    ],
    opensWith: 'axe',
  },
  // M10.2 (owner 2026-10-24): eight more, mostly where there were few (20 in all).
  // Behind a false wall on the volcano edge.
  {
    room: { col: 14, row: 1 },
    hole: { col: 1, row: 2 },
    landing: { col: 3, row: 2 },
    chests: [{ kind: 'gems', amount: 40 }],
  },
  // Behind thorns on the volcano edge (Fireball).
  {
    room: { col: 15, row: 2 },
    hole: { col: 18, row: 5 },
    landing: { col: 16, row: 5 },
    chests: [
      { kind: 'potion', potion: 'health' },
      { kind: 'gems', amount: 30 },
    ],
    opensWith: 'fireball',
  },
  // Behind a false wall in the east ruins.
  {
    room: { col: 12, row: 8 },
    hole: { col: 18, row: 2 },
    landing: { col: 16, row: 2 },
    chests: [{ kind: 'gems', amount: 30 }],
  },
  // Behind a false wall in the far ruins.
  {
    room: { col: 14, row: 4 },
    hole: { col: 18, row: 7 },
    landing: { col: 16, row: 7 },
    chests: [{ kind: 'potion', potion: 'mana' }],
  },
  // Behind a false wall in the south marsh.
  {
    room: { col: 0, row: 11 },
    hole: { col: 2, row: 2 },
    landing: { col: 4, row: 2 },
    chests: [{ kind: 'gems', amount: 30 }],
  },
  // Behind thorns in the north marsh (Fireball).
  {
    room: { col: 3, row: 6 },
    hole: { col: 18, row: 5 },
    landing: { col: 16, row: 5 },
    chests: [
      { kind: 'potion', potion: 'mana' },
      { kind: 'gems', amount: 20 },
    ],
    opensWith: 'fireball',
  },
  // Behind a false wall in the high mountains.
  {
    room: { col: 6, row: 1 },
    hole: { col: 18, row: 7 },
    landing: { col: 16, row: 7 },
    chests: [{ kind: 'gems', amount: 40 }],
  },
  // Behind a false wall in the forest by Stonecrag's road.
  {
    room: { col: 7, row: 3 },
    hole: { col: 1, row: 7 },
    landing: { col: 3, row: 7 },
    chests: [{ kind: 'potion', potion: 'health' }],
  },
];

/** The caves map: cave i is the room at column 2i, so no two caves join. */
export const CAVES_START = { col: 0, row: 0 } as const;

const CAVE_LINES = [
  '####################',
  '####################',
  '##................##',
  '##................##',
  '##................##',
  '##................##',
  '##................##',
  '##................##',
  '#########..#########',
  '#########DD#########',
] as const;

/** Chests stand in row 3: one in the middle, or two either side. */
const CHEST_COLUMNS = [[9], [7, 12]] as const;

function caveRoom(cave: SecretCave, i: number): RoomDef {
  const columns = CHEST_COLUMNS[cave.chests.length - 1] ?? [];
  const lines = CAVE_LINES.map((line, y) =>
    y === 3 ? [...line].map((ch, x) => (columns.some((c) => c === x) ? 'C' : ch)).join('') : line,
  );
  return {
    col: 2 * i,
    row: 0,
    lines,
    chests: cave.chests.map((contents, k) => ({ col: columns[k] ?? 0, row: 3, contents })),
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: {
          map: 'overworld',
          room: cave.room,
          feet: { x: cave.landing.col * 16 + 8, y: (cave.landing.row + 1) * 16 - 2 },
          facing: 'down',
        },
      },
    ],
  };
}

export const CAVES: readonly RoomDef[] = SECRET_CAVES.map(caveRoom);

/** The overworld rooms' doorways down to their caves, by room. */
export function caveDoors(col: number, row: number): MapExit[] {
  return SECRET_CAVES.flatMap((cave, i) =>
    cave.room.col === col && cave.room.row === row
      ? [
          {
            cells: [cave.hole],
            to: {
              map: 'caves',
              room: { col: 2 * i, row: 0 },
              feet: { x: 160, y: 140 },
              facing: 'up',
            },
          },
        ]
      : [],
  );
}
