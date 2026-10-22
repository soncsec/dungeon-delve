/**
 * Enemies (engine-free, unit tested). Each kind has its own way of moving:
 *
 * - wander:  walk one way for a while, then another; turn when blocked (robot)
 * - flutter: like wander but in eight directions, turning often, and flying (bird)
 * - drift:   float slowly straight at Jarrett, through walls (ghost)
 * - hover:   keep a middle distance from Jarrett, circling, and shoot at him (flying eye)
 * - charge:  wander, but rush at Jarrett when he is in line, then rest (wolf)
 *
 * Fliers ignore walls and trees but stay in their room. A sword or projectile
 * hit costs health and knocks the enemy back; at zero it is defeated.
 */
import { moveHero, type Box, type Facing } from './hero';
import type { Point } from './movement';
import type { Rng } from './rng';
import { facingVector, type Rect } from './sword';

export type EnemyKind = 'robot' | 'bird' | 'ghost' | 'eye' | 'wolf' | 'snake' | 'mushroom' | 'toad';
export type Behaviour =
  'wander' | 'flutter' | 'drift' | 'hover' | 'charge' | 'spit' | 'puff' | 'leap';

/** What an enemy shoots: the eye's orb, the snake's venom, the mushroom's spores. */
export type ShotKind = 'orb' | 'venom' | 'spore' | 'fire' | 'dark';

export interface EnemyStats {
  behaviour: Behaviour;
  health: number;
  /** Half hearts it takes from Jarrett on touch. */
  contactDamage: number;
  speed: number;
  /** Collision box at its feet. */
  box: Box;
  /** Flies over walls and trees (but not out of its room). */
  flies: boolean;
  /** Time walking one way before choosing again (ms). */
  turnMs: { min: number; max: number };
  knockback: { speed: number; ms: number };
  /** Hover: the distances it keeps from Jarrett. */
  keep?: { near: number; far: number };
  /** Shooting: time between shots (ms). */
  shootMs?: { min: number; max: number };
  /** Charge: how fast and long, how far it sees, how close in line counts, and the rest after. */
  charge?: { speed: number; ms: number; sight: number; inLine: number; restMs: number };
  /** Spit (the snake): how far it sees, how close in line counts, and how long it coils after. */
  spit?: { sight: number; inLine: number; restMs: number };
  /** Puff (the mushroom): how many spores fly out, evenly round, every `shootMs`. */
  puff?: { shots: number };
  /** Leap (the toad): a hop at Jarrett, how fast and long, and the sit between hops. */
  leap?: { speed: number; ms: number; restMs: { min: number; max: number } };
  /** What it shoots (default: the eye's orb). */
  shotKind?: ShotKind;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Enemy {
  kind: EnemyKind;
  pos: Point;
  /** The way it is moving (unit length, or zero). */
  dir: Vec;
  /** For drawing: the way it faces. */
  facing: Facing;
  health: number;
  turnInMs: number;
  knockMs: number;
  knockDir: Facing;
  /** The hit that last struck it (a swing or projectile id), so one hit counts once. */
  lastHitBy: number | null;
  /** Charge: time left charging, and resting after. */
  chargeMs: number;
  restMs: number;
  /** Hover: which way it circles (1 or -1). */
  circle: 1 | -1;
  /** Time until its next shot (ms). */
  shootInMs: number;
  /** Time left stunned by Lightning (ms): it stands still, and can't hurt by touch. */
  stunMs: number;
}

export interface StepContext {
  /** Jarrett's feet. */
  hero: Point;
  rng: Rng;
  /** Solid for walkers: walls, trees and outside the room. */
  walkSolid: (cx: number, cy: number) => boolean;
  /** Solid for fliers: only outside the room. */
  flySolid: (cx: number, cy: number) => boolean;
}

export interface StepResult {
  enemy: Enemy;
  /** What it shoots this step: where each shot starts and its direction (unit length). */
  shots: { from: Point; dir: Vec }[];
}

const FOUR: readonly Vec[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];
const D = Math.SQRT1_2;
const EIGHT: readonly Vec[] = [
  ...FOUR,
  { x: D, y: D },
  { x: D, y: -D },
  { x: -D, y: D },
  { x: -D, y: -D },
];

/** The way something moving along `v` faces: its stronger axis (ties go sideways). Zero keeps `current`. */
export function facingOf(v: Vec, current: Facing): Facing {
  if (v.x === 0 && v.y === 0) return current;
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x < 0 ? 'left' : 'right';
  return v.y < 0 ? 'up' : 'down';
}

/** Unit vector from `a` to `b` (zero if they're in the same place). */
export function towards(a: Point, b: Point): Vec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

export function spawnEnemy(kind: EnemyKind, pos: Point, s: EnemyStats, rng: Rng): Enemy {
  const dir = rng.pick(s.behaviour === 'flutter' ? EIGHT : FOUR);
  return {
    kind,
    pos: { ...pos },
    dir,
    facing: facingOf(dir, 'down'),
    health: s.health,
    turnInMs: rng.int(s.turnMs.min, s.turnMs.max),
    knockMs: 0,
    knockDir: 'down',
    lastHitBy: null,
    chargeMs: 0,
    restMs: 0,
    circle: rng.pick([1, -1] as const),
    shootInMs: s.shootMs ? rng.int(s.shootMs.min, s.shootMs.max) : 0,
    stunMs: 0,
  };
}

/** Advances an enemy by `dtMs`: knockback first; stunned, it stands still; otherwise its own way of moving. */
export function stepEnemy(e: Enemy, dtMs: number, s: EnemyStats, ctx: StepContext): StepResult {
  const solid = s.flies ? ctx.flySolid : ctx.walkSolid;
  if (e.knockMs > 0) {
    const ms = Math.min(dtMs, e.knockMs);
    const pos = moveHero(
      e.pos,
      facingVector(e.knockDir),
      (s.knockback.speed * ms) / 1000,
      s.box,
      solid,
    );
    return { enemy: { ...e, pos, knockMs: e.knockMs - ms }, shots: [] };
  }
  if (e.stunMs > 0) return { enemy: { ...e, stunMs: Math.max(0, e.stunMs - dtMs) }, shots: [] };
  switch (s.behaviour) {
    case 'wander':
      return { enemy: wander(e, dtMs, s, ctx.rng, solid, FOUR), shots: [] };
    case 'flutter':
      return { enemy: wander(e, dtMs, s, ctx.rng, solid, EIGHT), shots: [] };
    case 'drift':
      return { enemy: glide(e, towards(e.pos, ctx.hero), dtMs, s.speed, s, solid), shots: [] };
    case 'hover':
      return hover(e, dtMs, s, ctx, solid);
    case 'charge':
      return { enemy: charge(e, dtMs, s, ctx, solid), shots: [] };
    case 'spit':
      return spit(e, dtMs, s, ctx, solid);
    case 'puff':
      return puff(e, dtMs, s, ctx, solid);
    case 'leap':
      return { enemy: leap(e, dtMs, s, ctx, solid), shots: [] };
  }
}

/** Moves along `dir` at `speed`, facing that way. */
function glide(
  e: Enemy,
  dir: Vec,
  dtMs: number,
  speed: number,
  s: EnemyStats,
  solid: (cx: number, cy: number) => boolean,
): Enemy {
  const pos = moveHero(e.pos, dir, (speed * dtMs) / 1000, s.box, solid);
  return { ...e, pos, dir, facing: facingOf(dir, e.facing) };
}

function wander(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  rng: Rng,
  solid: (cx: number, cy: number) => boolean,
  ways: readonly Vec[],
): Enemy {
  let { dir, turnInMs } = e;
  turnInMs -= dtMs;
  if (turnInMs <= 0) {
    dir = rng.pick(ways);
    turnInMs = rng.int(s.turnMs.min, s.turnMs.max);
  }
  const want = (s.speed * dtMs) / 1000;
  const moved = glide({ ...e, turnInMs }, dir, dtMs, s.speed, s, solid);
  const dist = Math.hypot(moved.pos.x - e.pos.x, moved.pos.y - e.pos.y);
  if (want > 0 && dist < want / 2) {
    // Blocked: a different way next step.
    return {
      ...moved,
      dir: rng.pick(ways.filter((w) => w !== dir)),
      turnInMs: rng.int(s.turnMs.min, s.turnMs.max),
    };
  }
  return moved;
}

function hover(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  ctx: StepContext,
  solid: (cx: number, cy: number) => boolean,
): StepResult {
  const keep = s.keep ?? { near: 0, far: 0 };
  const to = towards(e.pos, ctx.hero);
  const dist = Math.hypot(ctx.hero.x - e.pos.x, ctx.hero.y - e.pos.y);
  // Too close: back off. Too far: come closer. Otherwise circle round him.
  const dir =
    dist < keep.near
      ? { x: -to.x, y: -to.y }
      : dist > keep.far
        ? to
        : { x: -to.y * e.circle, y: to.x * e.circle };
  const moved = glide(e, dir, dtMs, s.speed, s, solid);
  // Face Jarrett, whichever way it drifts.
  const facing = facingOf(to, moved.facing);
  let shootInMs = e.shootInMs - dtMs;
  const shots: StepResult['shots'] = [];
  if (s.shootMs && shootInMs <= 0) {
    shots.push({ from: shotOrigin(moved, s), dir: to.x === 0 && to.y === 0 ? { x: 0, y: 1 } : to });
    shootInMs = ctx.rng.int(s.shootMs.min, s.shootMs.max);
  }
  return { enemy: { ...moved, facing, shootInMs }, shots };
}

function charge(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  ctx: StepContext,
  solid: (cx: number, cy: number) => boolean,
): Enemy {
  const c = s.charge ?? { speed: s.speed, ms: 0, sight: 0, inLine: 0, restMs: 0 };
  if (e.chargeMs > 0) {
    const ms = Math.min(dtMs, e.chargeMs);
    const want = (c.speed * ms) / 1000;
    const moved = glide(e, e.dir, ms, c.speed, s, solid);
    const dist = Math.hypot(moved.pos.x - e.pos.x, moved.pos.y - e.pos.y);
    const chargeMs = dist < want / 2 ? 0 : e.chargeMs - ms;
    return { ...moved, chargeMs, restMs: chargeMs === 0 ? c.restMs : 0 };
  }
  const restMs = Math.max(0, e.restMs - dtMs);
  if (restMs === 0) {
    const dx = ctx.hero.x - e.pos.x;
    const dy = ctx.hero.y - e.pos.y;
    const way: Vec | null =
      Math.abs(dy) <= c.inLine && Math.abs(dx) <= c.sight && dx !== 0
        ? { x: Math.sign(dx), y: 0 }
        : Math.abs(dx) <= c.inLine && Math.abs(dy) <= c.sight && dy !== 0
          ? { x: 0, y: Math.sign(dy) }
          : null;
    if (way) return { ...e, dir: way, facing: facingOf(way, e.facing), chargeMs: c.ms, restMs: 0 };
  }
  return { ...wander({ ...e, restMs }, dtMs, s, ctx.rng, solid, FOUR), restMs };
}

/** The way along a row or column to Jarrett, if he is in line (within `inLine`) and in sight. */
function inLineWith(e: Enemy, hero: Point, sight: number, inLine: number): Vec | null {
  const dx = hero.x - e.pos.x;
  const dy = hero.y - e.pos.y;
  if (Math.abs(dy) <= inLine && Math.abs(dx) <= sight && dx !== 0)
    return { x: Math.sign(dx), y: 0 };
  if (Math.abs(dx) <= inLine && Math.abs(dy) <= sight && dy !== 0)
    return { x: 0, y: Math.sign(dy) };
  return null;
}

/**
 * The snake: wanders, and when Jarrett is in line with it, stops, faces him
 * and spits venom along the line; then coils a while (standing still).
 */
function spit(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  ctx: StepContext,
  solid: (cx: number, cy: number) => boolean,
): StepResult {
  const sp = s.spit ?? { sight: 0, inLine: 0, restMs: 0 };
  if (e.restMs > 0) return { enemy: { ...e, restMs: Math.max(0, e.restMs - dtMs) }, shots: [] };
  const way = inLineWith(e, ctx.hero, sp.sight, sp.inLine);
  if (way) {
    const facing = facingOf(way, e.facing);
    const coiled = { ...e, dir: way, facing, restMs: sp.restMs };
    return { enemy: coiled, shots: [{ from: shotOrigin(coiled, s), dir: way }] };
  }
  return { enemy: wander(e, dtMs, s, ctx.rng, solid, FOUR), shots: [] };
}

/** The mushroom: plods about, and every so often puffs spores out all round it. */
function puff(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  ctx: StepContext,
  solid: (cx: number, cy: number) => boolean,
): StepResult {
  const moved = wander(e, dtMs, s, ctx.rng, solid, FOUR);
  const shootInMs = e.shootInMs - dtMs;
  if (!s.shootMs || shootInMs > 0) return { enemy: { ...moved, shootInMs }, shots: [] };
  const n = s.puff?.shots ?? 4;
  const from = shotOrigin(moved, s);
  const shots = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { from, dir: { x: Math.cos(a), y: Math.sin(a) } };
  });
  return {
    enemy: { ...moved, shootInMs: ctx.rng.int(s.shootMs.min, s.shootMs.max) },
    shots,
  };
}

/** The toad: sits, then hops at Jarrett (a quick leap that stops at walls), then sits again. */
function leap(
  e: Enemy,
  dtMs: number,
  s: EnemyStats,
  ctx: StepContext,
  solid: (cx: number, cy: number) => boolean,
): Enemy {
  const l = s.leap ?? { speed: s.speed, ms: 0, restMs: { min: 0, max: 0 } };
  if (e.chargeMs > 0) {
    const ms = Math.min(dtMs, e.chargeMs);
    const moved = glide(e, e.dir, ms, l.speed, s, solid);
    const chargeMs = e.chargeMs - ms;
    return {
      ...moved,
      chargeMs,
      restMs: chargeMs === 0 ? ctx.rng.int(l.restMs.min, l.restMs.max) : 0,
    };
  }
  const restMs = e.restMs - dtMs;
  if (restMs > 0) return { ...e, restMs };
  const dir = towards(e.pos, ctx.hero);
  if (dir.x === 0 && dir.y === 0) return { ...e, restMs: 0 };
  return { ...e, dir, facing: facingOf(dir, e.facing), chargeMs: l.ms, restMs: 0 };
}

/** Where its shots start: the middle of its body. */
export function shotOrigin(e: Enemy, s: EnemyStats): Point {
  return { x: e.pos.x, y: e.pos.y - s.box.height / 2 };
}

/** Its body, for hits and touching: its collision box. */
export function enemyBody(e: Enemy, s: EnemyStats): Rect {
  return {
    x: e.pos.x - s.box.halfWidth,
    y: e.pos.y - s.box.height,
    w: s.box.halfWidth * 2,
    h: s.box.height,
  };
}

/**
 * A hit (a sword swing or a projectile, by id, so each lands once), pushing
 * the enemy the way it came from. A hit stops a charge.
 */
export function hitEnemy(
  e: Enemy,
  damage: number,
  hitId: number,
  from: Facing,
  s: EnemyStats,
): Enemy {
  if (e.lastHitBy === hitId) return e;
  return {
    ...e,
    health: Math.max(0, e.health - damage),
    knockMs: s.knockback.ms,
    knockDir: from,
    lastHitBy: hitId,
    chargeMs: 0,
  };
}

/** A Lightning bolt (by id, so each lands once): stunned for `ms`, and any charge stops. */
export function stunEnemy(e: Enemy, ms: number, hitId: number): Enemy {
  if (e.lastHitBy === hitId) return e;
  return { ...e, stunMs: ms, lastHitBy: hitId, chargeMs: 0 };
}

export function isStunned(e: Enemy): boolean {
  return e.stunMs > 0;
}

export function isDefeated(e: Enemy): boolean {
  return e.health <= 0;
}
