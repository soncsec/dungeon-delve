/**
 * The Shadow Vault (PROJECT.md §3c; owner 2026-10-22: four rooms), under the
 * vault grounds at the centre of the land. Walker opens its door once Jarrett
 * holds all 8 shards (M7.1).
 *
 *                 [sorcerer's hall]               the sorcerer (M7.2b), Kira's cell behind a
 *                                                 gate; a locked door from below (key 2)
 *   [west trial]  [entry hall]       [east trial] west: key 1 past sparks, thorns and a boulder;
 *                                                 entry: a locked door up (key 1), and a gate
 *                                                 east its crystal switch opens; east: a stone
 *                                                 to push, and key 2 caged by an eye statue
 *
 * The trials ask for what Jarrett has learned: the Ward, the Fireball and the
 * Axe in the west; Lightning (the entry hall's switch), a stone to push and
 * the Steel Sword (the eye) in the east.
 */
import type { RoomDef } from '../logic/world';

/** The entry hall: where Jarrett arrives and gets back up after falling. */
export const VAULT_START = { col: 1, row: 2 } as const;

export const VAULT: readonly RoomDef[] = [
  // The sorcerer's hall: Kira's cell at the top, behind a gate; the second locked door below.
  {
    col: 1,
    row: 1,
    lines: [
      '####################',
      '####################',
      '##.....#....#.....##',
      '##.....#....#.....##',
      '##.....##gg##.....##',
      '##................##',
      '##................##',
      '##................##',
      '#########KK#########',
      '#########..#########',
    ],
  },
  // The west trial: three walls, and through each a barrier: sparks (the Ward), thorns
  // (the Fireball), a boulder (the Axe); key 1 beyond them.
  {
    col: 0,
    row: 2,
    chests: [{ col: 3, row: 4, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'eye', col: 16, row: 6 },
      { kind: 'ghost', col: 11, row: 3 },
      { kind: 'snake', col: 8, row: 7 },
    ],
    lines: [
      '####################',
      '####################',
      '##...##..#...#....##',
      '##...##..#...#....##',
      '##.C.R...#...e......',
      '##.......t...#......',
      '##...##..#...#....##',
      '##...##..#...#....##',
      '####################',
      '####################',
    ],
  },
  // The entry hall: the way out south, a locked door up (key 1), the west trial, and a
  // gate east that its crystal switch (in the north wall) opens.
  {
    col: 1,
    row: 2,
    enemies: [
      { kind: 'ghost', col: 14, row: 3 },
      { kind: 'eye', col: 5, row: 6 },
    ],
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 6, row: 6 }, feet: { x: 240, y: 78 }, facing: 'down' },
      },
    ],
    lines: [
      '#########..#########',
      '####z####KK#########',
      '##................##',
      '##................##',
      '..................g.',
      '..................g.',
      '##................##',
      '##................##',
      '#########..#########',
      '#########DD#########',
    ],
  },
  // The east trial: a stone in the wall to push aside, then key 2 in a cage whose gate the
  // eye statue above holds shut (the Steel Sword).
  {
    col: 2,
    row: 2,
    chests: [{ col: 14, row: 7, contents: { kind: 'key' } }],
    enemies: [
      { kind: 'mushroom', col: 4, row: 3 },
      { kind: 'wolf', col: 10, row: 3 },
    ],
    lines: [
      '####################',
      '#############y######',
      '##.....#..........##',
      '##.....#..........##',
      '.......B..........##',
      '.......#..........##',
      '##.....#...##gg#####',
      '##.....#...#..C.####',
      '####################',
      '####################',
    ],
  },
];
