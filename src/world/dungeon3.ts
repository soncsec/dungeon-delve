/**
 * Dungeon 3, Sunken Crypt (PROJECT.md §3c): seven rooms under the ruins.
 *
 *               [boss room]               the Mummy (only Lightning-stunned, it can be hurt)
 *               [tomb hall]               a Mana Brew; locked door north (needs key 2)
 *   [west crypt] [hub]      [east crypt]  west: key 2 in a cage; east: Lightning behind a stone
 *   [ossuary]    [entrance]               ossuary: key 1 behind thorns; locked door north (key 1)
 *
 * The prize is the Lightning spell (owner 2026-10-21), in the east crypt's
 * closet: push the stone in its doorway in, twice. Crystal switches then open
 * the way on: the hub's opens the gates to the tomb hall, and the west
 * crypt's opens the cage round key 2. The thorns before key 1 need the
 * Fireball Walker taught Jarrett after Hollow Oak.
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_3_START = { col: 1, row: 3 } as const;

export const DUNGEON_3: readonly RoomDef[] = [
  // The boss room: the Mummy.
  {
    col: 1,
    row: 0,
    boss: { kind: 'mummy', col: 10, row: 5 },
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
  // The tomb hall: past the hub's gates. A Mana Brew, and the locked door to the boss.
  {
    col: 1,
    row: 1,
    chests: [{ col: 4, row: 3, contents: { kind: 'potion', potion: 'mana' } }],
    enemies: [
      { kind: 'ghost', col: 14, row: 3 },
      { kind: 'eye', col: 5, row: 6 },
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
  // The west crypt: key 2 in a cage; the crystal switch in the north wall opens it.
  {
    col: 0,
    row: 2,
    chests: [{ col: 5, row: 7, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'ghost', col: 13, row: 3 },
      { kind: 'bird', col: 10, row: 6 },
    ],
    lines: [
      '####################',
      '####z###############',
      '##................##',
      '##................##',
      '##..................',
      '##..................',
      '##.##gg##.........##',
      '##.#.C..#.........##',
      '####################',
      '####################',
    ],
  },
  // The hub: gates across the way north, opened by the crystal switch in the north wall.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'mushroom', col: 5, row: 3 },
      { kind: 'ghost', col: 14, row: 6 },
    ],
    lines: [
      '#########..#########',
      '####z####gg#########',
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
  // The east crypt: Lightning, in a closet; a stone blocks its doorway on the west side.
  {
    col: 2,
    row: 2,
    chests: [{ col: 16, row: 4, contents: { kind: 'item', item: 'lightning' } }],
    enemies: [
      { kind: 'eye', col: 5, row: 3 },
      { kind: 'mushroom', col: 8, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##..........########',
      '............#...C###',
      '............B....###',
      '##..........########',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The ossuary: key 1, in a closet behind thorns.
  {
    col: 0,
    row: 3,
    chests: [{ col: 6, row: 4, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'mushroom', col: 12, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##.#######........##',
      '##.#..C..t..........',
      '##.#.....#..........',
      '##.#######........##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the ossuary west, and the locked door north.
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
        to: { map: 'overworld', room: { col: 5, row: 4 }, feet: { x: 160, y: 78 }, facing: 'down' },
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
