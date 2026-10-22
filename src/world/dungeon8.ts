/**
 * Dungeon 8, Dragon's Maw (PROJECT.md §3c): seven caverns under the volcano's edge.
 *
 *                [lair]                       the Dragon
 *                [throne hall]                locked door up (needs key 2)
 *   [west vent]  [forge]        [east vent]   west: key 2 behind sparks; forge: the Star Blade,
 *                                             caged by an eye statue; east: a Health Potion behind a switch
 *   [ash hall]   [entrance]                   ash hall: key 1 behind a boulder; entrance: locked door up
 *
 * Every item comes into it: the Axe (the boulder before key 1), the Steel
 * Sword (the forge's eye, which holds the Star Blade's cage), the Ward (the
 * sparks before key 2) and Lightning (the east vent's switch).
 */
import type { RoomDef } from '../logic/world';

/** The entrance: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_8_START = { col: 1, row: 3 } as const;

export const DUNGEON_8: readonly RoomDef[] = [
  // The lair: the Dragon.
  {
    col: 1,
    row: 0,
    boss: { kind: 'dragon', col: 10, row: 4 },
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
  // The throne hall: pillars, and the locked door to the lair.
  {
    col: 1,
    row: 1,
    enemies: [
      { kind: 'eye', col: 8, row: 4 },
      { kind: 'ghost', col: 14, row: 7 },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..##........##..##',
      '##................##',
      '##................##',
      '##..##........##..##',
      '##................##',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The west vent: key 2, in a closet behind sparks.
  {
    col: 0,
    row: 2,
    chests: [{ col: 15, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'wolf', col: 6, row: 7 },
      { kind: 'eye', col: 5, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##..........#####.##',
      '##..........#..C#.##',
      '##..........e...#...',
      '##..........#####...',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The forge: the Star Blade, caged; an eye statue above holds the cage shut.
  {
    col: 1,
    row: 2,
    chests: [{ col: 14, row: 7, contents: { kind: 'item', item: 'star-blade' } }],
    enemies: [{ kind: 'ghost', col: 4, row: 3 }],
    lines: [
      '#########..#########',
      '#########..##y######',
      '##................##',
      '##................##',
      '....................',
      '....................',
      '##.........##gg#####',
      '##.........#..C.####',
      '#########..#########',
      '#########..#########',
    ],
  },
  // The east vent: a Health Potion behind a gate its crystal switch opens.
  {
    col: 2,
    row: 2,
    chests: [{ col: 8, row: 7, contents: { kind: 'potion', potion: 'health' } }],
    enemies: [
      { kind: 'toad', col: 14, row: 3 },
      { kind: 'ghost', col: 4, row: 3 },
    ],
    lines: [
      '####################',
      '####z###############',
      '##................##',
      '##................##',
      '..................##',
      '..................##',
      '##..####gg####....##',
      '##..#...C....#....##',
      '####################',
      '####################',
    ],
  },
  // The ash hall: key 1, in a closet a boulder has sealed.
  {
    col: 0,
    row: 3,
    chests: [{ col: 4, row: 2, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'wolf', col: 12, row: 7 },
      { kind: 'eye', col: 14, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##..C..#..........##',
      '##.....#..........##',
      '####R.##............',
      '##..................',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the way out south, the ash hall west, and the locked door up.
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
        to: {
          map: 'overworld',
          room: { col: 14, row: 0 },
          feet: { x: 168, y: 78 },
          facing: 'down',
        },
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
