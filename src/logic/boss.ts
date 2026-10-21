/**
 * Bosses (engine-free, unit tested). A boss stands its ground in its room,
 * shuffling from side to side, and fires spreads of shots at Jarrett. Below
 * half health it turns fiercer: wider spreads, more often. A hit (by id, so
 * each lands once) costs it health; at zero it is beaten.
 */
import type { Point } from './movement';
import type { Rng } from './rng';
import type { Vec } from './enemies';

export type BossKind = 'treant';

export interface BossStats {
  health: number;
  /** Half hearts it takes from Jarrett on touch. */
  contactDamage: number;
  /** Its body (for hits and touching), around its feet. */
  box: { halfWidth: number; height: number };
  /** Shuffling side to side: speed, and how far either side of where it starts. */
  shuffle: { speed: number; range: number };
  /** Calm, then fierce (at or below half health): shots per spread, the angle between them, and time between spreads. */
  calm: { shots: number; spreadDeg: number; everyMs: { min: number; max: number } };
  fierce: { shots: number; spreadDeg: number; everyMs: { min: number; max: number } };
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

/** Advances a boss by `dtMs`: shuffles, and fires a spread at `hero` when its timer runs out. */
export function stepBoss(
  b: Boss,
  dtMs: number,
  hero: Point,
  s: BossStats,
  rng: Rng,
): { boss: Boss; shots: Vec[] } {
  const mood = isFierce(b, s) ? s.fierce : s.calm;
  let x = b.pos.x + (b.heading * s.shuffle.speed * dtMs) / 1000;
  let heading = b.heading;
  if (x > b.home.x + s.shuffle.range) {
    x = b.home.x + s.shuffle.range;
    heading = -1;
  } else if (x < b.home.x - s.shuffle.range) {
    x = b.home.x - s.shuffle.range;
    heading = 1;
  }
  let shootInMs = b.shootInMs - dtMs;
  let shots: Vec[] = [];
  if (shootInMs <= 0) {
    const from = { x, y: b.pos.y - s.box.height / 2 };
    const dx = hero.x - from.x;
    const dy = hero.y - from.y;
    const len = Math.hypot(dx, dy);
    const aim = len === 0 ? { x: 0, y: 1 } : { x: dx / len, y: dy / len };
    shots = spread(aim, mood.shots, mood.spreadDeg);
    shootInMs = rng.int(mood.everyMs.min, mood.everyMs.max);
  }
  return {
    boss: {
      ...b,
      pos: { x, y: b.pos.y },
      heading,
      shootInMs,
      flashMs: Math.max(0, b.flashMs - dtMs),
    },
    shots,
  };
}

/** A hit by id (each lands once): costs health and makes it flash. */
export function hitBoss(b: Boss, damage: number, hitId: number, flashMs: number): Boss {
  if (b.lastHitBy === hitId || b.health <= 0) return b;
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
