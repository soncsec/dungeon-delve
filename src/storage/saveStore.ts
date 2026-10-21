/**
 * Where the save game lives: one localStorage key (ADR-D04). Storage can be
 * missing or blocked (private browsing, full disk), so every call is guarded;
 * the game still plays, it just can't save.
 */
import { HUD, POTIONS } from '../config/tuning';
import { decodeSave, encodeSave, type SaveGame, type SaveRules } from '../logic/save';
import { MAPS } from '../world/maps';

const KEY = 'dungeon-delve:save';

export const SAVE_RULES: SaveRules = {
  maps: Object.keys(MAPS),
  maxPotions: POTIONS.max,
  // Far above what the status bar shows, so a rich player never loses a save.
  maxGems: HUD.maxGems * 1000,
};

export function readSave(): SaveGame | null {
  try {
    return decodeSave(window.localStorage.getItem(KEY), SAVE_RULES);
  } catch {
    return null;
  }
}

export function writeSave(save: SaveGame): void {
  try {
    window.localStorage.setItem(KEY, encodeSave(save));
  } catch {
    // No storage: nothing is saved.
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // No storage: nothing to clear.
  }
}
