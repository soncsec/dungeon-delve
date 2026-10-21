/**
 * The overworld (PROJECT.md decisions, 2026-10-20): an 8×8 map of rooms, each
 * a 20×10 block of text (legend in src/logic/room.ts). Village and meadows
 * along the south, the forest north of them with Hollow Oak, the marsh west,
 * the ruins east, the mountains across the north, the Shadow Vault in the
 * centre. Regions arrive one PR at a time (ROADMAP M4.1); edges toward rooms
 * not built yet stay closed. Rooms join through gaps in their walls; the world
 * test checks every gap lines up with the room next door.
 */
import type { RoomDef } from '../logic/world';

/** The room the game starts in: the village gate. */
export const START_ROOM = { col: 4, row: 7 } as const;

export const OVERWORLD: readonly RoomDef[] = [
  // The archway into dungeon 1, Hollow Oak (the forest).
  {
    col: 3,
    row: 5,
    enemies: [
      { kind: 'wolf', col: 9, row: 5 },
      { kind: 'eye', col: 15, row: 4 },
    ],
    exits: [
      {
        cells: [
          { col: 9, row: 2 },
          { col: 10, row: 2 },
        ],
        to: { map: 'dungeon1', room: { col: 1, row: 3 }, feet: { x: 160, y: 140 }, facing: 'up' },
      },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFFFA...FFFFFFFF',
      'FFF....T.DD..T...FFF',
      'FF................FF',
      'FF..................',
      'FF....b......b......',
      'FF....O...........FF',
      'FFF..............FFF',
      'FFFFFFFF....FFFFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // Forest east of the archway.
  {
    col: 4,
    row: 5,
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
  // The village's west street: a house; north to Hollow Oak.
  {
    col: 3,
    row: 6,
    region: 'village',
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFF......pp......FFF',
      'F........pp........F',
      'F........pp...M....F',
      'F........ppppppppppp',
      'F..H.....pp......"..',
      'F........pp.,,.."".F',
      'F........pp..w,,...F',
      'FFF..pppppp......FFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The green, north of the start: trees and flowers around the crossroads.
  {
    col: 4,
    row: 6,
    region: 'village',
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFF......pp..."".FFF',
      'F....."".pp........F',
      'F..M.....pp..M.....F',
      'pppppppppppppppppppp',
      '.........pp.........',
      'F.,,...,.pp.,...,..F',
      'F...S....pp..,.n...F',
      'FFF......pp......FFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The east green: maples and a stump; the lane runs east.
  {
    col: 5,
    row: 6,
    region: 'village',
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFF..............FFF',
      'F....""............F',
      'F..M..........M....F',
      'pppppppppppppppppppp',
      '.........pp.........',
      'F.w....,.pp....."".F',
      'F...S..,.pp.,,."...F',
      'FFF......pp......FFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The east end: a house (the ruins lie east, closed for now).
  {
    col: 6,
    row: 6,
    region: 'village',
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFF..............FFF',
      'F....."".........w.F',
      'F..M...............F',
      'ppppppppppp........F',
      '.........pp.H......F',
      'F.,,..n..pp........F',
      'F...,....pp........F',
      'FFF......pppppp..FFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // West meadow: two robots.
  {
    col: 3,
    row: 7,
    region: 'village',
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
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The start: the village gate, where Walker waits.
  {
    col: 4,
    row: 7,
    region: 'village',
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
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // East meadow.
  {
    col: 5,
    row: 7,
    region: 'village',
    enemies: [
      { kind: 'bird', col: 6, row: 5 },
      { kind: 'wolf', col: 12, row: 3 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF........FFFFFF',
      'FFFF.......T....FFFF',
      'FF...............FFF',
      '...........O........',
      '....................',
      'FF.....b........FFFF',
      'FFF.............FFFF',
      'FFFFFF........FFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // Far east meadow.
  {
    col: 6,
    row: 7,
    region: 'village',
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
  // The south-east corner (the ruins lie north, closed for now).
  {
    col: 7,
    row: 7,
    region: 'village',
    enemies: [
      { kind: 'wolf', col: 4, row: 5 },
      { kind: 'eye', col: 11, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
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
