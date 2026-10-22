/** Every map in the game: the overworld and the dungeons, each with its look and start room. */
import type { RoomDef } from '../logic/world';
import {
  CRYPT_TINT,
  MANOR_TINT,
  MARSH_TINT,
  MINE_TINT,
  SPIRE_TINT,
  WOOD_TINT,
} from '../logic/tiles';
import { DUNGEON_1, DUNGEON_1_START } from './dungeon1';
import { DUNGEON_2, DUNGEON_2_START } from './dungeon2';
import { DUNGEON_3, DUNGEON_3_START } from './dungeon3';
import { DUNGEON_4, DUNGEON_4_START } from './dungeon4';
import { DUNGEON_5, DUNGEON_5_START } from './dungeon5';
import { DUNGEON_6, DUNGEON_6_START } from './dungeon6';
import { DUNGEON_7, DUNGEON_7_START } from './dungeon7';
import { OVERWORLD, START_ROOM } from './overworld';
import { SHOP, SHOP_START } from './shop';
import { CAVES, CAVES_START } from './caves';

export type MapId =
  | 'overworld'
  | 'dungeon1'
  | 'dungeon2'
  | 'dungeon3'
  | 'dungeon4'
  | 'dungeon5'
  | 'dungeon6'
  | 'dungeon7'
  | 'shop'
  | 'caves';
/** How a map looks: outdoors, a dungeon, or indoors (drawn like a dungeon, without its small keys). */
export type Theme = 'forest' | 'dungeon' | 'indoors';

export interface GameMap {
  name: string;
  theme: Theme;
  /** Where Jarrett arrives (and gets back up after falling). */
  start: { col: number; row: number };
  rooms: readonly RoomDef[];
  /** A tint over the whole map's art (Bog Grotto: the marsh's), if any. */
  tint?: number;
}

export const MAPS: Readonly<Record<MapId, GameMap>> = {
  overworld: { name: 'Overworld', theme: 'forest', start: START_ROOM, rooms: OVERWORLD },
  dungeon1: { name: 'Hollow Oak', theme: 'dungeon', start: DUNGEON_1_START, rooms: DUNGEON_1 },
  dungeon2: {
    name: 'Bog Grotto',
    theme: 'dungeon',
    start: DUNGEON_2_START,
    rooms: DUNGEON_2,
    tint: MARSH_TINT,
  },
  dungeon3: {
    name: 'Sunken Crypt',
    theme: 'dungeon',
    start: DUNGEON_3_START,
    rooms: DUNGEON_3,
    tint: CRYPT_TINT,
  },
  dungeon4: {
    name: 'Stonecrag Mine',
    theme: 'dungeon',
    start: DUNGEON_4_START,
    rooms: DUNGEON_4,
    tint: MINE_TINT,
  },
  dungeon5: {
    name: 'Thunder Spire',
    theme: 'dungeon',
    start: DUNGEON_5_START,
    rooms: DUNGEON_5,
    tint: SPIRE_TINT,
  },
  dungeon6: {
    name: 'Witchwood Tower',
    theme: 'dungeon',
    start: DUNGEON_6_START,
    rooms: DUNGEON_6,
    tint: WOOD_TINT,
  },
  dungeon7: {
    name: 'Crimson Manor',
    theme: 'dungeon',
    start: DUNGEON_7_START,
    rooms: DUNGEON_7,
    tint: MANOR_TINT,
  },
  shop: { name: 'Shop', theme: 'indoors', start: SHOP_START, rooms: SHOP },
  caves: { name: 'Secret cave', theme: 'indoors', start: CAVES_START, rooms: CAVES },
};

/** Dungeon numbers for the ?dungeon=n play-test skip. */
export const DUNGEON_MAPS: Readonly<Record<number, MapId>> = {
  1: 'dungeon1',
  2: 'dungeon2',
  3: 'dungeon3',
  4: 'dungeon4',
  5: 'dungeon5',
  6: 'dungeon6',
  7: 'dungeon7',
};
