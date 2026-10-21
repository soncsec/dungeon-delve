/**
 * The world: rooms laid out on a grid, joined edge to edge (ADR-D01, ADR-D02).
 * Engine-free and unit tested.
 */
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/tuning';
import type { EnemyKind } from './enemies';
import { edgeOpenings, isSolid, parseRoom, type Dir, type Room } from './room';

export interface RoomDef {
  /** Grid position: column (west to east) and row (north to south). */
  col: number;
  row: number;
  lines: readonly string[];
  /** Enemies that appear each time Jarrett enters the room, by start cell. */
  enemies?: readonly EnemyPlacement[];
}

export interface World {
  rooms: ReadonlyMap<string, Room>;
  /** Enemy start cells per room key. */
  enemies: ReadonlyMap<string, readonly EnemyPlacement[]>;
}

export interface EnemyPlacement {
  kind: EnemyKind;
  col: number;
  row: number;
}

export const roomKey = (col: number, row: number): string => `${col},${row}`;

const STEP: Readonly<Record<Dir, readonly [number, number]>> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

const OPPOSITE: Readonly<Record<Dir, Dir>> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

/** Parses every room. Throws on a duplicate position, bad room data, or an enemy placed in a wall. */
export function buildWorld(defs: readonly RoomDef[]): World {
  const rooms = new Map<string, Room>();
  const enemies = new Map<string, readonly EnemyPlacement[]>();
  for (const d of defs) {
    const key = roomKey(d.col, d.row);
    if (rooms.has(key)) throw new Error(`two rooms at ${key}`);
    const room = parseRoom(d.lines, `room ${key}`);
    for (const r of d.enemies ?? []) {
      const cell = room.cells[r.row]?.[r.col];
      if (!cell || cell.solid) {
        throw new Error(
          `room ${key}: ${r.kind} at column ${r.col}, row ${r.row} is not on open ground`,
        );
      }
    }
    rooms.set(key, room);
    enemies.set(key, d.enemies ?? []);
  }
  return { rooms, enemies };
}

/** Grid position of the room next door in a direction (it may not exist). */
export function neighbour(col: number, row: number, dir: Dir): { col: number; row: number } {
  const [dc, dr] = STEP[dir];
  return { col: col + dc, row: row + dr };
}

/**
 * Every place where rooms don't join up: an opening on an edge with no room
 * behind it, or with a wall on the other side. Empty means the world is sound.
 */
export function joinProblems(world: World): string[] {
  const problems: string[] = [];
  for (const [key, room] of world.rooms) {
    const [col, row] = key.split(',').map(Number) as [number, number];
    for (const dir of ['north', 'south', 'east', 'west'] as const) {
      const mine = edgeOpenings(room, dir);
      const next = neighbour(col, row, dir);
      const other = world.rooms.get(roomKey(next.col, next.row));
      if (!other) {
        if (mine.some(Boolean))
          problems.push(`room ${key}: ${dir} edge is open but there is no room there`);
        continue;
      }
      const theirs = edgeOpenings(other, OPPOSITE[dir]);
      mine.forEach((open, i) => {
        if (open !== theirs[i]) {
          problems.push(
            `room ${key}: ${dir} edge cell ${i} is ${open ? 'open' : 'blocked'} but the room next door is not`,
          );
        }
      });
    }
  }
  return problems;
}

/**
 * Whether a cell blocks movement, measured from one room but reaching into its
 * neighbours: (-1, 4) is the west neighbour's column 19, row 4. Where there is
 * no room, everything is solid, so the hero can only leave through real gaps.
 */
export function solidInWorld(
  world: World,
  col: number,
  row: number,
  cx: number,
  cy: number,
): boolean {
  const dc = Math.floor(cx / ROOM_COLS);
  const dr = Math.floor(cy / ROOM_ROWS);
  const room = world.rooms.get(roomKey(col + dc, row + dr));
  if (!room) return true;
  return isSolid(room, cx - dc * ROOM_COLS, cy - dr * ROOM_ROWS);
}

/** The edge the hero has crossed, once the middle of his collision box leaves the room; null while inside. */
export function exitDirection(feet: { x: number; y: number }, boxHeight: number): Dir | null {
  const midY = feet.y - boxHeight / 2;
  if (feet.x < 0) return 'west';
  if (feet.x >= ROOM_COLS * TILE) return 'east';
  if (midY < 0) return 'north';
  if (midY >= ROOM_ROWS * TILE) return 'south';
  return null;
}

/** The same spot in the next room's coordinates, after crossing an edge. */
export function enterFrom(feet: { x: number; y: number }, dir: Dir): { x: number; y: number } {
  const [dc, dr] = STEP[dir];
  return { x: feet.x - dc * ROOM_COLS * TILE, y: feet.y - dr * ROOM_ROWS * TILE };
}
