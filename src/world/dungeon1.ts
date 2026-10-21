/**
 * Dungeon 1, Hollow Oak (PROJECT.md §3c). M3.1b: the entrance room with a
 * chest holding a small key, and a locked door north to a room with a chest
 * of gems. M3.2 lays out the whole dungeon.
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
    lines: [
      '#########..#########',
      '#########KK#########',
      '##................##',
      '##..C.............##',
      '##................##',
      '##................##',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
];
