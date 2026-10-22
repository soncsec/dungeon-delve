/**
 * Dungeon 5, Thunder Spire (PROJECT.md §3c): seven rooms up a stormy tower in the mountains.
 *
 *                  [boss room]                  the Centaur (M6.1c)
 *                  [upper hall]                 a Mana Brew; locked door north (needs key 2)
 *   [west gallery] [stair hall] [east gallery]  west: the Ward, caged; stair hall: sparks north;
 *                                               east: key 2 behind sparks
 *   [storeroom]    [entrance]                   storeroom: key 1 behind rubble; entrance: locked door north (key 1)
 *
 * The prize is the Ward (owner 2026-10-21), caged in the west gallery: its
 * crystal switch takes Lightning (Sunken Crypt's prize). With the Ward up,
 * Jarrett walks through the spark barriers before key 2 and on the way up to
 * the boss. Key 1 is behind rubble (the Axe, Stonecrag Mine's prize), and
 * thorns (the Fireball) stand before the switch.
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_5_START = { col: 1, row: 3 } as const;

export const DUNGEON_5: readonly RoomDef[] = [
  // The boss room: the Centaur (M6.1c).
  {
    col: 1,
    row: 0,
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
  // The upper hall: past the stair hall's sparks. A Mana Brew, and the locked door to the boss.
  {
    col: 1,
    row: 1,
    chests: [{ col: 15, row: 3, contents: { kind: 'potion', potion: 'mana' } }],
    enemies: [
      { kind: 'wolf', col: 9, row: 5 },
      { kind: 'eye', col: 14, row: 6 },
      { kind: 'ghost', col: 5, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##...##......##C..##',
      '##...##......##...##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The west gallery: the Ward, caged; the crystal switch above opens the cage, past thorns.
  {
    col: 0,
    row: 2,
    chests: [{ col: 7, row: 7, contents: { kind: 'item', item: 'ward' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'toad', col: 16, row: 7 },
    ],
    lines: [
      '####################',
      '##########z#########',
      '##........t.......##',
      '##................##',
      '##..................',
      '##..................',
      '##..####gg####....##',
      '##..#..C.....#....##',
      '####################',
      '####################',
    ],
  },
  // The stair hall: ways west, east and south; sparks across the way up.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'robot', col: 5, row: 3 },
      { kind: 'bird', col: 14, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########ee#########',
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
  // The east gallery: key 2, in a closet behind sparks.
  {
    col: 2,
    row: 2,
    chests: [{ col: 13, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'wolf', col: 6, row: 7 },
      { kind: 'eye', col: 8, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##.........#####..##',
      '##.........#.C.#..##',
      '...........#...#..##',
      '...........##e##..##',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The storeroom: key 1, in a closet that rubble has sealed (the Axe smashes it).
  {
    col: 0,
    row: 3,
    chests: [{ col: 5, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'toad', col: 13, row: 3 },
      { kind: 'ghost', col: 10, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##.#####..........##',
      '##.#.C.#..........##',
      '##.#...#............',
      '##.##x##............',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the storeroom west, and the locked door north.
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
        to: { map: 'overworld', room: { col: 4, row: 0 }, feet: { x: 160, y: 78 }, facing: 'down' },
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
