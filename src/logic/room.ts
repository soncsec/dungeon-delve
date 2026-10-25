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
 *
 * Village props (Top-Down Town set):
 *   H  house       (solid 5×3 walls, anchored top-left; the roof rises 5 rows above, the steps sit below)
 *   M  maple tree  (solid 2-cell trunk, anchored left; an autumn tree)
 *   S  stump       (solid 2 cells, anchored left)
 *   n  cone bush   (solid)
 *   w  flower shrub (solid)
 * Marsh:
 *   W  water       (solid; ponds must be rectangles at least 2×2, for their shorelines)
 *
 * Ruins (dungeon stone outdoors):
 *   #  a ruined wall (solid; drawn with the dungeon's wall tops and faces)
 *   q  stone paving (open)
 *
 * Secrets (outdoors):
 *   h  false wall  (looks and blocks like the room's wall until struck twice with the sword)
 *   o  hole        (stairs down to a secret cave; the room lists where it leads)
 *   Q  a pushable stone on top of a hole
 *   x  cracked wall (rubble; solid until the Axe smashes it)
 *   t  thorn bush  (solid until a Fireball burns it)
 *   Every boulder (R) also smashes to the Axe.
 *
 * Lightning puzzles (dungeons):
 *   z  crystal switch (part of a wall; a Lightning bolt powers it, for good)
 *   g  gate           (barred until a crystal switch in the same room is powered)
 *
 * Ward puzzles (dungeons):
 *   e  spark barrier  (crackling energy; zaps Jarrett back, but he walks through inside the Ward)
 *
 * Steel Sword puzzles (dungeons):
 *   y  eye statue     (part of a wall; it fires orbs straight out. One batted back into it with
 *                      the Steel Sword shuts it for good, which opens the gates in its room)
 *
 * Mountains:
 *   V  cave entrance (3×3, anchored top-left: rock all round, the doorway in the middle column open)
 *
 * Village ground (open, drawn from the Town set):
 *   p  cobbled path
 *   ,  flowers
 *   "  tall grass
 */
import { ROOM_COLS, ROOM_ROWS } from '../config/tuning';

export type PropKind =
  | 'pine'
  | 'oak'
  | 'boulder'
  | 'rock'
  | 'bush'
  | 'arch'
  | 'house'
  | 'maple'
  | 'stump'
  | 'cone'
  | 'shrub'
  | 'cave'
  | 'thorns';

/** Open ground drawn with something on it (village). */
export type Ground = 'path' | 'flowers' | 'tall' | 'paving' | 'hole';

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
  /** Something drawn on open ground (village paths, flowers, tall grass). */
  ground?: Ground;
  /** Pond water (marsh). */
  water?: boolean;
  /** A boulder's cells: where its art is anchored (one blow breaks the whole boulder). */
  anchor?: { x: number; y: number };
}

/**
 * Things that block until opened: a locked door (a key), a chest, a false wall
 * (the sword), a cracked wall or a boulder (the Axe), a thorn bush (Fireball).
 * A crystal switch (Lightning) is powered rather than opened, and opens the
 * gates in its room, as an eye statue does once shut by its own orb (the Steel Sword).
 * A spark barrier never opens: only the Ward lets him through.
 */
export type Fixture =
  | 'door'
  | 'chest'
  | 'hollow'
  | 'secret'
  | 'cracked'
  | 'boulder'
  | 'thorns'
  | 'switch'
  | 'gate'
  | 'spark'
  | 'eye';

export interface Room {
  cells: readonly (readonly Cell[])[];
  /** Where its pushable stones start (the floor under them is open). */
  stones: readonly { cx: number; cy: number }[];
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
  H: 'house',
  M: 'maple',
  S: 'stump',
  n: 'cone',
  w: 'shrub',
  V: 'cave',
  t: 'thorns',
};

const GROUND_CHARS: Readonly<Record<string, Ground>> = {
  p: 'path',
  ',': 'flowers',
  '"': 'tall',
  q: 'paving',
};

/** A row of `w` cells by `h`, from the anchor. */
const block = (w: number, h: number): [number, number][] =>
  Array.from({ length: w * h }, (_, i) => [i % w, Math.floor(i / w)]);

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
  house: block(5, 3),
  maple: block(2, 1),
  stump: block(2, 1),
  cone: [[0, 0]],
  shrub: [[0, 0]],
  // The cave: rock all round its 3×3, but for the doorway down the middle below the top row.
  cave: block(3, 3).filter(([x, y]) => !(x === 1 && y > 0)),
  thorns: [[0, 0]],
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
      if (ch === 'W') return { ...plain, solid: true, water: true };
      if (ch === 'h') return { ...plain, solid: true, forest: true, fixture: 'hollow' };
      if (ch === 'x') return { ...plain, solid: true, forest: true, fixture: 'cracked' };
      // A dungeon's secret wall (owner 2026-10-24): stone, until two strikes crumble it.
      if (ch === 'u') return { ...plain, solid: true, wall: true, fixture: 'secret' };
      if (ch === 'o') return { ...plain, solid: false, exit: true, ground: 'hole' };
      if (ch === 'Q') {
        stones.push({ cx: x, cy: y });
        return { ...plain, solid: false, exit: true, ground: 'hole' };
      }
      const ground = GROUND_CHARS[ch];
      if (ground) return { ...plain, solid: false, ground };
      if (ch === 'F') return { ...plain, solid: true, forest: true };
      if (ch === '#') return { ...plain, solid: true, wall: true };
      if (ch === 'K') return { ...plain, solid: true, fixture: 'door' };
      if (ch === 'z') return { ...plain, solid: true, wall: true, fixture: 'switch' };
      if (ch === 'g') return { ...plain, solid: true, fixture: 'gate' };
      if (ch === 'e') return { ...plain, solid: true, fixture: 'spark' };
      if (ch === 'y') return { ...plain, solid: true, wall: true, fixture: 'eye' };
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
      // Boulders and thorn bushes can be broken or burned away.
      if (prop === 'boulder') {
        target.fixture = 'boulder';
        target.anchor = { x, y };
      }
      if (prop === 'thorns') target.fixture = 'thorns';
    }
  }
  checkPonds(cells, name);
  return { cells, stones };
}

/**
 * Ponds must be rectangles at least 2×2: the shoreline art has edges and outer
 * corners, but no inner corners, and no pieces for a pond one cell across.
 */
function checkPonds(cells: Cell[][], name: string): void {
  const water = (x: number, y: number): boolean => cells[y]?.[x]?.water === true;
  cells.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (!cell.water) return;
      const n = water(x, y - 1);
      const s = water(x, y + 1);
      const w = water(x - 1, y);
      const e = water(x + 1, y);
      const thin = (!n && !s) || (!w && !e);
      const notch = [
        [n, w, water(x - 1, y - 1)],
        [n, e, water(x + 1, y - 1)],
        [s, w, water(x - 1, y + 1)],
        [s, e, water(x + 1, y + 1)],
      ].some(([a, b, diagonal]) => a && b && !diagonal);
      if (thin || notch) {
        throw new Error(
          `${name}: the pond at column ${x}, row ${y} isn't a rectangle at least 2×2`,
        );
      }
    }),
  );
}

/** The cell at (x, y), or null outside the room. */
export function cellAt(room: Room, x: number, y: number): Cell | null {
  return room.cells[y]?.[x] ?? null;
}

/**
 * Whether a crystal switch in the room is powered, or an eye statue shut
 * (`powered` says which are): then its gates are open.
 */
export function gatesOpen(room: Room, powered: (x: number, y: number) => boolean): boolean {
  return room.cells.some((row, y) =>
    row.some((cell, x) => (cell.fixture === 'switch' || cell.fixture === 'eye') && powered(x, y)),
  );
}

/** Which way an eye statue looks (and fires): towards the open floor beside it, if any. */
export function eyeFacing(
  room: Room,
  x: number,
  y: number,
): 'up' | 'down' | 'left' | 'right' | null {
  const open = (cx: number, cy: number) => {
    const cell = room.cells[cy]?.[cx];
    return cell !== undefined && !cell.solid;
  };
  if (open(x, y + 1)) return 'down';
  if (open(x, y - 1)) return 'up';
  if (open(x + 1, y)) return 'right';
  if (open(x - 1, y)) return 'left';
  return null;
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

/** Where Jarrett can pass to the room next door: open ground, a door (locked or not), a gate or a spark barrier, but not a doorway to another map. */
export function isPassage(room: Room, x: number, y: number): boolean {
  const cell = cellAt(room, x, y);
  if (!cell) return true;
  if (cell.exit) return false;
  return (
    !cell.solid ||
    cell.fixture === 'door' ||
    cell.fixture === 'gate' ||
    cell.fixture === 'spark' ||
    cell.fixture === 'secret'
  );
}

/**
 * A secret wall and every secret-wall cell joined to it (side by side or one
 * above another): they crumble together, so a wall two cells thick opens at once.
 */
export function secretGroup(room: Room, x: number, y: number): { x: number; y: number }[] {
  if (cellAt(room, x, y)?.fixture !== 'secret') return [];
  const seen = new Set<string>([`${x},${y}`]);
  const group = [{ x, y }];
  for (let i = 0; i < group.length; i++) {
    const c = group[i] as { x: number; y: number };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = `${n.x},${n.y}`;
      if (seen.has(k) || cellAt(room, n.x, n.y)?.fixture !== 'secret') continue;
      seen.add(k);
      group.push(n);
    }
  }
  return group.sort((a, b) => a.y - b.y || a.x - b.x);
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
