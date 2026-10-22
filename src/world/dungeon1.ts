/**
 * Dungeon 1, Hollow Oak (PROJECT.md §3c): six rooms in a cross.
 *
 *             [boss room]            the Treant
 *             [great hall]           potion; locked door south (needs key 2)
 *   [west]    [hub]      [east]      west: the Throwing Daggers behind a stone; east: key 2
 *             [entrance]             key 1, a stone to try; locked door north (needs key 1)
 *
 * The prize is the Throwing Daggers, in the closet in the west room: push the
 * stone that blocks its doorway inwards.
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_1_START = { col: 1, row: 3 } as const;

export const DUNGEON_1: readonly RoomDef[] = [
  // The boss room: the Treant.
  {
    col: 1,
    row: 0,
    boss: { kind: 'treant', col: 10, row: 5 },
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
  // The great hall: a potion, two enemies, and the locked door back to the hub.
  {
    col: 1,
    row: 1,
    chests: [{ col: 4, row: 3, contents: { kind: 'potion', potion: 'health' } }],
    enemies: [
      { kind: 'eye', col: 14, row: 3 },
      { kind: 'bird', col: 6, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########..#########',
      '##................##',
      '##..C.............##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########KK#########',
      '#########..#########',
    ],
  },
  // The west room: the closet in the corner holds the daggers; a stone blocks its doorway.
  {
    col: 0,
    row: 2,
    chests: [{ col: 3, row: 3, contents: { kind: 'item', item: 'daggers' } }],
    enemies: [{ kind: 'robot', col: 13, row: 3 }],
    lines: [
      '####################',
      '####################',
      '##....#...........##',
      '##.C..#...........##',
      '##....#.............',
      '##....B.............',
      '##....#...........##',
      '#######...........##',
      '####################',
      '####################',
    ],
  },
  // The hub: ways out on all four sides.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'robot', col: 6, row: 3 },
      { kind: 'robot', col: 13, row: 6 },
    ],
    lines: [
      '#########..#########',
      '#########..#########',
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
  // The east room: the second key.
  {
    col: 2,
    row: 2,
    chests: [{ col: 15, row: 3, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'ghost', col: 12, row: 6 },
      { kind: 'robot', col: 8, row: 3 },
    ],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##.............C..##',
      '..................##',
      '..................##',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
  // The entrance: the first key, a stone to try, the locked door north and the way out south.
  {
    col: 1,
    row: 3,
    chests: [{ col: 4, row: 3, contents: { kind: 'key' } }],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 6, row: 8 }, feet: { x: 160, y: 78 }, facing: 'down' },
      },
    ],
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..C.............##',
      '##..........B.....##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
];
