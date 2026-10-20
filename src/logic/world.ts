/**
 * The world: rooms laid out on a grid, joined edge to edge (ADR-D01, ADR-D02).
 * Engine-free and unit tested.
 */
import { edgeOpenings, parseRoom, type Dir, type Room } from './room';

export interface RoomDef {
  /** Grid position: column (west to east) and row (north to south). */
  col: number;
  row: number;
  lines: readonly string[];
}

export interface World {
  rooms: ReadonlyMap<string, Room>;
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

/** Parses every room. Throws on a duplicate position or bad room data. */
export function buildWorld(defs: readonly RoomDef[]): World {
  const rooms = new Map<string, Room>();
  for (const d of defs) {
    const key = roomKey(d.col, d.row);
    if (rooms.has(key)) throw new Error(`two rooms at ${key}`);
    rooms.set(key, parseRoom(d.lines, `room ${key}`));
  }
  return { rooms };
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
