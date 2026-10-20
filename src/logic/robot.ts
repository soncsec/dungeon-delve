/**
 * The robot, M1's enemy (engine-free, unit tested). It wanders: walks one way
 * for a random while, then picks a new way, and turns early when blocked. A
 * sword hit costs it health and knocks it back; at zero it is defeated.
 */
import type { Facing } from './hero';
import { moveHero, type Box } from './hero';
import type { Point } from './movement';
import type { Rng } from './rng';
import { facingVector, type Rect } from './sword';

export interface RobotTuning {
  speed: number;
  health: number;
  box: Box;
  turnMs: { min: number; max: number };
  knockback: { speed: number; ms: number };
}

export interface Robot {
  pos: Point;
  facing: Facing;
  health: number;
  /** Time left walking this way before choosing again, in ms. */
  turnInMs: number;
  /** Time left being knocked back, in ms (0 when not). */
  knockMs: number;
  knockDir: Facing;
  /** The swing that last hit it, so one swing hits only once. */
  lastHitBySwing: number | null;
}

const FACINGS: readonly Facing[] = ['down', 'up', 'left', 'right'];

export function spawnRobot(pos: Point, t: RobotTuning, rng: Rng): Robot {
  return {
    pos: { ...pos },
    facing: rng.pick(FACINGS),
    health: t.health,
    turnInMs: rng.int(t.turnMs.min, t.turnMs.max),
    knockMs: 0,
    knockDir: 'down',
    lastHitBySwing: null,
  };
}

/** Advances a robot by `dtMs`: knockback first, otherwise wandering. */
export function stepRobot(
  r: Robot,
  dtMs: number,
  t: RobotTuning,
  rng: Rng,
  solidAt: (cx: number, cy: number) => boolean,
): Robot {
  if (r.knockMs > 0) {
    const ms = Math.min(dtMs, r.knockMs);
    const pos = moveHero(
      r.pos,
      facingVector(r.knockDir),
      (t.knockback.speed * ms) / 1000,
      t.box,
      solidAt,
    );
    return { ...r, pos, knockMs: r.knockMs - ms };
  }
  let { facing, turnInMs } = r;
  turnInMs -= dtMs;
  if (turnInMs <= 0) {
    facing = rng.pick(FACINGS);
    turnInMs = rng.int(t.turnMs.min, t.turnMs.max);
  }
  const want = (t.speed * dtMs) / 1000;
  const pos = moveHero(r.pos, facingVector(facing), want, t.box, solidAt);
  const moved = Math.hypot(pos.x - r.pos.x, pos.y - r.pos.y);
  if (want > 0 && moved < want / 2) {
    // Blocked: turn to a different way next step.
    facing = rng.pick(FACINGS.filter((f) => f !== facing));
    turnInMs = rng.int(t.turnMs.min, t.turnMs.max);
  }
  return { ...r, pos, facing, turnInMs };
}

/** The robot's body, for hits and touching: its collision box. */
export function robotBody(r: Robot, t: RobotTuning): Rect {
  return {
    x: r.pos.x - t.box.halfWidth,
    y: r.pos.y - t.box.height,
    w: t.box.halfWidth * 2,
    h: t.box.height,
  };
}

/**
 * A sword hit from a swing (numbered, so each swing hits once), pushing the
 * robot the way the hero faces. Returns the robot unchanged if this swing has
 * already hit it.
 */
export function hitRobot(
  r: Robot,
  damage: number,
  swing: number,
  from: Facing,
  t: RobotTuning,
): Robot {
  if (r.lastHitBySwing === swing) return r;
  return {
    ...r,
    health: Math.max(0, r.health - damage),
    knockMs: t.knockback.ms,
    knockDir: from,
    lastHitBySwing: swing,
  };
}

export function isDefeated(r: Robot): boolean {
  return r.health <= 0;
}
