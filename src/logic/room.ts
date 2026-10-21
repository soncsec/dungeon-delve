/**
 * Rooms as text (ADR-D01): each room is ROOM_ROWS lines of ROOM_COLS characters.
 * Engine-free and unit tested; scenes only draw what these functions return.
 *
 * Legend:
 *   .  open ground: grass outdoors, floor in a dungeon (walkable)
 *   F  forest wall (solid; edges and corners are drawn automatically)
 *   #  dungeon wall (solid; its top and its face are drawn automatically)
 *   T  pine tree   (solid trunk; the anchor is the trunk cell, the canopy rises above it)
 *   O  oak tree    (solid along its 3-cell base; the anchor is the middle of the base)
 *   R  boulder     (solid 2×2; the anchor is the top-left cell)
 *   r  small rock  (solid)
 *   b  bush        (solid)
 */
import { ROOM_COLS, ROOM_ROWS } from '../config/tuning';

export type PropKind = 'pine' | 'oak' | 'boulder' | 'rock' | 'bush';

export interface Cell {
  solid: boolean;
  /** Part of a forest wall. */
  forest: boolean;
  /** Part of a dungeon wall. */
  wall: boolean;
  /** The prop anchored in this cell, if any. */
  prop: PropKind | null;
}

export interface Room {
  cells: readonly (readonly Cell[])[];
}

export type Dir = 'north' | 'south' | 'east' | 'west';
export const DIRS: readonly Dir[] = ['north', 'south', 'east', 'west'];

const PROP_CHARS: Readonly<Record<string, PropKind>> = {
  T: 'pine',
  O: 'oak',
  R: 'boulder',
  r: 'rock',
  b: 'bush',
};

/** Cells each prop blocks, relative to its anchor cell. */
export const PROP_FOOTPRINT: Readonly<Record<PropKind, readonly (readonly [number, number])[]>> = {
  pine: [[0, 0]],
  oak: [
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  boulder: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  rock: [[0, 0]],
  bush: [[0, 0]],
};

/** Parses a room's text. Throws with a clear message on any mistake in the data. */
export function parseRoom(lines: readonly string[], name = 'room'): Room {
  if (lines.length !== ROOM_ROWS) {
    throw new Error(`${name}: expected ${ROOM_ROWS} rows, got ${lines.length}`);
  }
  const anchors: { x: number; y: number; prop: PropKind }[] = [];
  const cells: Cell[][] = lines.map((line, y) => {
    if (line.length !== ROOM_COLS) {
      throw new Error(`${name}: row ${y} has ${line.length} columns, expected ${ROOM_COLS}`);
    }
    return Array.from(line, (ch, x): Cell => {
      if (ch === '.') return { solid: false, forest: false, wall: false, prop: null };
      if (ch === 'F') return { solid: true, forest: true, wall: false, prop: null };
      if (ch === '#') return { solid: true, forest: false, wall: true, prop: null };
      const prop = PROP_CHARS[ch];
      if (!prop) throw new Error(`${name}: unknown character '${ch}' at column ${x}, row ${y}`);
      anchors.push({ x, y, prop });
      return { solid: true, forest: false, wall: false, prop };
    });
  });
  // Each prop also blocks its footprint, which must be plain grass in the text.
  const covered = new Set<string>();
  for (const { x, y, prop } of anchors) {
    for (const [dx, dy] of PROP_FOOTPRINT[prop]) {
      const fx = x + dx;
      const fy = y + dy;
      const target = cells[fy]?.[fx];
      if (!target) {
        throw new Error(`${name}: ${prop} at column ${x}, row ${y} reaches outside the room`);
      }
      const key = `${fx},${fy}`;
      const isAnchor = dx === 0 && dy === 0;
      if (covered.has(key) || (!isAnchor && target.solid)) {
        throw new Error(
          `${name}: ${prop} at column ${x}, row ${y} overlaps something at column ${fx}, row ${fy}`,
        );
      }
      covered.add(key);
      target.solid = true;
    }
  }
  return { cells };
}

/** The cell at (x, y), or null outside the room. */
export function cellAt(room: Room, x: number, y: number): Cell | null {
  return room.cells[y]?.[x] ?? null;
}

/** Whether (x, y) blocks movement. Outside the room counts as open: exits are handled by the world. */
export function isSolid(room: Room, x: number, y: number): boolean {
  return cellAt(room, x, y)?.solid ?? false;
}

/** Whether (x, y) is a forest wall cell. Outside the room continues the nearest edge cell, so walls run on. */
export function isForest(room: Room, x: number, y: number): boolean {
  const cx = Math.min(ROOM_COLS - 1, Math.max(0, x));
  const cy = Math.min(ROOM_ROWS - 1, Math.max(0, y));
  return cellAt(room, cx, cy)?.forest ?? false;
}

/** Whether (x, y) is a dungeon wall. Outside the room continues the nearest edge cell, so walls run on. */
export function isWall(room: Room, x: number, y: number): boolean {
  const cx = Math.min(ROOM_COLS - 1, Math.max(0, x));
  const cy = Math.min(ROOM_ROWS - 1, Math.max(0, y));
  return cellAt(room, cx, cy)?.wall ?? false;
}

/** For each cell along one edge (left to right, or top to bottom): open (true) or blocked. */
export function edgeOpenings(room: Room, dir: Dir): boolean[] {
  const along = dir === 'north' || dir === 'south' ? ROOM_COLS : ROOM_ROWS;
  return Array.from({ length: along }, (_, i) => {
    switch (dir) {
      case 'north':
        return !isSolid(room, i, 0);
      case 'south':
        return !isSolid(room, i, ROOM_ROWS - 1);
      case 'west':
        return !isSolid(room, 0, i);
      case 'east':
        return !isSolid(room, ROOM_COLS - 1, i);
    }
  });
}
