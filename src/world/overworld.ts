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
  // Forest east of the archway; north to the vault grounds.
  {
    col: 4,
    row: 5,
    enemies: [
      { kind: 'ghost', col: 5, row: 5 },
      { kind: 'robot', col: 12, row: 4 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
      'FFF....T.......FFFFF',
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
  // The northern forest, below the mountains.
  {
    col: 0,
    row: 1,
    enemies: [
      { kind: 'bird', col: 6, row: 5 },
      { kind: 'robot', col: 13, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFF.........FFFFFF',
      'FFF..........T..FFFF',
      'FFFF.O......T.r..FFF',
      'FFF.................',
      'FFFF................',
      'FF.............b.FFF',
      'FFF...............FF',
      'FFFFFFF....b..FFFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The northern forest.
  {
    col: 1,
    row: 1,
    enemies: [
      { kind: 'wolf', col: 8, row: 4 },
      { kind: 'ghost', col: 12, row: 6 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFF.........FFFFF',
      'FFFF..T..........FFF',
      'FFF.T........O..FFFF',
      '.................FFF',
      '................FFFF',
      'FFF..........R..bFFF',
      'FFF..............FFF',
      'FFFFF...........FFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // Witchwood's clearing: the sealed archway of dungeon 6 (it opens in M6).
  {
    col: 0,
    row: 2,
    enemies: [
      { kind: 'eye', col: 12, row: 5 },
      { kind: 'robot', col: 6, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFF.A.....FFFFFF',
      'FFF..............FFF',
      'FF................FF',
      'FFF.................',
      'FFFF................',
      'FFFT.bR.........FFFF',
      'FFF.............T.FF',
      'FFFFF...r......FFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The deep forest.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'ghost', col: 6, row: 4 },
      { kind: 'wolf', col: 13, row: 5 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF......R..FFFFF',
      'FFFF.......T.....FFF',
      'FFF...........T...FF',
      '....................',
      '....................',
      'FFFF...b.........FFF',
      'FF.........T......FF',
      'FFFFFF.........FFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The deep forest.
  {
    col: 2,
    row: 2,
    enemies: [
      { kind: 'bird', col: 7, row: 5 },
      { kind: 'eye', col: 12, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFr.......FFFFFF',
      'FFF..............FFF',
      'FFFFb............FFF',
      '....................',
      '....................',
      'FF....b.........FFFF',
      'FFF........T...T.FFF',
      'FFFFFFF.......FFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The forest edge, north of the vault grounds.
  {
    col: 3,
    row: 2,
    enemies: [
      { kind: 'robot', col: 6, row: 5 },
      { kind: 'ghost', col: 12, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFFF.......FFFFFF',
      'FFF.....b.........FF',
      'FFFF.T.......b..TFFF',
      '..................FF',
      '.................FFF',
      'FFFF.........R....FF',
      'FFFF...r.........FFF',
      'FFFFFF..T..r..FFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // A dead end in the forest (the marsh lies south, closed for now).
  {
    col: 0,
    row: 3,
    enemies: [
      { kind: 'wolf', col: 8, row: 5 },
      { kind: 'bird', col: 11, row: 4 },
    ],
    lines: [
      'FFFFFFFFFFFFFFFFFFFF',
      'FFFFFF.........FFFFF',
      'FFF.............bFFF',
      'FFT.T...........rFFF',
      'FFF.................',
      'FFFF................',
      'FF.O..........R...FF',
      'FFF..r......T...FFFF',
      'FFFFFFF........FFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The forest, by the marsh (closed for now).
  {
    col: 1,
    row: 3,
    enemies: [
      { kind: 'eye', col: 8, row: 4 },
      { kind: 'robot', col: 12, row: 5 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFF..........FFFFFF',
      'FF......T......b.FFF',
      'FFF....O......T...FF',
      '....................',
      '....................',
      'FFFF.............FFF',
      'FFFF..R..........TFF',
      'FFFFF...........FFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The forest, west of the vault grounds.
  {
    col: 2,
    row: 3,
    enemies: [
      { kind: 'ghost', col: 6, row: 5 },
      { kind: 'wolf', col: 13, row: 4 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFF...........FFFFF',
      'FFF.............FFFF',
      'FF.....T..........FF',
      '....................',
      '....................',
      'FFF.........b.br.FFF',
      'FF...........T...FFF',
      'FFFFFF........FFFFFF',
      'FFFFFFFFF..FFFFFFFFF',
    ],
  },
  // The vault grounds, north-west: the sealed vault stands at the centre.
  {
    col: 3,
    row: 3,
    region: 'vault',
    enemies: [{ kind: 'ghost', col: 6, row: 3 }],
    lines: [
      '#########..#########',
      '#########..#########',
      '##................##',
      '##................##',
      '....................',
      '....................',
      '##.........#########',
      '##.........#########',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The vault grounds, north-east (the ruins lie east, closed for now).
  {
    col: 4,
    row: 3,
    region: 'vault',
    enemies: [{ kind: 'ghost', col: 12, row: 3 }],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##................##',
      '..................##',
      '..................##',
      '#########.........##',
      '#########.........##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The forest, by the vault grounds (the marsh lies south and west, closed for now).
  {
    col: 2,
    row: 4,
    enemies: [
      { kind: 'bird', col: 8, row: 5 },
      { kind: 'robot', col: 12, row: 4 },
    ],
    lines: [
      'FFFFFFFFF..FFFFFFFFF',
      'FFFFFF.........FFFFF',
      'FFFT.........r..TFFF',
      'FFF..........O..FFFF',
      'FF..................',
      'FF..................',
      'FFF...T.........FFFF',
      'FF.b.......b......FF',
      'FFFFFF.........FFFFF',
      'FFFFFFFFFFFFFFFFFFFF',
    ],
  },
  // The vault grounds, south-west: the vault's door (sealed until M7.1).
  {
    col: 3,
    row: 4,
    region: 'vault',
    lines: [
      '#########..#########',
      '#########..#########',
      '##.........#########',
      '##.........###KK####',
      '....................',
      '....................',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The vault grounds, south-east: south to Hollow Oak.
  {
    col: 4,
    row: 4,
    region: 'vault',
    lines: [
      '#########..#########',
      '#########..#########',
      '#########.........##',
      '#########.........##',
      '..................##',
      '..................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
];
