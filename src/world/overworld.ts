/**
 * The overworld, one room per 20×10 block of text (legend in src/logic/room.ts).
 * M1: a 3×3 patch of forest, with two enemies in every room but the start room. Rooms join through gaps in their walls; the
 * world test checks every gap lines up with the room next door.
 */
import type { RoomDef } from '../logic/world';

/** The room the game starts in. */
export const START_ROOM = { col: 1, row: 1 } as const;

export const OVERWORLD: readonly RoomDef[] = [
  {
    col: 0,
    row: 0,
    enemies: [
      { kind: 'robot', col: 6, row: 4 },
      { kind: 'bird', col: 12, row: 5 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFF....T.......FFF',
      'FFF...............FF',
      'FFF.....r...........',
      'FFF.................',
      'FFFF....R.........FF',
      'FFFF..............FF',
      'FFFFFFF.....FFFFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 1,
    row: 0,
    enemies: [
      { kind: 'wolf', col: 9, row: 5 },
      { kind: 'eye', col: 15, row: 4 },
    ],
    // The archway into dungeon 1, Hollow Oak.
    exits: [
      {
        cells: [
          { col: 9, row: 2 },
          { col: 10, row: 2 },
        ],
        to: { map: 'dungeon1', room: { col: 0, row: 1 }, feet: { x: 160, y: 140 }, facing: 'up' },
      },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFA...FFFFFFFF',
      'FFF....T.DD..T...FFF',
      'FF................FF',
      '....................',
      '......b......b......',
      'FF....O...........FF',
      'FFF..............FFF',
      'FFFFFFFF....FFFFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 2,
    row: 0,
    enemies: [
      { kind: 'ghost', col: 5, row: 5 },
      { kind: 'robot', col: 12, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFF.......T....FFFFF',
      'FF..............FFFF',
      '..........b.....FFFF',
      '................FFFF',
      'FF.....O.......FFFFF',
      'FFF............FFFFF',
      'FFFFFFF.....FFFFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 0,
    row: 1,
    enemies: [
      { kind: 'robot', col: 10, row: 4 },
      { kind: 'robot', col: 13, row: 6 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF........FFFFFF',
      'FFFF....T.......FFFF',
      'FFF...............FF',
      'FFF.....b...........',
      'FFF.................',
      'FFF....T.......r..FF',
      'FFFF..............FF',
      'FFFFFF........FFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 1,
    row: 1,
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFF..............FFF',
      'FF....T.......O...FF',
      'F..b..........r....F',
      '....................',
      '....................',
      'F...R..........T...F',
      'F..................F',
      'FF................FF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 2,
    row: 1,
    enemies: [
      { kind: 'bird', col: 6, row: 5 },
      { kind: 'wolf', col: 12, row: 3 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF........FFFFFF',
      'FFFF.......T....FFFF',
      'FF...............FFF',
      '...........O....FFFF',
      '................FFFF',
      'FF.....b........FFFF',
      'FFF.............FFFF',
      'FFFFFF........FFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  {
    col: 0,
    row: 2,
    enemies: [
      { kind: 'eye', col: 12, row: 4 },
      { kind: 'robot', col: 6, row: 5 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF........FFFFFF',
      'FFFF..............FF',
      'FFF.....R.........FF',
      'FFF.................',
      'FFF.......T.........',
      'FFFF..............FF',
      'FFFFF....b.....FFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'ghost', col: 5, row: 4 },
      { kind: 'bird', col: 15, row: 5 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFF............FFFF',
      'FF.....T......T...FF',
      'F..................F',
      '....................',
      '........r...........',
      'F....O........O....F',
      'FF................FF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  {
    col: 2,
    row: 2,
    enemies: [
      { kind: 'wolf', col: 4, row: 5 },
      { kind: 'eye', col: 11, row: 4 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFF..........FFFFF',
      'FFF......T.....FFFFF',
      'FF..............FFFF',
      '........b.......FFFF',
      '................FFFF',
      'FF.......R.....FFFFF',
      'FFF.............FFFF',
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
];
