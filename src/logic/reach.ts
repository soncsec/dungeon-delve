/**
 * Can a map be finished? (engine-free, unit tested; ROADMAP M3.7). Explores
 * a map the way a player would, a cell at a time: walking, pushing stones,
 * opening every false wall and chest in reach, and spending small keys on
 * locked doors in reach, until nothing new opens. If that reaches every room, chest and door,
 * there is a valid order to do it in.
 *
 * Simplifications, on the safe side for hand-made rooms:
 * - Jarrett is one cell; the game moves him by the pixel with a body smaller
 *   than a cell, so anywhere this reaches, he can.
 * - Stones go back to where they started each time he enters a room (as in
 *   the game), so each room's stone puzzle is searched afresh on every visit.
 * - Keys are spent on the first door in reach (in a fixed order). With more
 *   doors than keys in reach at once, a different choice could matter; the
 *   dungeons are laid out so it doesn't, and this would report a door left shut.
 */
import { ROOM_COLS, ROOM_ROWS } from '../config/tuning';
import { PROP_FOOTPRINT, type Fixture, type Room } from './room';
import { roomKey, solidInWorld, type World } from './world';

export interface Reach {
  /** Room keys reached. */
  rooms: string[];
  /** Chests, locked doors and false walls opened, as `room/x,y`. */
  chests: string[];
  doors: string[];
  hollows: string[];
  /** Cracked walls, boulders and thorn bushes broken or burned (with the items held). */
  broken: string[];
  /** Doorways to other maps reached, as `room/x,y`. */
  exits: string[];
  /** Every cell he can stand in, as `room/x,y`. */
  cells: ReadonlySet<string>;
  /** Small keys found but never needed. */
  keys: number;
}

/** Items that open secrets: the Axe (cracked walls, boulders), Fireball (thorn bushes). */
export interface ReachItems {
  axe?: boolean;
  fireball?: boolean;
}

/** Where the exploring starts: a room, and a cell in it. */
export interface ReachStart {
  col: number;
  row: number;
  cx: number;
  cy: number;
}

interface Walk {
  rooms: Set<string>;
  cells: Set<string>;
  exits: Set<string>;
  /** Unopened chests and doors next to a reached cell, and which each is. */
  touched: Map<string, Fixture>;
}

const STEPS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

const id = (key: string, x: number, y: number): string => `${key}/${x},${y}`;

function roomOf(world: World, col: number, row: number): Room {
  const room = world.rooms.get(roomKey(col, row));
  if (!room) throw new Error(`no room at ${col},${row}`);
  return room;
}

/**
 * Everywhere he can walk, with the chests and doors opened so far. For each
 * room visit and each way its stones can lie, it floods the area he can walk
 * to; pushing a stone from the edge of that area gives a new layout. A visit
 * that lands inside an area already flooded for the same room and stones adds
 * nothing, so it is skipped: that keeps the search small.
 */
function walk(world: World, start: ReachStart, opened: ReadonlySet<string>): Walk {
  const out: Walk = { rooms: new Set(), cells: new Set(), exits: new Set(), touched: new Map() };
  type Visit = { col: number; row: number; room: Room; x: number; y: number; stones: string[] };
  const enter = (col: number, row: number, x: number, y: number): Visit => {
    const room = roomOf(world, col, row);
    // Its stones are back where they started.
    return { col, row, room, x, y, stones: room.stones.map((st) => `${st.cx},${st.cy}`) };
  };
  const queue: Visit[] = [enter(start.col, start.row, start.cx, start.cy)];
  /** Cells already flooded, per room and stone layout. */
  const flooded = new Map<string, Set<string>>();
  const isOpen = (k: string, x: number, y: number): boolean => opened.has(id(k, x, y));
  const solidCache = new Map<string, boolean>();
  while (queue.length > 0) {
    const v = queue.shift() as Visit;
    const key = roomKey(v.col, v.row);
    const layout = `${key}|${[...v.stones].sort().join(';')}`;
    const known = flooded.get(layout) ?? new Set<string>();
    if (known.has(`${v.x},${v.y}`)) continue;
    flooded.set(layout, known);
    out.rooms.add(key);
    const solid = (x: number, y: number): boolean => {
      const c = `${key}/${x},${y}`;
      let s = solidCache.get(c);
      if (s === undefined) {
        s = solidInWorld(world, v.col, v.row, x, y, isOpen);
        solidCache.set(c, s);
      }
      return s;
    };
    const inside = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < ROOM_COLS && y < ROOM_ROWS;
    // The area he can walk to without pushing anything.
    const area = known;
    area.add(`${v.x},${v.y}`);
    const todo: [number, number][] = [[v.x, v.y]];
    const next: Visit[] = [];
    while (todo.length > 0) {
      const [x, y] = todo.pop() as [number, number];
      if (v.room.cells[y]?.[x]?.exit) out.exits.add(id(key, x, y));
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny)) {
          // Into the room next door (solidInWorld says there is one).
          if (solid(nx, ny)) continue;
          const col = v.col + Math.floor(nx / ROOM_COLS);
          const row = v.row + Math.floor(ny / ROOM_ROWS);
          next.push(enter(col, row, (nx + ROOM_COLS) % ROOM_COLS, (ny + ROOM_ROWS) % ROOM_ROWS));
          continue;
        }
        const fixture = v.room.cells[ny]?.[nx]?.fixture;
        if (fixture && !isOpen(key, nx, ny)) {
          out.touched.set(id(key, nx, ny), fixture);
          continue;
        }
        const stone = `${nx},${ny}`;
        if (v.stones.includes(stone)) {
          // Lean on it: it slides one cell on, if that is open floor in this room.
          const bx = nx + dx;
          const by = ny + dy;
          if (!inside(bx, by) || solid(bx, by) || v.stones.includes(`${bx},${by}`)) continue;
          const stones = v.stones.map((t) => (t === stone ? `${bx},${by}` : t));
          next.push({ ...v, x: nx, y: ny, stones });
          continue;
        }
        if (solid(nx, ny) || area.has(stone)) continue;
        area.add(stone);
        todo.push([nx, ny]);
      }
    }
    for (const cell of area) out.cells.add(`${key}/${cell}`);
    queue.push(...next);
  }
  return out;
}

/** A fixture id taken apart: its room key and cell. */
function parse(fixture: string): { key: string; x: number; y: number } {
  const [key = '', xy = ''] = fixture.split('/');
  const [x = 0, y = 0] = xy.split(',').map(Number);
  return { key, x, y };
}

/** Explores a map from `start`: what can be reached and opened, in some valid order. */
export function explore(world: World, start: ReachStart, items: ReachItems = {}): Reach {
  const chests = new Set<string>();
  const doors = new Set<string>();
  const hollows = new Set<string>();
  const broken = new Set<string>();
  const opened = new Set<string>();
  let keys = 0;
  for (;;) {
    const w = walk(world, start, opened);
    const touched = [...w.touched].sort(([a], [b]) => (a < b ? -1 : 1));
    // Every false wall in reach first: two strikes of the sword open one.
    const walls = touched.filter(([, f]) => f === 'hollow').map(([c]) => c);
    for (const wall of walls) {
      hollows.add(wall);
      opened.add(wall);
    }
    if (walls.length > 0) continue;
    // Then what the items held can break or burn.
    const breakable = touched
      .filter(
        ([, f]) =>
          (items.axe && (f === 'cracked' || f === 'boulder')) || (items.fireball && f === 'thorns'),
      )
      .map(([c]) => c);
    for (const cell of breakable) {
      for (const part of partsOf(world, cell)) {
        broken.add(part);
        opened.add(part);
      }
    }
    if (breakable.length > 0) continue;
    // Then every chest in reach: they cost nothing.
    const found = touched.filter(([, f]) => f === 'chest').map(([c]) => c);
    for (const chest of found) {
      chests.add(chest);
      opened.add(chest);
      const { key, x, y } = parse(chest);
      const c = world.chests.get(key)?.find((ch) => ch.col === x && ch.row === y);
      if (c?.contents.kind === 'key') keys += 1;
    }
    if (found.length > 0) continue;
    // Then a key on a door in reach.
    const door = touched.find(([, f]) => f === 'door')?.[0];
    if (door && keys > 0) {
      keys -= 1;
      for (const cell of doorCells(world, door)) {
        doors.add(cell);
        opened.add(cell);
      }
      continue;
    }
    return {
      rooms: [...w.rooms].sort(),
      cells: w.cells,
      chests: [...chests].sort(),
      doors: [...doors].sort(),
      hollows: [...hollows].sort(),
      broken: [...broken].sort(),
      exits: [...w.exits].sort(),
      keys,
    };
  }
}

/** What breaks with a cell: a whole boulder (every cell of its footprint), or just the cell. */
function partsOf(world: World, cell: string): string[] {
  const { key, x, y } = parse(cell);
  const anchor = world.rooms.get(key)?.cells[y]?.[x]?.anchor;
  if (!anchor) return [cell];
  return PROP_FOOTPRINT.boulder.map(([dx, dy]) => id(key, anchor.x + dx, anchor.y + dy));
}

/** A key opens a door cell and the door cells beside it: a two-cell door (as in the game). */
function doorCells(world: World, door: string): string[] {
  const { key, x, y } = parse(door);
  const room = world.rooms.get(key);
  return [
    door,
    ...STEPS.filter(([dx, dy]) => room?.cells[y + dy]?.[x + dx]?.fixture === 'door').map(
      ([dx, dy]) => id(key, x + dx, y + dy),
    ),
  ];
}
