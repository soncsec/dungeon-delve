/**
 * Bosses (engine-free, unit tested). The Treant stands its ground, shuffling
 * from side to side, and fires spreads of shots at Jarrett. The Giant Frog
 * sits, crouches, and leaps at him; each landing throws a ring of shots, and
 * in the air it can't be hit. The Mummy shambles after him, firing spreads;
 * wrapped tight, it takes hits only while a Lightning bolt has it stunned.
 * The Ogre lumbers side to side, raises its club and slams it down in a ring
 * of shockwaves; its hide is too thick for anything but the Axe.
 * The Centaur paces, and gallops at Jarrett when he is level with it; it rears,
 * and calls down a storm of lightning (logic/storm.ts) instead of shooting.
 * Below half health a boss turns fiercer: more shots, more often. A hit (by
 * id, so each lands once) costs it health; at zero it is beaten.
 */
import type { ItemId } from './inventory';
import type { Point } from './movement';
import type { Rng } from './rng';
import type { Vec } from './enemies';

export type BossKind = 'treant' | 'frog' | 'mummy' | 'ogre' | 'centaur';

/** How a boss moves. */
export type BossMoves =
  /** Shuffling side to side: speed, and how far either side of where it starts. */
  | { style: 'shuffle'; speed: number; range: number }
  /** Shambling straight at Jarrett, keeping its feet inside `arena` (room pixels). */
  | {
      style: 'shamble';
      speed: number;
      arena: { x: number; y: number; w: number; h: number };
    }
  /**
   * Leaping at Jarrett: it crouches for `crouchMs` (the warning), then leaps
   * up to `reach` px towards him over `leapMs`, rising `peak` px, and lands
   * with its feet inside `arena` (room pixels).
   */
  | {
      style: 'hop';
      crouchMs: number;
      leapMs: number;
      reach: number;
      peak: number;
      arena: { x: number; y: number; w: number; h: number };
    }
  /**
   * Pacing towards Jarrett at `speed`; when he is level with it (within
   * `inLine` px of its row or column, and `sight` px away) it gallops along
   * that line at `dashSpeed` for up to `dashMs`, stopping at the arena's edge,
   * then rests `restMs`. Its feet stay inside `arena` (room pixels).
   */
  | {
      style: 'gallop';
      speed: number;
      dashSpeed: number;
      dashMs: number;
      sight: number;
      inLine: number;
      restMs: number;
      arena: { x: number; y: number; w: number; h: number };
    };

export interface BossStats {
  health: number;
  /** Half hearts it takes from Jarrett on touch. */
  contactDamage: number;
  /** Its body (for hits and touching), around its feet. */
  box: { halfWidth: number; height: number };
  moves: BossMoves;
  /**
   * Calm, then fierce (at or below half health): shots per spread, the angle
   * between them, and the time between attacks (a spread; for a leaper, the
   * time sitting before the next leap, whose landing throws the spread).
   */
  calm: { shots: number; spreadDeg: number; everyMs: { min: number; max: number } };
  fierce: { shots: number; spreadDeg: number; everyMs: { min: number; max: number } };
  /** Wrapped tight (the Mummy): hits land only while a Lightning bolt has it stunned, for `stunMs`. */
  wrapped?: { stunMs: number };
  /**
   * A shuffler or shambler that winds up first (the Ogre raising its club): it
   * stands still this long (ms) before each attack, which is then a ring of
   * shots (`ring`) rather than a spread.
   */
  windUpMs?: number;
  ring?: boolean;
  /** A hide only the Axe gets through (the Ogre): other blows, and every shot, glance off. */
  hide?: 'axe';
  /** Its attack is a storm of lightning (the Centaur), not shots: logic/storm.ts says where. */
  storm?: boolean;
}

/** A leaper's leap under way: from, to, and the time it has been in the air (ms). */
export interface Leap {
  from: Point;
  to: Point;
  ms: number;
}

export interface Boss {
  kind: BossKind;
  pos: Point;
  /** Where it started; it shuffles either side of this. */
  home: Point;
  health: number;
  /** 1 shuffling right, -1 left. */
  heading: 1 | -1;
  shootInMs: number;
  lastHitBy: number | null;
  /** Time left flashing after a hit (ms). */
  flashMs: number;
  /** A leaper sits, then crouches (its timer counts down the crouch), then leaps (`leap`). */
  phase: 'sit' | 'crouch';
  leap: Leap | null;
  /** Time left stunned by Lightning (ms): it stands still and fires nothing. */
  stunMs: number;
  /** A galloper's dash: its way, and the time left (ms); then the time left resting. */
  dash: { dir: Vec; ms: number } | null;
  restMs: number;
}

export function spawnBoss(kind: BossKind, pos: Point, s: BossStats, rng: Rng): Boss {
  return {
    kind,
    pos: { ...pos },
    home: { ...pos },
    health: s.health,
    heading: rng.pick([1, -1] as const),
    shootInMs: rng.int(s.calm.everyMs.min, s.calm.everyMs.max),
    lastHitBy: null,
    flashMs: 0,
    phase: 'sit',
    leap: null,
    stunMs: 0,
    dash: null,
    restMs: 0,
  };
}

export function isFierce(b: Boss, s: BossStats): boolean {
  return b.health * 2 <= s.health;
}

/** Directions for a spread of `n` shots centred on `aim`, `spreadDeg` apart. */
export function spread(aim: Vec, n: number, spreadDeg: number): Vec[] {
  const base = Math.atan2(aim.y, aim.x);
  const step = (spreadDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const a = base + (i - (n - 1) / 2) * step;
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

/** `n` shots `stepDeg` apart, the first along `aim` (a whole ring when n × stepDeg is 360). */
export function ring(aim: Vec, n: number, stepDeg: number): Vec[] {
  const base = Math.atan2(aim.y, aim.x);
  const step = (stepDeg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos(base + i * step),
    y: Math.sin(base + i * step),
  }));
}

/** The unit vector from `from` towards `to` (straight down if they meet). */
function aimAt(from: Point, to: Point): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 1 } : { x: dx / len, y: dy / len };
}

/** Advances a boss by `dtMs`: it moves its way, and attacks when its timer runs out. */
export function stepBoss(
  b: Boss,
  dtMs: number,
  hero: Point,
  s: BossStats,
  rng: Rng,
): { boss: Boss; shots: Vec[]; storm: boolean } {
  if (b.stunMs > 0) {
    const stunMs = Math.max(0, b.stunMs - dtMs);
    return {
      boss: { ...b, stunMs, flashMs: Math.max(0, b.flashMs - dtMs) },
      shots: [],
      storm: false,
    };
  }
  const m = s.moves;
  if (m.style === 'hop') return { ...stepLeaper(b, dtMs, hero, s, m, rng), storm: false };
  if (m.style === 'gallop') return stepGalloper(b, dtMs, hero, s, m, rng);
  const mood = isFierce(b, s) ? s.fierce : s.calm;
  let x = b.pos.x;
  let y = b.pos.y;
  let heading = b.heading;
  // Winding up for an attack, it stands still.
  const windingUp = b.phase === 'crouch';
  if (m.style === 'shuffle' && !windingUp) {
    x += (b.heading * m.speed * dtMs) / 1000;
    if (x > b.home.x + m.range) {
      x = b.home.x + m.range;
      heading = -1;
    } else if (x < b.home.x - m.range) {
      x = b.home.x - m.range;
      heading = 1;
    }
  } else if (m.style === 'shamble' && !windingUp) {
    // Straight at Jarrett (no further than he is), its feet kept inside the arena.
    const dx = hero.x - x;
    const dy = hero.y - y;
    const len = Math.hypot(dx, dy);
    const step = Math.min(len, (m.speed * dtMs) / 1000);
    if (len > 0) {
      x += (dx / len) * step;
      y += (dy / len) * step;
    }
    x = Math.min(m.arena.x + m.arena.w, Math.max(m.arena.x, x));
    y = Math.min(m.arena.y + m.arena.h, Math.max(m.arena.y, y));
  }
  let shootInMs = b.shootInMs - dtMs;
  let phase = b.phase;
  let shots: Vec[] = [];
  if (shootInMs <= 0 && s.windUpMs !== undefined && phase === 'sit') {
    // The warning: it winds up before the attack.
    phase = 'crouch';
    shootInMs = s.windUpMs;
  } else if (shootInMs <= 0) {
    const aim = aimAt({ x, y: y - s.box.height / 2 }, hero);
    shots = s.ring
      ? ring(aim, mood.shots, mood.spreadDeg)
      : spread(aim, mood.shots, mood.spreadDeg);
    shootInMs = rng.int(mood.everyMs.min, mood.everyMs.max);
    phase = 'sit';
  }
  return {
    boss: {
      ...b,
      pos: { x, y },
      heading,
      shootInMs,
      phase,
      flashMs: Math.max(0, b.flashMs - dtMs),
    },
    shots,
    storm: false,
  };
}

type GallopMoves = Extract<BossMoves, { style: 'gallop' }>;

/** Keeps feet inside an arena. */
function within(p: Point, arena: { x: number; y: number; w: number; h: number }): Point {
  return {
    x: Math.min(arena.x + arena.w, Math.max(arena.x, p.x)),
    y: Math.min(arena.y + arena.h, Math.max(arena.y, p.y)),
  };
}

/** Which way to gallop: along the row or column Jarrett shares with it, if he is in sight. */
export function gallopWay(from: Point, hero: Point, m: GallopMoves): Vec | null {
  const dx = hero.x - from.x;
  const dy = hero.y - from.y;
  if (Math.abs(dy) <= m.inLine && dx !== 0 && Math.abs(dx) <= m.sight) {
    return { x: Math.sign(dx), y: 0 };
  }
  if (Math.abs(dx) <= m.inLine && dy !== 0 && Math.abs(dy) <= m.sight) {
    return { x: 0, y: Math.sign(dy) };
  }
  return null;
}

/**
 * A galloper: it rests after a dash; dashes along its line; otherwise rears
 * when its timer runs out (standing still, `windUpMs`), then calls the storm;
 * otherwise gallops if Jarrett is level with it, or paces towards him.
 */
function stepGalloper(
  b: Boss,
  dtMs: number,
  hero: Point,
  s: BossStats,
  m: GallopMoves,
  rng: Rng,
): { boss: Boss; shots: Vec[]; storm: boolean } {
  const flashMs = Math.max(0, b.flashMs - dtMs);
  const still = { boss: { ...b, flashMs }, shots: [] as Vec[], storm: false };
  if (b.dash) {
    const step = (m.dashSpeed * Math.min(dtMs, b.dash.ms)) / 1000;
    const want = { x: b.pos.x + b.dash.dir.x * step, y: b.pos.y + b.dash.dir.y * step };
    const pos = within(want, m.arena);
    const ms = b.dash.ms - dtMs;
    // A dash ends when its time is up, or at the arena's edge; then it rests.
    const over = ms <= 0 || pos.x !== want.x || pos.y !== want.y;
    return {
      ...still,
      boss: {
        ...still.boss,
        pos,
        heading: b.dash.dir.x < 0 ? -1 : b.dash.dir.x > 0 ? 1 : b.heading,
        dash: over ? null : { ...b.dash, ms },
        restMs: over ? m.restMs : 0,
      },
    };
  }
  if (b.restMs > 0)
    return { ...still, boss: { ...still.boss, restMs: Math.max(0, b.restMs - dtMs) } };
  const mood = isFierce(b, s) ? s.fierce : s.calm;
  const shootInMs = b.shootInMs - dtMs;
  if (b.phase === 'crouch') {
    // Rearing: when it is done, the storm.
    if (shootInMs > 0) return { ...still, boss: { ...still.boss, shootInMs } };
    const next = rng.int(mood.everyMs.min, mood.everyMs.max);
    return { ...still, boss: { ...still.boss, phase: 'sit', shootInMs: next }, storm: true };
  }
  if (shootInMs <= 0) {
    return { ...still, boss: { ...still.boss, phase: 'crouch', shootInMs: s.windUpMs ?? 0 } };
  }
  const way = gallopWay(b.pos, hero, m);
  if (way) {
    return { ...still, boss: { ...still.boss, shootInMs, dash: { dir: way, ms: m.dashMs } } };
  }
  // Pacing towards him.
  const dx = hero.x - b.pos.x;
  const dy = hero.y - b.pos.y;
  const len = Math.hypot(dx, dy);
  const step = Math.min(len, (m.speed * dtMs) / 1000);
  const pos =
    len > 0
      ? within({ x: b.pos.x + (dx / len) * step, y: b.pos.y + (dy / len) * step }, m.arena)
      : b.pos;
  const heading = dx < 0 ? -1 : dx > 0 ? 1 : b.heading;
  return { ...still, boss: { ...still.boss, pos, heading, shootInMs } };
}

/** Whether it is galloping (a dash under way). */
export function isGalloping(b: Boss): boolean {
  return b.dash !== null;
}

type HopMoves = Extract<BossMoves, { style: 'hop' }>;

/** Where a leap lands: towards Jarrett, at most `reach` away, with its feet inside the arena. */
export function leapTarget(from: Point, hero: Point, m: HopMoves): Point {
  const dx = hero.x - from.x;
  const dy = hero.y - from.y;
  const len = Math.hypot(dx, dy);
  const k = len > m.reach ? m.reach / len : 1;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(from.x + dx * k, m.arena.x, m.arena.x + m.arena.w),
    y: clamp(from.y + dy * k, m.arena.y, m.arena.y + m.arena.h),
  };
}

/** A leaper: sit (its timer), crouch, leap; the landing throws a ring of shots, one aimed at Jarrett. */
function stepLeaper(
  b: Boss,
  dtMs: number,
  hero: Point,
  s: BossStats,
  m: HopMoves,
  rng: Rng,
): { boss: Boss; shots: Vec[] } {
  const flashMs = Math.max(0, b.flashMs - dtMs);
  if (b.leap) {
    const ms = b.leap.ms + dtMs;
    if (ms < m.leapMs) {
      const t = ms / m.leapMs;
      const { from, to } = b.leap;
      const pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      return { boss: { ...b, pos, leap: { ...b.leap, ms }, flashMs }, shots: [] };
    }
    const mood = isFierce(b, s) ? s.fierce : s.calm;
    const pos = { ...b.leap.to };
    const shots = ring(aimAt(bossShotOrigin({ ...b, pos }, s), hero), mood.shots, mood.spreadDeg);
    const shootInMs = rng.int(mood.everyMs.min, mood.everyMs.max);
    return { boss: { ...b, pos, phase: 'sit', leap: null, shootInMs, flashMs }, shots };
  }
  const left = b.shootInMs - dtMs;
  if (left > 0) return { boss: { ...b, shootInMs: left, flashMs }, shots: [] };
  if (b.phase === 'sit') {
    return { boss: { ...b, phase: 'crouch', shootInMs: m.crouchMs, flashMs }, shots: [] };
  }
  const leap = { from: { ...b.pos }, to: leapTarget(b.pos, hero, m), ms: 0 };
  return { boss: { ...b, phase: 'sit', leap, shootInMs: 0, flashMs }, shots: [] };
}

/** Whether it is in the air: no hits land on it, and it can't hurt by touch. */
export function isAirborne(b: Boss): boolean {
  return b.leap !== null;
}

/** How high above the ground it is drawn, mid-leap (a parabola peaking halfway). */
export function leapHeight(b: Boss, s: BossStats): number {
  const m = s.moves;
  if (m.style !== 'hop' || !b.leap) return 0;
  const t = b.leap.ms / m.leapMs;
  return 4 * m.peak * t * (1 - t);
}

/**
 * Whether a blow glances off it: wrapped tight and not stunned (the Mummy), or a
 * thick hide and not the Axe (the Ogre). `weapon` is the near weapon swung, or
 * null for a shot.
 */
export function glancesOff(b: Boss, s: BossStats, weapon: ItemId | null): boolean {
  if (s.wrapped !== undefined && b.stunMs <= 0) return true;
  return s.hide === 'axe' && weapon !== 'axe';
}

/** A Lightning bolt (by id, so each lands once) stuns a wrapped boss; others shrug it off. */
export function stunBoss(b: Boss, hitId: number, s: BossStats): Boss {
  if (!s.wrapped || b.lastHitBy === hitId) return b;
  return { ...b, stunMs: s.wrapped.stunMs, lastHitBy: hitId };
}

/**
 * A hit by id (each lands once): costs health and makes it flash. Nothing lands
 * in the air, nor what glances off (`glancesOff`; `weapon` as there).
 */
export function hitBoss(
  b: Boss,
  damage: number,
  hitId: number,
  flashMs: number,
  s: BossStats,
  weapon: ItemId | null = null,
): Boss {
  if (b.lastHitBy === hitId || b.health <= 0 || isAirborne(b) || glancesOff(b, s, weapon)) {
    return b;
  }
  return { ...b, health: Math.max(0, b.health - damage), lastHitBy: hitId, flashMs };
}

export function isBeaten(b: Boss): boolean {
  return b.health <= 0;
}

/** Its body: a box above its feet. */
export function bossBody(b: Boss, s: BossStats): { x: number; y: number; w: number; h: number } {
  return {
    x: b.pos.x - s.box.halfWidth,
    y: b.pos.y - s.box.height,
    w: s.box.halfWidth * 2,
    h: s.box.height,
  };
}

/** Where its shots start: the middle of its body. */
export function bossShotOrigin(b: Boss, s: BossStats): Point {
  return { x: b.pos.x, y: b.pos.y - s.box.height / 2 };
}
