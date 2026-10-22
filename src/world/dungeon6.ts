/**
 * Dungeon 6, Witchwood Tower (PROJECT.md §3c): seven rooms up a tower deep in the forest.
 *
 *                [boss room]                 the Witch
 *                [library]                   locked door up (needs key 2)
 *   [west hall]  [great stair] [east hall]   west: the Steel Sword behind sparks; stair: an eye
 *                                            statue's gate across the way up; east: key 2 caged by an eye
 *   [cellar]     [entrance]                  cellar: key 1 behind thorns; entrance: locked door up (key 1)
 *
 * The prize is the Steel Sword (owner 2026-10-22), in the west hall behind
 * spark barriers (the Ward, Thunder Spire's prize). With it, Jarrett bats the
 * eye statues' orbs back into their eyes, which shuts them and opens their
 * rooms' gates: the way up from the great stair, and key 2's cage. Key 1 is
 * behind thorns (the Fireball).
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_6_START = { col: 1, row: 3 } as const;

export const DUNGEON_6: readonly RoomDef[] = [
  // The boss room: the Witch.
  {
    col: 1,
    row: 0,
    boss: { kind: 'witch', col: 10, row: 4 },
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
  // The library: rows of shelves (stone), a Health Potion, and the locked door to the boss.
  {
    col: 1,
    row: 1,
    chests: [{ col: 3, row: 7, contents: { kind: 'potion', potion: 'health' } }],
    enemies: [
      { kind: 'ghost', col: 15, row: 6 },
      { kind: 'mushroom', col: 5, row: 4 },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..####....####..##',
      '##................##',
      '##..####....####..##',
      '##................##',
      '##.C..............##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The west hall: the Steel Sword, in a closet behind sparks.
  {
    col: 0,
    row: 2,
    chests: [{ col: 5, row: 3, contents: { kind: 'item', item: 'steel-sword' } }],
    enemies: [
      { kind: 'wolf', col: 12, row: 6 },
      { kind: 'eye', col: 14, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##.######.........##',
      '##.#.C..#.........##',
      '##.#....#...........',
      '##.###e##...........',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The great stair: an eye statue in the north wall; its gate bars the way up.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'robot', col: 14, row: 6 },
      { kind: 'bird', col: 5, row: 6 },
    ],
    lines: [
      '#########..#########',
      '####y####gg#########',
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
  // The east hall: key 2, in a cage whose gate an eye statue holds shut.
  {
    col: 2,
    row: 2,
    chests: [{ col: 13, row: 7, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'toad', col: 5, row: 3 },
      { kind: 'snake', col: 8, row: 7 },
    ],
    lines: [
      '####################',
      '#############y######',
      '##................##',
      '##................##',
      '..................##',
      '..................##',
      '##.........##gg#####',
      '##.........#.C..####',
      '####################',
      '####################',
    ],
  },
  // The cellar: key 1, behind thorns.
  {
    col: 0,
    row: 3,
    chests: [{ col: 15, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'ghost', col: 5, row: 6 },
      { kind: 'robot', col: 9, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##..........#####.##',
      '##..........#..C#.##',
      '##..........t...#...',
      '##..........#####...',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the cellar west, and the locked door up.
  {
    col: 1,
    row: 3,
    enemies: [{ kind: 'wolf', col: 14, row: 6 }],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 0, row: 3 }, feet: { x: 160, y: 78 }, facing: 'down' },
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
