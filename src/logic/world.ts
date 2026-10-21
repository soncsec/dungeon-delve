/**
 * The world: rooms laid out on a grid, joined edge to edge (ADR-D01, ADR-D02).
 * Engine-free and unit tested.
 */
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/tuning';
import type { EnemyKind } from './enemies';
import type { ItemId } from './inventory';
import type { PotionKind } from './potions';
import {
  cellAt,
  edgeOpenings,
  exitsIn,
  fixturesIn,
  isSolid,
  parseRoom,
  type Dir,
  type Room,
} from './room';

export interface RoomDef {
  /** Grid position: column (west to east) and row (north to south). */
  col: number;
  row: number;
  lines: readonly string[];
  /** Enemies that appear each time Jarrett enters the room, by start cell. */
  enemies?: readonly EnemyPlacement[];
  /** What each chest (`C`) in the room holds. */
  chests?: readonly ChestPlacement[];
  /** Where each doorway (`D` cells) leads. */
  exits?: readonly MapExit[];
}

/** A doorway to another map: its cells here, and where Jarrett arrives. */
export interface MapExit {
  cells: readonly { col: number; row: number }[];
  to: {
    map: string;
    room: { col: number; row: number };
    /** His feet on arrival (room pixels), and the way he faces. */
    feet: { x: number; y: number };
    facing: 'up' | 'down' | 'left' | 'right';
  };
}

/** What a chest can hold. */
export type ChestContents =
  | { kind: 'key' }
  | { kind: 'gems'; amount: number }
  | { kind: 'item'; item: ItemId }
  | { kind: 'potion'; potion: PotionKind };

export interface ChestPlacement {
  col: number;
  row: number;
  contents: ChestContents;
}

export interface World {
  rooms: ReadonlyMap<string, Room>;
  /** Enemy start cells per room key. */
  enemies: ReadonlyMap<string, readonly EnemyPlacement[]>;
  /** Chest contents per room key. */
  chests: ReadonlyMap<string, readonly ChestPlacement[]>;
  /** Doorways to other maps per room key. */
  exits: ReadonlyMap<string, readonly MapExit[]>;
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
  const chests = new Map<string, readonly ChestPlacement[]>();
  const exits = new Map<string, readonly MapExit[]>();
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
    checkChests(key, room, d.chests ?? []);
    checkExits(key, room, d.exits ?? []);
    rooms.set(key, room);
    enemies.set(key, d.enemies ?? []);
    chests.set(key, d.chests ?? []);
    exits.set(key, d.exits ?? []);
  }
  return { rooms, enemies, chests, exits };
}

/** Every chest in a room has exactly one entry of contents, and every entry is on a chest. */
function checkChests(key: string, room: Room, placed: readonly ChestPlacement[]): void {
  for (const c of placed) {
    if (cellAt(room, c.col, c.row)?.fixture !== 'chest') {
      throw new Error(
        `room ${key}: chest contents at column ${c.col}, row ${c.row}, but no chest there`,
      );
    }
  }
  for (const f of fixturesIn(room).filter((f) => f.fixture === 'chest')) {
    const n = placed.filter((c) => c.col === f.x && c.row === f.y).length;
    if (n !== 1) {
      throw new Error(
        `room ${key}: the chest at column ${f.x}, row ${f.y} has ${n} lists of contents, not 1`,
      );
    }
  }
}

/** Every doorway cell belongs to exactly one listed exit, and every listed cell is a doorway. */
function checkExits(key: string, room: Room, listed: readonly MapExit[]): void {
  for (const e of listed) {
    for (const c of e.cells) {
      if (!cellAt(room, c.col, c.row)?.exit) {
        throw new Error(
          `room ${key}: exit lists column ${c.col}, row ${c.row}, which is not a doorway`,
        );
      }
    }
  }
  for (const d of exitsIn(room)) {
    const n = listed.filter((e) => e.cells.some((c) => c.col === d.x && c.row === d.y)).length;
    if (n !== 1) {
      throw new Error(
        `room ${key}: the doorway at column ${d.x}, row ${d.y} belongs to ${n} exits, not 1`,
      );
    }
  }
}

/** The exit whose doorway cell Jarrett's feet are in, if any. */
export function exitAt(world: World, key: string, cx: number, cy: number): MapExit | null {
  return (
    world.exits.get(key)?.find((e) => e.cells.some((c) => c.col === cx && c.row === cy)) ?? null
  );
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
 * `opened` says which doors and chests have been opened (they stop blocking).
 */
export function solidInWorld(
  world: World,
  col: number,
  row: number,
  cx: number,
  cy: number,
  opened: (roomKey: string, x: number, y: number) => boolean = () => false,
): boolean {
  const dc = Math.floor(cx / ROOM_COLS);
  const dr = Math.floor(cy / ROOM_ROWS);
  const key = roomKey(col + dc, row + dr);
  const room = world.rooms.get(key);
  if (!room) return true;
  const x = cx - dc * ROOM_COLS;
  const y = cy - dr * ROOM_ROWS;
  // An unlocked door or an opened chest no longer blocks.
  if (cellAt(room, x, y)?.fixture && opened(key, x, y)) return false;
  return isSolid(room, x, y);
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

/**
 * The cells just in front of a box at `feet` facing a way: every cell its
 * leading edge touches (one or two), which is where a bump lands.
 */
export function cellsAhead(
  feet: { x: number; y: number },
  facing: 'up' | 'down' | 'left' | 'right',
  box: { halfWidth: number; height: number },
): { cx: number; cy: number }[] {
  // A hair inside the far edges, so a box flush against a cell line doesn't reach the next cell.
  const EPS = 1e-6;
  const left = Math.floor((feet.x - box.halfWidth) / TILE);
  const right = Math.floor((feet.x + box.halfWidth - EPS) / TILE);
  const top = Math.floor((feet.y - box.height) / TILE);
  const bottom = Math.floor((feet.y - EPS) / TILE);
  const span = (a: number, b: number): number[] => (a === b ? [a] : [a, b]);
  switch (facing) {
    case 'left':
      return span(top, bottom).map((cy) => ({
        cx: Math.floor((feet.x - box.halfWidth - 1) / TILE),
        cy,
      }));
    case 'right':
      return span(top, bottom).map((cy) => ({
        cx: Math.floor((feet.x + box.halfWidth) / TILE),
        cy,
      }));
    case 'up':
      return span(left, right).map((cx) => ({
        cx,
        cy: Math.floor((feet.y - box.height - 1) / TILE),
      }));
    case 'down':
      return span(left, right).map((cx) => ({ cx, cy: Math.floor(feet.y / TILE) }));
  }
}
