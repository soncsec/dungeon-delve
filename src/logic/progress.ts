/**
 * What Jarrett has changed in the world (engine-free, unit tested; ADR-D03):
 * the doors he has unlocked and the chests he has opened, which stay that
 * way, and the small keys he holds in each dungeon (keys only work in the
 * dungeon they were found in, as in Zelda). Plain data, so it can be saved.
 */
import type { ItemId } from './inventory';
import type { ChestContents } from './world';

export interface Progress {
  /** Ids of opened doors and chests (see `fixtureId`). */
  opened: readonly string[];
  /** Small keys held, per map. */
  keys: Readonly<Record<string, number>>;
}

export const NEW_PROGRESS: Progress = { opened: [], keys: {} };

/** A door's or chest's id: its map, room and cell. */
export const fixtureId = (map: string, roomKey: string, x: number, y: number): string =>
  `${map}/${roomKey}/${x},${y}`;

/** A boss's id: its map and room. Beaten bosses are kept with the opened doors and chests. */
export const bossId = (map: string, roomKey: string): string => `${map}/${roomKey}/boss`;

/** Records a boss as beaten (once). */
export function beatBoss(p: Progress, id: string): Progress {
  return openChest(p, id);
}

export function isOpened(p: Progress, id: string): boolean {
  return p.opened.includes(id);
}

export function keysIn(p: Progress, map: string): number {
  return p.keys[map] ?? 0;
}

export function addKey(p: Progress, map: string): Progress {
  return { ...p, keys: { ...p.keys, [map]: keysIn(p, map) + 1 } };
}

/** Opens a chest (once). */
export function openChest(p: Progress, id: string): Progress {
  return isOpened(p, id) ? p : { ...p, opened: [...p.opened, id] };
}

/** Unlocks a door with one of this map's keys; `unlocked` is false (and nothing changes) without one. */
export function unlockDoor(
  p: Progress,
  map: string,
  id: string,
): { progress: Progress; unlocked: boolean } {
  if (isOpened(p, id)) return { progress: p, unlocked: true };
  if (keysIn(p, map) <= 0) return { progress: p, unlocked: false };
  return {
    progress: { opened: [...p.opened, id], keys: { ...p.keys, [map]: keysIn(p, map) - 1 } },
    unlocked: true,
  };
}

/** What a beaten boss leaves: a heart container and a shard of the Star of Power. */
export type Reward = 'heart' | 'shard' | 'crystal';

/** A reward's id: one of each per map. */
export const rewardId = (map: string, reward: Reward): string => `${map}/${reward}`;

/** Records a reward as taken (once). */
export function takeReward(p: Progress, id: string): Progress {
  return openChest(p, id);
}

/** Mana Crystals found: each makes the mana bar bigger. */
export function manaCrystals(p: Progress): number {
  return countOf(p, 'crystal');
}

/** A heart container from a chest (a secret cave's): each room's has its own id. */
export const chestHeartId = (map: string, roomKey: string): string => `${map}/${roomKey}/heart`;

/** Marks a chest's key as picked up (keys are only counted, so each chest's is marked). */
export const takenId = (chestId: string): string => `${chestId}/taken`;

/**
 * Whether an opened chest's prize still waits on the floor: Jarrett left the
 * room without it, and pickups don't outlast a room. Items he doesn't own,
 * keys never picked up, and heart containers and Mana Crystals not taken
 * (`rewards` gives their ids) come back; gems and potions don't (nothing
 * depends on them).
 */
export function leftInChest(
  contents: ChestContents,
  p: Progress,
  chestId: string,
  rewards: { heart: string; crystal: string },
  owned: readonly ItemId[],
): boolean {
  if (!isOpened(p, chestId)) return false;
  if (contents.kind === 'item') return !owned.includes(contents.item);
  if (contents.kind === 'key') return !isOpened(p, takenId(chestId));
  if (contents.kind === 'heart') return !isOpened(p, rewards.heart);
  if (contents.kind === 'crystal') return !isOpened(p, rewards.crystal);
  return false;
}

function countOf(p: Progress, reward: Reward): number {
  return p.opened.filter((id) => id.endsWith(`/${reward}`)).length;
}

/** Shards of the Star of Power found. */
export function shardsHeld(p: Progress): number {
  return countOf(p, 'shard');
}

/** Heart containers found: each one is an extra heart. */
export function heartContainers(p: Progress): number {
  return countOf(p, 'heart');
}

/** What the screen says when Jarrett finds a shard (`held` includes the new one). */
/** The message on finding a Mana Crystal. */
export const CRYSTAL_MESSAGE: readonly string[] = ['A MANA CRYSTAL!', '', 'YOUR MANA BAR GROWS.'];

export function shardMessage(held: number, total: number): string[] {
  const left = total - held;
  if (left <= 0) return ['THE STAR OF POWER', 'IS WHOLE!'];
  return [
    'A SHARD OF THE',
    'STAR OF POWER!',
    '',
    left === 1 ? '1 MORE TO FIND.' : `${left} MORE TO FIND.`,
  ];
}

/** A room Jarrett has been in (for the dungeon map): its map and room. */
export const seenId = (map: string, roomKey: string): string => `${map}/${roomKey}/seen`;

/** Records a room as seen (once). */
export function markSeen(p: Progress, id: string): Progress {
  return openChest(p, id);
}

/**
 * Shards are the keys to the dungeons (owner 2026-10-21): dungeon n's entrance
 * opens once Jarrett holds n−1 shards; the Shadow Vault, the ninth, all 8.
 * Other maps need none.
 */
export function shardsToEnter(map: string): number {
  const n = dungeonNumber(map);
  return n === null ? 0 : Math.max(0, n - 1);
}

/** The Shadow Vault counts as the ninth dungeon: it needs all 8 shards, and a ?dungeon=9 run starts there with every prize. */
export const VAULT_NUMBER = 9;

/** A dungeon map's number (`dungeon2` is 2; the vault, 9), or null for any other map. */
export function dungeonNumber(map: string): number | null {
  if (map === 'vault') return VAULT_NUMBER;
  const n = /^dungeon(\d+)$/.exec(map)?.[1];
  return n === undefined ? null : Number(n);
}

/** Whether Jarrett holds enough shards to go into a map. */
export function canEnter(p: Progress, map: string): boolean {
  return shardsHeld(p) >= shardsToEnter(map);
}

/** A dungeon enemy's id: its map, room and place in the room's list. */
export const enemyId = (map: string, roomKey: string, index: number): string =>
  `${map}/${roomKey}/enemy${index}`;

/** Records a dungeon enemy as defeated, for good (once). */
export function markDefeated(p: Progress, id: string): Progress {
  return openChest(p, id);
}
