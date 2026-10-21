/**
 * Dungeon 1, Hollow Oak (PROJECT.md §3c). M3.1b: the entrance room with a
 * chest holding a small key, a pushable stone, and a locked door north to a
 * room with a chest of gems. M3.2 lays out the whole dungeon.
 */
import type { RoomDef } from '../logic/world';

/** The entrance room: where Jarrett arrives and gets back up after falling. */
export const DUNGEON_1_START = { col: 0, row: 1 } as const;

export const DUNGEON_1: readonly RoomDef[] = [
  {
    col: 0,
    row: 0,
    chests: [{ col: 9, row: 3, contents: { kind: 'gems', amount: 20 } }],
    lines: [
      '####################',
      '####################',
      '##................##',
      '##.......C........##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '#########..#########',
    ],
  },
  {
    col: 0,
    row: 1,
    chests: [{ col: 4, row: 3, contents: { kind: 'key' } }],
    // The way back out, to just below the archway in the forest.
    exits: [
      {
        cells: [
          { col: 9, row: 9 },
          { col: 10, row: 9 },
        ],
        to: { map: 'overworld', room: { col: 1, row: 0 }, feet: { x: 160, y: 78 }, facing: 'down' },
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
