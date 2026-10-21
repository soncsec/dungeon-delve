/** Every map in the game: the overworld and the dungeons, each with its look and start room. */
import type { RoomDef } from '../logic/world';
import { DUNGEON_1, DUNGEON_1_START } from './dungeon1';
import { OVERWORLD, START_ROOM } from './overworld';

export type MapId = 'overworld' | 'dungeon1';
export type Theme = 'forest' | 'dungeon';

export interface GameMap {
  name: string;
  theme: Theme;
  /** Where Jarrett arrives (and gets back up after falling). */
  start: { col: number; row: number };
  rooms: readonly RoomDef[];
}

export const MAPS: Readonly<Record<MapId, GameMap>> = {
  overworld: { name: 'Overworld', theme: 'forest', start: START_ROOM, rooms: OVERWORLD },
  dungeon1: { name: 'Hollow Oak', theme: 'dungeon', start: DUNGEON_1_START, rooms: DUNGEON_1 },
};

/** Dungeon numbers for the ?dungeon=n play-test skip. */
export const DUNGEON_MAPS: Readonly<Record<number, MapId>> = { 1: 'dungeon1' };
