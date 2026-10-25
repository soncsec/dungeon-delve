/**
 * Dungeon 7, Crimson Manor (PROJECT.md §3c): seven rooms of an old manor in the ruins.
 *
 *                 [hall of the Vampire]           the Vampire
 *   [library]     [gallery]           [chapel]    library: key 2 caged by an eye; gallery: locked
 *                                                 door up (key 2); chapel: a Mana Brew behind a switch
 *   [west wing]   [foyer]             [east wing] west: key 1 behind sparks; foyer: the way in, and a
 *                                                 locked door up (key 1); east: the Triple Daggers
 *
 * Every item so far opens something: the Ward (the sparks before key 1), the
 * Axe (the rubble before the Triple Daggers, the manor's prize), the Steel
 * Sword (the eye that holds key 2's cage) and Lightning (the chapel's switch).
 */
import type { RoomDef } from '../logic/world';
import { secretRoom, withSecretDoor } from './secretRooms';

/** The foyer: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_7_START = { col: 1, row: 2 } as const;

export const DUNGEON_7: readonly RoomDef[] = [
  // The hall of the Vampire.
  {
    col: 1,
    row: 0,
    boss: { kind: 'vampire', col: 10, row: 4 },
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
  // The library: key 2 in a cage, held shut by the eye statue in the north wall.
  {
    col: 0,
    row: 1,
    chests: [{ col: 12, row: 7, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'ghost', col: 14, row: 3 },
      { kind: 'mushroom', col: 10, row: 4 },
    ],
    lines: [
      '####################',
      '######y#############',
      '##................##',
      '##................##',
      '##..................',
      '##..................',
      '##..########gg##..##',
      '##..#.......C..#..##',
      '####################',
      '####################',
    ],
  },
  // The gallery: pillars, ways to the library and the chapel, and the locked door up.
  {
    col: 1,
    row: 1,
    enemies: [
      { kind: 'wolf', col: 8, row: 3 },
      { kind: 'eye', col: 14, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..#..........#..##',
      '....................',
      '....................',
      '##..#..........#..##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The chapel: a Mana Brew behind a gate its crystal switch opens.
  {
    col: 2,
    row: 1,
    chests: [{ col: 10, row: 7, contents: { kind: 'potion', potion: 'mana' } }],
    enemies: [
      { kind: 'ghost', col: 5, row: 3 },
      { kind: 'snake', col: 15, row: 4 },
    ],
    lines: [
      '####################',
      '##########z#########',
      '##................##',
      '##................##',
      '..................##',
      '..................##',
      '##..####gg####....##',
      '##..#.....C..#....##',
      '####################',
      '####################',
    ],
  },
  // The west wing: key 1, in a closet behind sparks.
  {
    col: 0,
    row: 2,
    chests: [{ col: 5, row: 4, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'robot', col: 12, row: 7 },
      { kind: 'eye', col: 14, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##.#####..........##',
      '##.#.C.#............',
      '##.#...#............',
      '##.##e##..........##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The foyer: the way out south, the wings west and east, and the locked door up.
  {
    col: 1,
    row: 2,
    enemies: [{ kind: 'ghost', col: 15, row: 6 }],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: {
          map: 'overworld',
          room: { col: 12, row: 5 },
          feet: { x: 160, y: 78 },
          facing: 'down',
        },
      },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##................##',
      '....................',
      '....................',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
  // The east wing: the Triple Daggers, in a closet rubble has sealed (the Axe).
  {
    col: 2,
    row: 2,
    chests: [{ col: 14, row: 4, contents: { kind: 'item', item: 'triple-daggers' } }],
    enemies: [
      { kind: 'wolf', col: 6, row: 7 },
      { kind: 'mushroom', col: 8, row: 3 },
    ],
    lines: withSecretDoor(
      [
        '####################',
        '####################',
        '##................##',
        '##..........#####.##',
        '............#.C.#.##',
        '............##x##.##',
        '##................##',
        '##................##',
        '####################',
        '####################',
      ],
      'east',
    ),
  },
  // The secret room (M10.1), east of the east wing, behind its secret wall: a heart container.
  secretRoom(3, 2, 'west', [{ col: 13, row: 4, contents: { kind: 'heart' } }]),
];
