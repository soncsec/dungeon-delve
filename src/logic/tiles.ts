/**
 * Picks the art for every cell of a room (ADR-D01). Engine-free: returns what
 * to draw where; the scene does the drawing.
 *
 * Forest walls use the forest sheet's tileable canopy block, with matching
 * left, right and bottom pieces on the wall's edges, and tree tops drawn
 * just above its top edge.
 */
import { TILE } from '../config/tuning';
import { isForest, isWall, type Ground, type PropKind, type Room } from './room';

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
  // The archway comes from the dungeon sheet (see PROP_SHEET).
  arch: { x: 16, y: 16, w: 64, h: 48 },
  // Village props come from the Top-Down Town sheet.
  house: { x: 192, y: 16, w: 80, h: 144 },
  maple: { x: 112, y: 16, w: 64, h: 64 },
  stump: { x: 64, y: 96, w: 32, h: 32 },
  cone: { x: 32, y: 96, w: 16, h: 32 },
  shrub: { x: 112, y: 96, w: 16, h: 16 },
};

/** Which sheet each prop's art is on. */
export const PROP_SHEET: Readonly<Record<PropKind, 'forest' | 'dungeon' | 'town'>> = {
  pine: 'forest',
  oak: 'forest',
  boulder: 'forest',
  rock: 'forest',
  bush: 'forest',
  arch: 'dungeon',
  house: 'town',
  maple: 'town',
  stump: 'town',
  cone: 'town',
  shrub: 'town',
};

/**
 * Where each prop's art sits: its bottom-centre, in pixels from its anchor
 * cell's top-left corner. Most stand on their anchor cell; the boulder and the
 * archway are anchored top-left; two-cell trunks are anchored on the left one;
 * the house's steps sit in the row below its 3-row footprint.
 */
const PROP_ANCHOR: Readonly<Record<PropKind, { dx: number; dy: number }>> = {
  pine: { dx: TILE / 2, dy: TILE },
  oak: { dx: TILE / 2, dy: TILE },
  rock: { dx: TILE / 2, dy: TILE },
  bush: { dx: TILE / 2, dy: TILE },
  cone: { dx: TILE / 2, dy: TILE },
  shrub: { dx: TILE / 2, dy: TILE },
  boulder: { dx: TILE, dy: 2 * TILE },
  arch: { dx: 2 * TILE, dy: 3 * TILE },
  maple: { dx: TILE, dy: TILE },
  stump: { dx: TILE, dy: TILE },
  house: { dx: 2.5 * TILE, dy: 4 * TILE },
};

/** The sheet to draw a prop from in a region: village rooms use the recoloured forest art. */
export function propSheet(
  prop: PropKind,
  region: Region,
): 'forest' | 'forest-village' | 'dungeon' | 'town' {
  const sheet = PROP_SHEET[prop];
  return sheet === 'forest' && region === 'village' ? 'forest-village' : sheet;
}

/** Columns in the Top-Down Town sheet (384 px / 16). */
export const TOWN_COLUMNS = 24;
const tframe = (col: number, row: number): number => row * TOWN_COLUMNS + col;

export const TOWN_FRAMES = {
  grass: tframe(18, 1),
  /** Grass with a little texture, scattered for variety. */
  grassLight: tframe(19, 1),
  ground: { path: tframe(22, 5), flowers: tframe(21, 1), tall: tframe(20, 1) } as Readonly<
    Record<Ground, number>
  >,
} as const;

/**
 * The overworld's regions (PROJECT.md decisions, 2026-10-20). More arrive with
 * M4.1c–e. The vault grounds are drawn like a dungeon (stone walls and floor).
 */
export type Region = 'forest' | 'village' | 'vault' | 'marsh';

/** The marsh is the forest's art, darkened and greened by a tint over everything in the room. */
export const MARSH_TINT = 0x9cae8c;

/** The pond tiles on marsh-water.png, in order (tools/art/marsh_water.py). */
export const POND_FRAMES = {
  water: 0,
  n: [1, 2],
  s: [3, 4],
  w: 5,
  e: 6,
  nw: 7,
  ne: 8,
  sw: 9,
  se: 10,
} as const;

/** The pond piece for a water cell: its edges and corners face the land around it. */
export function pondFrame(room: Room, x: number, y: number): number {
  const water = (dx: number, dy: number): boolean => room.cells[y + dy]?.[x + dx]?.water === true;
  const n = !water(0, -1);
  const s = !water(0, 1);
  const w = !water(-1, 0);
  const e = !water(1, 0);
  if (n && w) return POND_FRAMES.nw;
  if (n && e) return POND_FRAMES.ne;
  if (s && w) return POND_FRAMES.sw;
  if (s && e) return POND_FRAMES.se;
  // Long edges alternate between two pieces, so they don't repeat too plainly.
  if (n) return POND_FRAMES.n[x % 2] as number;
  if (s) return POND_FRAMES.s[x % 2] as number;
  if (w) return POND_FRAMES.w;
  if (e) return POND_FRAMES.e;
  return POND_FRAMES.water;
}

function mod3(n: number): number {
  return ((n % 3) + 3) % 3;
}

/** A 16×16 frame drawn with its top-left corner at (x, y) in room pixels; from `sheet` if given, else the map's own sheet. */
export interface TileDraw {
  frame: number;
  x: number;
  y: number;
  sheet?: 'town' | 'forest-village' | 'marsh-water';
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
  /** Closed chests, by their cell's top-left corner (room pixels). */
  chests: { x: number; y: number }[];
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
  const a = PROP_ANCHOR[prop];
  return { prop, x: x * TILE + a.dx, y: y * TILE + a.dy };
}

/** The same scatter as the dungeon's cracks: about one grass cell in nine looks a little different. */
function villageGrass(x: number, y: number): number {
  return (x * 73 + y * 151 + x * y * 7) % 9 === 0 ? TOWN_FRAMES.grassLight : TOWN_FRAMES.grass;
}

/** Everything to draw for an outdoor room, in its region's look. */
export function roomArt(room: Room, region: Region = 'forest'): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [], chests: [] };
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((cell, x) => {
      const px = x * TILE;
      const py = y * TILE;
      if (region === 'village') {
        const frame = cell.ground ? TOWN_FRAMES.ground[cell.ground] : villageGrass(x, y);
        art.ground.push({ frame, x: px, y: py, sheet: 'town' });
      } else {
        art.ground.push({ frame: FOREST_FRAMES.grass, x: px, y: py });
      }
      if (cell.forest) {
        // Village rooms use the forest walls recoloured to suit their light grass.
        const walls = region === 'village' ? { sheet: 'forest-village' as const } : {};
        art.ground.push({ frame: forestFrame(room, x, y), x: px, y: py, ...walls });
        if (y > 0 && !isForest(room, x, y - 1)) {
          art.over.push({ frame: FOREST_FRAMES.top(x), x: px, y: py - TILE, ...walls });
        }
      }
      if (cell.water)
        art.ground.push({ frame: pondFrame(room, x, y), x: px, y: py, sheet: 'marsh-water' });
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
  /** A locked door: the wall face with iron bars. */
  gate: dframe(8, 7),
} as const;

/** A fixed scatter: about one floor cell in nine gets cracks, the same every visit. */
export function crackAt(x: number, y: number): number | null {
  const h = (x * 73 + y * 151 + x * y * 7) % 9;
  return h === 0 ? (DUNGEON_FRAMES.cracks[(x + y) % 3] as number) : null;
}

/**
 * The frame for a dungeon cell: wall top or face, floor, shadowed floor or
 * cracked floor; a locked door shows the barred gate until `opened`.
 */
export function dungeonFrame(room: Room, x: number, y: number, opened = false): number {
  if (room.cells[y]?.[x]?.fixture === 'door' && !opened) return DUNGEON_FRAMES.gate;
  if (isWall(room, x, y)) return isWall(room, x, y + 1) ? DUNGEON_FRAMES.top : DUNGEON_FRAMES.face;
  if (isWall(room, x - 1, y)) return DUNGEON_FRAMES.shadow;
  return crackAt(x, y) ?? DUNGEON_FRAMES.floor;
}

/**
 * Everything to draw for a dungeon room: one tile per cell, plus the chests
 * not yet opened. `opened` says which doors and chests have been opened.
 */
export function dungeonArt(
  room: Room,
  opened: (x: number, y: number) => boolean = () => false,
): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [], chests: [] };
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((cell, x) => {
      const isOpen = cell.fixture !== null && opened(x, y);
      art.ground.push({ frame: dungeonFrame(room, x, y, isOpen), x: x * TILE, y: y * TILE });
      if (cell.fixture === 'chest' && !isOpen) art.chests.push({ x: x * TILE, y: y * TILE });
    });
  });
  return art;
}
