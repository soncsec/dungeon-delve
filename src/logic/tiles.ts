/**
 * Picks the art for every cell of a room (ADR-D01). Engine-free: returns what
 * to draw where; the scene does the drawing.
 *
 * Forest walls use the forest sheet's tileable canopy block, with matching
 * left, right and bottom pieces on the wall's edges, and tree tops drawn
 * just above its top edge.
 */
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/tuning';
import { gatesOpen, isForest, isWall, type Ground, type PropKind, type Room } from './room';

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
  // The cave entrance comes from the mountain sheet.
  cave: { x: 48, y: 48, w: 48, h: 48 },
  // A thorn bush is the forest's bush under a thorny tint (THORN_TINT).
  thorns: { x: 128, y: 64, w: 16, h: 16 },
};

/** Which sheet each prop's art is on. */
export const PROP_SHEET: Readonly<Record<PropKind, 'forest' | 'dungeon' | 'town' | 'mountain'>> = {
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
  cave: 'mountain',
  thorns: 'forest',
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
  cave: { dx: 1.5 * TILE, dy: 3 * TILE },
  thorns: { dx: TILE / 2, dy: TILE },
};

/**
 * Mountain art for props the forest also has: drawn on dirt, without the
 * forest's teal shadows. Same size and anchors as the forest's.
 */
export const MOUNTAIN_PROP_REGIONS: Readonly<
  Partial<Record<PropKind, { x: number; y: number; w: number; h: number }>>
> = {
  boulder: { x: 16, y: 16, w: 32, h: 32 },
  rock: { x: 32, y: 96, w: 16, h: 16 },
};

/**
 * The sheet to draw a prop from in a region: village rooms use the recoloured
 * forest art, and the mountains their own boulders and rocks.
 */
export function propSheet(
  prop: PropKind,
  region: Region,
): 'forest' | 'forest-village' | 'dungeon' | 'town' | 'mountain' {
  const sheet = PROP_SHEET[prop];
  if ((region === 'mountains' || region === 'volcano') && MOUNTAIN_PROP_REGIONS[prop]) {
    return 'mountain';
  }
  return sheet === 'forest' && region === 'village' ? 'forest-village' : sheet;
}

/** Columns in the Top-Down Town sheet (384 px / 16). */
export const TOWN_COLUMNS = 24;
const tframe = (col: number, row: number): number => row * TOWN_COLUMNS + col;

export const TOWN_FRAMES = {
  grass: tframe(18, 1),
  /** Grass with a little texture, scattered for variety. */
  grassLight: tframe(19, 1),
  ground: { path: tframe(22, 5), flowers: tframe(21, 1), tall: tframe(20, 1) } satisfies Record<
    Exclude<Ground, 'paving' | 'hole'>,
    number
  >,
} as const;

/**
 * The overworld's regions (PROJECT.md decisions, 2026-10-20). More arrive with
 * M4.1c–e. The vault grounds are drawn like a dungeon (stone walls and floor).
 */
export type Region = 'forest' | 'village' | 'vault' | 'marsh' | 'ruins' | 'mountains' | 'volcano';

/** The marsh is the forest's art, darkened and greened by a tint over everything in the room. */
export const MARSH_TINT = 0x9cae8c;

/** A thorn bush: the forest bush, browned and reddened. */
export const THORN_TINT = 0xe0704c;

/** The volcano edge is the mountains under a hot red tint. */
export const VOLCANO_TINT = 0xffa486;
/** Sunken Crypt: the dungeon stone under a dry, sandy tint. */
export const CRYPT_TINT = 0xe8d0a0;
/** Stonecrag Mine: the dungeon stone under a warm, earthy tint. */
export const MINE_TINT = 0xd0a880;
/** Crimson Manor: the dungeon stone under a deep, old-blood red. */
export const MANOR_TINT = 0xd89098;

/** The Shadow Vault: the dungeon stone under a cold, shadowy violet. */
export const VAULT_TINT = 0x9a88c8;
/** Dragon's Maw: the dungeon stone under a hot, ember red. */
export const MAW_TINT = 0xf08a6a;
/** Witchwood Tower: the dungeon stone under a mossy, forest green. */
export const WOOD_TINT = 0x9cc890;

/** An eye statue, watching (it fires orbs): the pillar orb glowing red (runtime tint, ADR-D05). */
export const EYE_TINT = 0xff7060;

/** Thunder Spire: the dungeon stone under a cold, stormy blue. */
export const SPIRE_TINT = 0x7888d0;

/** Two tints at once, each channel multiplied: a thorn bush in a tinted room keeps its colour. */
export function mixTint(a: number, b: number): number {
  const channel = (shift: number) =>
    Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 0xff);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Columns in the Tiny RPG Mountain sheet (368 px / 16). */
export const MOUNTAIN_COLUMNS = 23;
const mframe = (col: number, row: number): number => row * MOUNTAIN_COLUMNS + col;

/**
 * Mountain art. A cliff is two columns wide on the sheet (18 and 19), from its
 * grassy top down through a ledge to three rows of rock face.
 */
export const MOUNTAIN_FRAMES = {
  dirt: mframe(3, 1),
  /** A dark hole in the ground: the way down to a secret cave. */
  hole: mframe(3, 2),
  /** Rubble: a cracked wall the Axe smashes (two cells wide on the sheet; alternated). */
  rubble: [mframe(1, 3), mframe(2, 3)],
  /** Dirt with a pale patch, scattered for variety. */
  dirtPatch: mframe(5, 6),
  /** By depth: the face's bottom row (open ground below), up through the face and ledge to the top. */
  cliff: [5, 4, 3, 2, 1].map((row) => [mframe(18, row), mframe(19, row)] as const),
} as const;

/**
 * The cliff piece for a mountain wall cell: rock face where it meets open
 * ground below, the ledge above that, and the grassy top further back.
 */
export function cliffFrame(room: Room, x: number, y: number): number {
  let depth = 0;
  while (depth < MOUNTAIN_FRAMES.cliff.length - 1 && isForest(room, x, y + depth + 1)) depth += 1;
  const row = MOUNTAIN_FRAMES.cliff[depth] as readonly [number, number];
  return row[((x % 2) + 2) % 2] as number;
}

function mountainGround(x: number, y: number): number {
  return (x * 31 + y * 17 + x * y * 3) % 11 === 0
    ? MOUNTAIN_FRAMES.dirtPatch
    : MOUNTAIN_FRAMES.dirt;
}

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
  sheet?: 'town' | 'forest-village' | 'marsh-water' | 'dungeon' | 'mountain';
  /** Drawn dimmed (SWITCH_DIM): a crystal switch not yet powered, or an eye statue shut. */
  dim?: boolean;
  /** Drawn under a tint of its own (an eye statue, watching: EYE_TINT). */
  tint?: number;
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

/**
 * The cells of a room that its art hides: under a prop's picture (a tree's
 * canopy and branches, a house's roof, an archway) or under the tree tops that
 * hang over the row above a forest wall. Enemies that walk keep out of them,
 * and nothing is dropped in them, so neither looks lost inside a tree.
 * As `x,y` cell keys; the prop's own solid cells are in it too.
 */
export function coveredCells(art: RoomArt): ReadonlySet<string> {
  const cells = new Set<string>();
  const cover = (left: number, top: number, right: number, bottom: number): void => {
    const x0 = Math.max(0, Math.floor(left / TILE));
    const x1 = Math.min(ROOM_COLS - 1, Math.ceil(right / TILE) - 1);
    const y0 = Math.max(0, Math.floor(top / TILE));
    const y1 = Math.min(ROOM_ROWS - 1, Math.ceil(bottom / TILE) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.add(`${x},${y}`);
  };
  for (const p of art.props) {
    const { w, h } = PROP_REGIONS[p.prop];
    cover(p.x - w / 2, p.y - h, p.x + w / 2, p.y);
  }
  for (const t of art.over) cover(t.x, t.y, t.x + TILE, t.y + TILE);
  return cells;
}

/** The same scatter as the dungeon's cracks: about one grass cell in nine looks a little different. */
function villageGrass(x: number, y: number): number {
  return (x * 73 + y * 151 + x * y * 7) % 9 === 0 ? TOWN_FRAMES.grassLight : TOWN_FRAMES.grass;
}

/** Everything to draw for an outdoor room, in its region's look. */
export function roomArt(
  room: Room,
  region: Region = 'forest',
  opened: (x: number, y: number) => boolean = () => false,
): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [], chests: [] };
  const mountains = region === 'mountains' || region === 'volcano';
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((cell, x) => {
      const px = x * TILE;
      const py = y * TILE;
      if (cell.ground === 'hole') {
        // The way down to a secret cave, in any region.
        art.ground.push({ frame: MOUNTAIN_FRAMES.hole, x: px, y: py, sheet: 'mountain' });
      } else if (cell.ground === 'paving') {
        // Stone paving, from the dungeon's floor (ruins).
        const frame = crackAt(x, y) ?? DUNGEON_FRAMES.floor;
        art.ground.push({ frame, x: px, y: py, sheet: 'dungeon' });
      } else if (region === 'village') {
        const frame = cell.ground ? TOWN_FRAMES.ground[cell.ground] : villageGrass(x, y);
        art.ground.push({ frame, x: px, y: py, sheet: 'town' });
      } else if (mountains) {
        art.ground.push({ frame: mountainGround(x, y), x: px, y: py, sheet: 'mountain' });
      } else {
        art.ground.push({ frame: FOREST_FRAMES.grass, x: px, y: py });
      }
      // A ruined wall: the dungeon's wall top or face, on the grass.
      if (cell.wall)
        art.ground.push({ frame: dungeonFrame(room, x, y), x: px, y: py, sheet: 'dungeon' });
      // A false wall opened, or a cracked wall smashed, is just ground now.
      const gone = cell.fixture !== null && opened(x, y);
      if ((cell.fixture === 'hollow' || cell.fixture === 'cracked') && gone) return;
      if (cell.fixture === 'cracked') {
        art.ground.push({
          frame: MOUNTAIN_FRAMES.rubble[x % 2] as number,
          x: px,
          y: py,
          sheet: 'mountain',
        });
        return;
      }
      if (cell.forest && mountains) {
        // In the mountains, walls are cliffs.
        art.ground.push({ frame: cliffFrame(room, x, y), x: px, y: py, sheet: 'mountain' });
      } else if (cell.forest) {
        // Village rooms use the forest walls recoloured to suit their light grass.
        const walls = region === 'village' ? { sheet: 'forest-village' as const } : {};
        art.ground.push({ frame: forestFrame(room, x, y), x: px, y: py, ...walls });
        // Tree tops grow over the ground above a wall, but not over a hole (it must show).
        if (y > 0 && !isForest(room, x, y - 1) && !room.cells[y - 1]?.[x]?.exit) {
          art.over.push({ frame: FOREST_FRAMES.top(x), x: px, y: py - TILE, ...walls });
        }
      }
      if (cell.water)
        art.ground.push({ frame: pondFrame(room, x, y), x: px, y: py, sheet: 'marsh-water' });
      // A smashed boulder or a burned thorn bush is gone.
      if (cell.prop && !gone) art.props.push(propDraw(cell.prop, x, y));
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
  /** A locked door: the wall face with iron bars. Also a gate a crystal switch opens. */
  gate: dframe(8, 7),
  /** A crystal switch: the orb at a pillar's foot, in the wall face. */
  orb: dframe(12, 7),
} as const;

/** A crystal switch not yet powered is drawn dim (runtime tint, ADR-D05); powered, it shines. */
export const SWITCH_DIM = 0x707090;

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
  const fixture = room.cells[y]?.[x]?.fixture;
  if ((fixture === 'door' || fixture === 'gate') && !opened) return DUNGEON_FRAMES.gate;
  if (fixture === 'switch' || fixture === 'eye') return DUNGEON_FRAMES.orb;
  if (isWall(room, x, y)) return isWall(room, x, y + 1) ? DUNGEON_FRAMES.top : DUNGEON_FRAMES.face;
  if (isWall(room, x - 1, y)) return DUNGEON_FRAMES.shadow;
  return crackAt(x, y) ?? DUNGEON_FRAMES.floor;
}

/**
 * Everything to draw for a dungeon room: one tile per cell, plus the chests
 * not yet opened and the props (thorn bushes) not yet burned. `opened` says
 * which doors, chests and thorns have been opened, and which crystal switches
 * powered (a powered switch opens its room's gates; one not yet powered is dim).
 */
export function dungeonArt(
  room: Room,
  opened: (x: number, y: number) => boolean = () => false,
): RoomArt {
  const art: RoomArt = { ground: [], over: [], props: [], chests: [] };
  const gates = gatesOpen(room, opened);
  room.cells.forEach((rowCells, y) => {
    rowCells.forEach((cell, x) => {
      const isOpen = cell.fixture === 'gate' ? gates : cell.fixture !== null && opened(x, y);
      const tile = { frame: dungeonFrame(room, x, y, isOpen), x: x * TILE, y: y * TILE };
      // A switch is dim until powered; an eye statue glows red until shut, then is dim.
      if (cell.fixture === 'eye')
        art.ground.push(isOpen ? { ...tile, dim: true } : { ...tile, tint: EYE_TINT });
      else art.ground.push(cell.fixture === 'switch' && !isOpen ? { ...tile, dim: true } : tile);
      // Rubble the Axe smashes: the mountain set's, on the floor.
      if (cell.fixture === 'cracked' && !isOpen) {
        const frame = MOUNTAIN_FRAMES.rubble[x % 2] as number;
        art.ground.push({ frame, x: x * TILE, y: y * TILE, sheet: 'mountain' });
      }
      if (cell.fixture === 'chest' && !isOpen) art.chests.push({ x: x * TILE, y: y * TILE });
      if (cell.prop && !isOpen) art.props.push(propDraw(cell.prop, x, y));
    });
  });
  art.props.sort((a, b) => a.y - b.y);
  return art;
}
