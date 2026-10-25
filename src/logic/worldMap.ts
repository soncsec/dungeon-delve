/**
 * The world map in the inventory (engine-free, unit tested; owner 2026-10-23):
 * the overworld screens Jarrett has been in, laid out on the overworld's grid,
 * each in its region's colour, with the screen he's in now, the dungeon
 * entrances, and the secret caves he has found marked.
 */
import type { Region } from './tiles';
import { dungeonNumber, VAULT_NUMBER } from './progress';

/** A dungeon entrance on the map: still to do, its shard found, or the Shadow Vault. */
export type EntranceMark = 'dungeon' | 'done' | 'vault';

export interface WorldCell {
  /** Grid position, from the overworld's top-left screen. */
  x: number;
  y: number;
  region: Region;
  current: boolean;
  entrance: EntranceMark | null;
  /** A secret cave down from this screen that he has been in (M10.3b). */
  cave: boolean;
}

export interface WorldMap {
  /** Grid size: every screen of the overworld fits, seen or not. */
  cols: number;
  rows: number;
  cells: WorldCell[];
}

/** An overworld screen: where it is, its region, and the map its doorways lead to. */
export interface WorldRoom {
  col: number;
  row: number;
  region: Region;
  leadsTo: readonly string[];
}

type Cell = { col: number; row: number };

/** What a screen's doorways make it on the map: the first that leads into a dungeon. */
function entranceOf(room: WorldRoom, done: (map: string) => boolean): EntranceMark | null {
  const map = room.leadsTo.find((m) => dungeonNumber(m) !== null);
  if (map === undefined) return null;
  if (dungeonNumber(map) === VAULT_NUMBER) return 'vault';
  return done(map) ? 'done' : 'dungeon';
}

/** Lays out the seen screens (and the current one, always). */
export function worldMap(
  all: readonly WorldRoom[],
  seen: (col: number, row: number) => boolean,
  current: Cell,
  done: (map: string) => boolean,
  caveFound: (col: number, row: number) => boolean = () => false,
): WorldMap {
  const cols = all.map((r) => r.col);
  const rows = all.map((r) => r.row);
  const left = Math.min(...cols);
  const top = Math.min(...rows);
  const cells = all
    .filter((r) => seen(r.col, r.row) || (r.col === current.col && r.row === current.row))
    .map((r) => ({
      x: r.col - left,
      y: r.row - top,
      region: r.region,
      current: r.col === current.col && r.row === current.row,
      entrance: entranceOf(r, done),
      cave: caveFound(r.col, r.row),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { cols: Math.max(...cols) - left + 1, rows: Math.max(...rows) - top + 1, cells };
}
