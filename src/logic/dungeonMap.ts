/**
 * The dungeon map in the inventory (engine-free, unit tested): the rooms
 * Jarrett has been in, laid out on a grid from the dungeon's top-left room,
 * with the room he's in now and the boss room marked.
 */
export interface MapRoom {
  /** Grid position, from the dungeon's top-left room. */
  x: number;
  y: number;
  current: boolean;
  boss: boolean;
}

export interface DungeonMap {
  /** Grid size: every room of the dungeon fits, seen or not. */
  cols: number;
  rows: number;
  rooms: MapRoom[];
}

type Cell = { col: number; row: number };

/** Lays out the seen rooms (and the current one, always). */
export function dungeonMap(
  all: readonly Cell[],
  seen: (col: number, row: number) => boolean,
  current: Cell,
  isBoss: (col: number, row: number) => boolean,
): DungeonMap {
  const cols = all.map((c) => c.col);
  const rows = all.map((c) => c.row);
  const left = Math.min(...cols);
  const top = Math.min(...rows);
  const rooms = all
    .filter((c) => seen(c.col, c.row) || (c.col === current.col && c.row === current.row))
    .map((c) => ({
      x: c.col - left,
      y: c.row - top,
      current: c.col === current.col && c.row === current.row,
      boss: isBoss(c.col, c.row),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { cols: Math.max(...cols) - left + 1, rows: Math.max(...rows) - top + 1, rooms };
}
