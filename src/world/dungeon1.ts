/**
 * Dungeon 1, Hollow Oak (PROJECT.md §3c). M3.1: one walled room to show the
 * dungeon tiles; M3.2 lays out the whole dungeon.
 */
import type { RoomDef } from '../logic/world';

export const DUNGEON_1_START = { col: 0, row: 0 } as const;

export const DUNGEON_1: readonly RoomDef[] = [
  {
    col: 0,
    row: 0,
    lines: [
      '####################',
      '####################',
      '##................##',
      '##....##....##....##',
      '##....##....##....##',
      '##................##',
      '##................##',
      '##................##',
      '####################',
      '####################',
    ],
  },
];
