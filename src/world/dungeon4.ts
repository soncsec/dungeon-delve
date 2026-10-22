/**
 * Dungeon 4, Stonecrag Mine (PROJECT.md §3c): seven tunnels under the mountains.
 *
 *               [boss room]               the Ogre (M5.3b)
 *               [deep shaft]              a Mana Brew; locked door north (needs key 2)
 *   [west drift] [hub]      [east drift]  west: key 2 behind a boulder; east: the Axe behind thorns
 *   [cart room]  [entrance]               cart room: key 1 in a cage; locked door north (key 1)
 *
 * The prize is the Axe, in the east drift's closet behind thorns (the
 * Fireball burns them). With it, Jarrett smashes the rubble across the hub's
 * way north and the boulder before key 2. Key 1's cage opens with the cart
 * room's crystal switch (Lightning, from Sunken Crypt).
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_4_START = { col: 1, row: 3 } as const;

export const DUNGEON_4: readonly RoomDef[] = [
  // The boss room: the Ogre.
  {
    col: 1,
    row: 0,
    boss: { kind: 'ogre', col: 10, row: 6 },
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
  // The deep shaft: past the hub's rubble. A Mana Brew, and the locked door to the boss.
  {
    col: 1,
    row: 1,
    chests: [{ col: 4, row: 3, contents: { kind: 'potion', potion: 'mana' } }],
    enemies: [
      { kind: 'wolf', col: 14, row: 3 },
      { kind: 'eye', col: 5, row: 6 },
      { kind: 'robot', col: 15, row: 6 },
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
  // The west drift: key 2, in a closet a boulder has sealed (the Axe smashes it).
  {
    col: 0,
    row: 2,
    chests: [{ col: 6, row: 4, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'toad', col: 13, row: 3 },
      { kind: 'robot', col: 12, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##.######.........##',
      '##.#..C.#...........',
      '##.#....R...........',
      '##.#####..........##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The hub: rubble across the way north (the Axe); ways west, east and south.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'wolf', col: 5, row: 3 },
      { kind: 'ghost', col: 14, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########xx#########',
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
  // The east drift: the Axe, in a closet behind thorns.
  {
    col: 2,
    row: 2,
    chests: [{ col: 14, row: 4, contents: { kind: 'item', item: 'axe' } }],
    enemies: [
      { kind: 'eye', col: 5, row: 3 },
      { kind: 'robot', col: 8, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##..........#####.##',
      '............#.C.#.##',
      '............t...#.##',
      '##..........#####.##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The cart room: key 1, caged; the crystal switch in the north wall opens the cage.
  {
    col: 0,
    row: 3,
    chests: [{ col: 8, row: 7, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'toad', col: 4, row: 4 },
    ],
    lines: [
      '####################',
      '#######z############',
      '##................##',
      '##................##',
      '##..................',
      '##..................',
      '##.####gg####.....##',
      '##.#....C...#.....##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the cart room west, and the locked door north.
  {
    col: 1,
    row: 3,
    enemies: [{ kind: 'robot', col: 14, row: 6 }],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 3, row: 1 }, feet: { x: 168, y: 78 }, facing: 'down' },
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
