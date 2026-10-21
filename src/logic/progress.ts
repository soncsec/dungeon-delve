/**
 * What Jarrett has changed in the world (engine-free, unit tested; ADR-D03):
 * the doors he has unlocked and the chests he has opened, which stay that
 * way, and the small keys he holds in each dungeon (keys only work in the
 * dungeon they were found in, as in Zelda). Plain data, so it can be saved.
 */
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
