/**
 * The save game (ADR-D04; engine-free, unit tested). One save, as JSON, holding
 * only game progress: where to start, items, potions, gems, opened doors and
 * chests, keys, beaten bosses, shards, heart containers and play time. No names
 * or personal data.
 *
 * A save read back is untrusted: `decodeSave` checks every field and builds a
 * fresh object from the checked values only. Anything wrong and it returns
 * null, and the game starts fresh.
 */
import { ITEMS, SLOTS, type Inventory, type ItemId, type Slot } from './inventory';
import type { Potions } from './potions';
import type { Progress } from './progress';

export const SAVE_VERSION = 1;

export interface SaveGame {
  version: typeof SAVE_VERSION;
  /** The map to start on, at its start room (a save point). */
  map: string;
  inventory: Inventory;
  potions: Potions;
  gems: number;
  progress: Progress;
  /** Time played (ms), not counting pauses. */
  playMs: number;
  /** True once `?dungeon=n` was used: the run can't set a fastest time. */
  cheated: boolean;
}

/** What a valid save may hold. */
export interface SaveRules {
  maps: readonly string[];
  maxPotions: number;
  maxGems: number;
}

/** Limits that keep a tampered save from growing without bound. */
const MAX_IDS = 2000;
const MAX_ID_LENGTH = 64;
const MAX_KEYS = 99;
const MAX_PLAY_MS = 1000 * 60 * 60 * 24 * 365;

export function encodeSave(s: SaveGame): string {
  return JSON.stringify(s);
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const isCount = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

const isItem = (v: unknown): v is ItemId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, v);

function inventoryFrom(v: unknown): Inventory | null {
  if (!isObj(v) || !Array.isArray(v.owned) || !isObj(v.equipped)) return null;
  const owned: ItemId[] = [];
  for (const item of v.owned) {
    if (!isItem(item) || owned.includes(item)) return null;
    owned.push(item);
  }
  const equipped = {} as Record<Slot, ItemId | null>;
  for (const slot of SLOTS) {
    const item = v.equipped[slot];
    if (item === null) {
      equipped[slot] = null;
    } else if (isItem(item) && owned.includes(item) && ITEMS[item].slot === slot) {
      equipped[slot] = item;
    } else {
      return null;
    }
  }
  return { owned, equipped };
}

function progressFrom(v: unknown, maps: readonly string[]): Progress | null {
  if (!isObj(v) || !Array.isArray(v.opened) || !isObj(v.keys)) return null;
  if (v.opened.length > MAX_IDS) return null;
  const opened: string[] = [];
  for (const id of v.opened) {
    if (typeof id !== 'string' || id.length > MAX_ID_LENGTH || opened.includes(id)) return null;
    opened.push(id);
  }
  const keys: Record<string, number> = {};
  for (const [map, n] of Object.entries(v.keys)) {
    if (!maps.includes(map) || !isCount(n, MAX_KEYS)) return null;
    keys[map] = n;
  }
  return { opened, keys };
}

/** Reads a save back, or null if there is none or anything in it is wrong. */
export function decodeSave(raw: string | null, rules: SaveRules): SaveGame | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v.version !== SAVE_VERSION) return null;
  if (typeof v.map !== 'string' || !rules.maps.includes(v.map)) return null;
  const inventory = inventoryFrom(v.inventory);
  const progress = progressFrom(v.progress, rules.maps);
  const potions = v.potions;
  if (!inventory || !progress || !isObj(potions)) return null;
  if (!isCount(potions.health, rules.maxPotions) || !isCount(potions.mana, rules.maxPotions)) {
    return null;
  }
  if (!isCount(v.gems, rules.maxGems) || !isCount(v.playMs, MAX_PLAY_MS)) return null;
  if (typeof v.cheated !== 'boolean') return null;
  return {
    version: SAVE_VERSION,
    map: v.map,
    inventory,
    potions: { health: potions.health, mana: potions.mana },
    gems: v.gems,
    progress,
    playMs: v.playMs,
    cheated: v.cheated,
  };
}
