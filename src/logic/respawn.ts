/**
 * When defeated enemies come back (engine-free, unit tested; owner 2026-10-21).
 * Overworld: a room's defeated enemies stay gone until Jarrett has been through
 * a few other rooms since he left it; then they're all back. (Dungeons keep
 * their defeated enemies gone for good, in the progress record instead.)
 */
export interface Cleared {
  /** Rooms entered so far (every map), counting each entry. */
  visits: number;
  /** Rooms with defeated enemies: which ones (by place in the room's list), and the visit he was last there on. */
  rooms: ReadonlyMap<string, { defeated: readonly number[]; lastVisit: number }>;
}

export const NO_CLEARED: Cleared = { visits: 0, rooms: new Map() };

/**
 * Jarrett enters a room: rooms he left `roomsAway` or more rooms ago have
 * their enemies back. Returns the enemies still gone from this room.
 */
export function enterRoom(
  c: Cleared,
  key: string,
  roomsAway: number,
): { cleared: Cleared; gone: readonly number[] } {
  const visits = c.visits + 1;
  const rooms = new Map<string, { defeated: readonly number[]; lastVisit: number }>();
  for (const [k, r] of c.rooms) {
    // Rooms entered since he left this one: every visit after his last there, but this one.
    if (visits - r.lastVisit - 1 >= roomsAway) continue;
    rooms.set(k, k === key ? { ...r, lastVisit: visits } : r);
  }
  return { cleared: { visits, rooms }, gone: rooms.get(key)?.defeated ?? [] };
}

/** An enemy defeated in the room he's in (by its place in the room's list). */
export function defeat(c: Cleared, key: string, index: number): Cleared {
  const rooms = new Map(c.rooms);
  const room = rooms.get(key);
  const defeated = room ? [...room.defeated, index] : [index];
  rooms.set(key, { defeated, lastVisit: c.visits });
  return { ...c, rooms };
}
