/**
 * Rooms as text (ADR-D01): each room is ROOM_ROWS lines of ROOM_COLS characters.
 * Engine-free and unit tested; scenes only draw what these functions return.
 *
 * Legend:
 *   .  open ground: grass outdoors, floor in a dungeon (walkable)
 *   F  forest wall (solid; edges and corners are drawn automatically)
 *   #  dungeon wall (solid; its top and its face are drawn automatically)
 *   K  locked door  (solid until opened with a small key; counts as a doorway between rooms)
 *   C  chest        (solid until opened; the room lists what it holds)
 *   B  pushable stone (starts here on floor; the game moves it, see logic/push.ts)
 *   A  stone archway (4×3, anchored top-left: lintel and pillars solid, opening open)
 *   D  doorway to another map (open; the room lists where each leads)
 *   T  pine tree   (solid trunk; the anchor is the trunk cell, the canopy rises above it)
 *   O  oak tree    (solid along its 3-cell base; the anchor is the middle of the base)
 *   R  boulder     (solid 2×2; the anchor is the top-left cell)
 *   r  small rock  (solid)
 *   b  bush        (solid)
 */
import { ROOM_COLS, ROOM_ROWS } from '../config/tuning';

export type PropKind = 'pine' | 'oak' | 'boulder' | 'rock' | 'bush' | 'arch';

export interface Cell {
  solid: boolean;
  /** Part of a forest wall. */
  forest: boolean;
  /** Part of a dungeon wall. */
  wall: boolean;
  /** The prop anchored in this cell, if any. */
  prop: PropKind | null;
  /** A locked door or a chest in this cell, if any (both block until opened). */
  fixture: Fixture | null;
  /** A doorway to another map. */
  exit: boolean;
}

export type Fixture = 'door' | 'chest';

export interface Room {
  cells: readonly (readonly Cell[])[];
  /** Where its pushable stones start (the floor under them is open). */
  stones?: readonly { cx: number; cy: number }[];
}

export type Dir = 'north' | 'south' | 'east' | 'west';
export const DIRS: readonly Dir[] = ['north', 'south', 'east', 'west'];

const PROP_CHARS: Readonly<Record<string, PropKind>> = {
  T: 'pine',
  O: 'oak',
  R: 'boulder',
  r: 'rock',
  b: 'bush',
  A: 'arch',
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
  // The archway: its lintel along the top, and a pillar each side; the middle two columns below the lintel are the opening.
  arch: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [3, 1],
    [0, 2],
    [3, 2],
  ],
};

/** Parses a room's text. Throws with a clear message on any mistake in the data. */
export function parseRoom(lines: readonly string[], name = 'room'): Room {
  if (lines.length !== ROOM_ROWS) {
    throw new Error(`${name}: expected ${ROOM_ROWS} rows, got ${lines.length}`);
  }
  const anchors: { x: number; y: number; prop: PropKind }[] = [];
  const stones: { cx: number; cy: number }[] = [];
  const cells: Cell[][] = lines.map((line, y) => {
    if (line.length !== ROOM_COLS) {
      throw new Error(`${name}: row ${y} has ${line.length} columns, expected ${ROOM_COLS}`);
    }
    return Array.from(line, (ch, x): Cell => {
      const plain = { forest: false, wall: false, prop: null, fixture: null, exit: false };
      if (ch === '.') return { ...plain, solid: false };
      if (ch === 'F') return { ...plain, solid: true, forest: true };
      if (ch === '#') return { ...plain, solid: true, wall: true };
      if (ch === 'K') return { ...plain, solid: true, fixture: 'door' };
      if (ch === 'C') return { ...plain, solid: true, fixture: 'chest' };
      if (ch === 'D') return { ...plain, solid: false, exit: true };
      if (ch === 'B') {
        stones.push({ cx: x, cy: y });
        return { ...plain, solid: false };
      }
      const prop = PROP_CHARS[ch];
      if (!prop) throw new Error(`${name}: unknown character '${ch}' at column ${x}, row ${y}`);
      anchors.push({ x, y, prop });
      return { ...plain, solid: true, prop };
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
  return { cells, stones };
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

/** Where Jarrett can pass to the room next door: open ground, or a door (locked or not), but not a doorway to another map. */
export function isPassage(room: Room, x: number, y: number): boolean {
  const cell = cellAt(room, x, y);
  if (!cell) return true;
  if (cell.exit) return false;
  return !cell.solid || cell.fixture === 'door';
}

/** Every doorway cell to another map in a room. */
export function exitsIn(room: Room): { x: number; y: number }[] {
  return room.cells.flatMap((row, y) => row.flatMap((cell, x) => (cell.exit ? [{ x, y }] : [])));
}

/** Every door and chest in a room. */
export function fixturesIn(room: Room): { x: number; y: number; fixture: Fixture }[] {
  return room.cells.flatMap((row, y) =>
    row.flatMap((cell, x) => (cell.fixture ? [{ x, y, fixture: cell.fixture }] : [])),
  );
}

/** For each cell along one edge (left to right, or top to bottom): a way through (true) or blocked. Doors count as ways through. */
export function edgeOpenings(room: Room, dir: Dir): boolean[] {
  const along = dir === 'north' || dir === 'south' ? ROOM_COLS : ROOM_ROWS;
  return Array.from({ length: along }, (_, i) => {
    switch (dir) {
      case 'north':
        return isPassage(room, i, 0);
      case 'south':
        return isPassage(room, i, ROOM_ROWS - 1);
      case 'west':
        return isPassage(room, 0, i);
      case 'east':
        return isPassage(room, ROOM_COLS - 1, i);
    }
  });
}

/**
 * The cells that close when a room seals (a boss fight): each way out, one
 * cell in from the room's edge, so whoever is inside stays inside.
 */
export function sealCells(room: Room): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < ROOM_ROWS - 1; y += 1) {
    for (let x = 1; x < ROOM_COLS - 1; x += 1) {
      if (isSolid(room, x, y)) continue;
      const ways: [boolean, number, number][] = [
        [y === 1, x, 0],
        [y === ROOM_ROWS - 2, x, ROOM_ROWS - 1],
        [x === 1, 0, y],
        [x === ROOM_COLS - 2, ROOM_COLS - 1, y],
      ];
      if (ways.some(([edge, ox, oy]) => edge && isPassage(room, ox, oy))) out.push({ x, y });
    }
  }
  return out;
}
