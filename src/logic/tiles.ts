/**
 * Picks the art for every cell of a room (ADR-D01). Engine-free: returns what
 * to draw where; the scene does the drawing.
 *
 * Forest walls use the forest sheet's tileable canopy block, with matching
 * left, right and bottom pieces on the wall's edges, and tree tops drawn
 * just above its top edge.
 */
import { TILE } from '../config/tuning';
import { isForest, isWall, type PropKind, type Room } from './room';

/** Columns in the forest sheet (432 px / 16). */
export const FOREST_COLUMNS = 27;
const frame = (col: number, row: number): number => row * FOREST_COLUMNS + col;

export const FOREST_FRAMES = {
  grass: frame(8, 2),
  fill: (x: number, y: number) => frame(20 + mod3(x), 4 + mod3(y)),
  left: (y: number) => frame(18, 4 + mod3(y)),
  right: (y: number) => frame(24, 4 + mod3(y)),
  aboveBottom: (x: number) => frame(20 + mod3(x), 8),
  bottom: (x: number) => frame(20 + mod3(x), 9),
  top: (x: number) => frame(20 + mod3(x), 2),
} as const;

/** Prop art: rectangles on the forest sheet, in pixels. */
export const PROP_REGIONS: Readonly<
  Record<PropKind, { x: number; y: number; w: number; h: number }>
> = {
  pine: { x: 160, y: 112, w: 48, h: 48 },
  oak: { x: 160, y: 48, w: 48, h: 48 },
  boulder: { x: 224, y: 64, w: 32, h: 32 },
  rock: { x: 128, y: 96, w: 16, h: 16 },
  bush: { x: 128, y: 64, w: 16, h: 16 },
};

function mod3(n: number): number {
  return ((n % 3) + 3) % 3;
}

/** A 16×16 frame drawn with its top-left corner at (x, y) in room pixels. */
export interface TileDraw {
  frame: number;
  x: number;
  y: number;
}

/** A prop drawn with its bottom-centre at (x, y) in room pixels; sorted by y for depth. */
export interface PropDraw {
  prop: PropKind;
  x: number;
  y: number;
}

export interface RoomArt {
  /** Under everything: grass and forest walls. */
  ground: TileDraw[];
  /** Over the hero: tree tops above a wall's top edge (things further north are behind). */
  over: TileDraw[];
  props: PropDraw[];
}

/** The frame for a forest wall cell, from which of its neighbours are forest too. */
export function forestFrame(room: Room, x: number, y: number): number {
  if (!isForest(room, x, y + 1)) return FOREST_FRAMES.bottom(x);
  if (!isForest(room, x, y + 2)) return FOREST_FRAMES.aboveBottom(x);
  if (!isForest(room, x - 1, y)) return FOREST_FRAMES.left(y);
  if (!isForest(room, x + 1, y)) return FOREST_FRAMES.right(y);
  return FOREST_FRAMES.fill(x, y);
}

/** Where a prop's art goes, given its anchor cell. */
export function propDraw(prop: PropKind, x: number, y: number): PropDraw {
  // The boulder's anchor is its top-left cell; the others stand on their anchor cell.
  if (prop === 'boulder') return { prop, x: (x + 1) * TILE, y: (y + 2) * TILE };
  return { prop, x: x * TILE + TILE / 2, y: (y + 1) * TILE };
}

/** Everything to draw for a room. */
export function roomArt(room: Room): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [] };
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((cell, x) => {
      const px = x * TILE;
      const py = y * TILE;
      art.ground.push({ frame: FOREST_FRAMES.grass, x: px, y: py });
      if (cell.forest) {
        art.ground.push({ frame: forestFrame(room, x, y), x: px, y: py });
        if (y > 0 && !isForest(room, x, y - 1)) {
          art.over.push({ frame: FOREST_FRAMES.top(x), x: px, y: py - TILE });
        }
      }
      if (cell.prop) art.props.push(propDraw(cell.prop, x, y));
    });
  });
  art.props.sort((a, b) => a.y - b.y);
  return art;
}

/** Columns in the dungeon sheet (the pack's example dungeon, 304 px / 16). */
export const DUNGEON_COLUMNS = 19;
const dframe = (col: number, row: number): number => row * DUNGEON_COLUMNS + col;

export const DUNGEON_FRAMES = {
  /** The lavender stone on top of a wall. */
  top: dframe(0, 0),
  /** The brick face of a wall, where it meets the floor. */
  face: dframe(0, 3),
  floor: dframe(0, 4),
  /** Floor in the shadow of a wall to its left. */
  shadow: dframe(11, 3),
  /** Cracked floor stones, scattered for variety. */
  cracks: [dframe(1, 4), dframe(2, 4), dframe(3, 4)],
} as const;

/** A fixed scatter: about one floor cell in nine gets cracks, the same every visit. */
export function crackAt(x: number, y: number): number | null {
  const h = (x * 73 + y * 151 + x * y * 7) % 9;
  return h === 0 ? (DUNGEON_FRAMES.cracks[(x + y) % 3] as number) : null;
}

/** The frame for a dungeon cell: wall top or face, floor, shadowed floor or cracked floor. */
export function dungeonFrame(room: Room, x: number, y: number): number {
  if (isWall(room, x, y)) return isWall(room, x, y + 1) ? DUNGEON_FRAMES.top : DUNGEON_FRAMES.face;
  if (isWall(room, x - 1, y)) return DUNGEON_FRAMES.shadow;
  return crackAt(x, y) ?? DUNGEON_FRAMES.floor;
}

/** Everything to draw for a dungeon room: one tile per cell, no props or tree tops. */
export function dungeonArt(room: Room): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [] };
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((_cell, x) => {
      art.ground.push({ frame: dungeonFrame(room, x, y), x: x * TILE, y: y * TILE });
    });
  });
  return art;
}
