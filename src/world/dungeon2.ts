/**
 * Dungeon 2, Bog Grotto (PROJECT.md §3c): seven rooms under the marsh.
 *
 *             [boss room]            the Giant Frog
 *             [bog hall]             a Mana Brew; locked door north (needs key 2)
 *   [west]    [hub]      [east]      west: key 2 behind thorns; east: the Mana Crystal behind a stone
 *   [cellar]  [entrance]             cellar: key 1; locked door north (needs key 1)
 *
 * The prize is a Mana Crystal (a bigger mana bar), in the closet in the east
 * room: push the stone that blocks its doorway inwards. Thorns bar the way on,
 * in the west room's closet (key 2) and across the hub's north gap: the
 * Fireball Walker taught Jarrett after Hollow Oak burns them (owner 2026-10-21).
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_2_START = { col: 1, row: 3 } as const;

export const DUNGEON_2: readonly RoomDef[] = [
  // The boss room: the Giant Frog.
  {
    col: 1,
    row: 0,
    boss: { kind: 'frog', col: 10, row: 5 },
    lines: [
      '####################',
      '####################',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The bog hall: past the hub's thorns. A Mana Brew, and the locked door to the boss.
  {
    col: 1,
    row: 1,
    chests: [{ col: 4, row: 3, contents: { kind: 'potion', potion: 'mana' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'ghost', col: 6, row: 6 },
      { kind: 'wolf', col: 15, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..C.............##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The west room: key 2, in a closet behind thorns.
  {
    col: 0,
    row: 2,
    chests: [{ col: 6, row: 4, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'ghost', col: 12, row: 7 },
      { kind: 'snake', col: 14, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##..#####.........##',
      '##..#.C.t...........',
      '##..#...#...........',
      '##..#####.........##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The hub: thorns across the way north; ways west, east and south.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'toad', col: 5, row: 3 },
      { kind: 'ghost', col: 14, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########tt#########',
      '##................##',
      '##................##',
      '....................',
      '....................',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The east room: the Mana Crystal, in a closet; a stone blocks its doorway.
  {
    col: 2,
    row: 2,
    chests: [{ col: 14, row: 3, contents: { kind: 'crystal' } }],
    enemies: [
      { kind: 'eye', col: 5, row: 3 },
      { kind: 'robot', col: 7, row: 6 },
    ],
    lines: [
      '####################',
      '####################',
      '##..........#####.##',
      '##..........#.C.#.##',
      '............#...#.##',
      '............#...#.##',
      '##..........##B##.##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The cellar: key 1, out in the open but guarded.
  {
    col: 0,
    row: 3,
    chests: [{ col: 4, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'snake', col: 10, row: 6 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##..C.............##',
      '##..................',
      '##..................',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the cellar west, and the locked door north.
  {
    col: 1,
    row: 3,
    enemies: [{ kind: 'ghost', col: 14, row: 6 }],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 1, row: 5 }, feet: { x: 160, y: 78 }, facing: 'down' },
      },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##................##',
      '..................##',
      '..................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
];
