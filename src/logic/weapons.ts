/**
 * Near and far weapons, and things that fly (engine-free, unit tested).
 * Jarrett has one weapon of each kind ready; a key switches which one the
 * attack key uses. Projectiles (thrown daggers, fireballs) fly straight until
 * they hit a wall, an enemy, or their range runs out.
 */
import { TILE } from '../config/tuning';
import type { Facing } from './hero';
import type { Point } from './movement';
import { facingVector, type Rect } from './sword';

export type WeaponMode = 'near' | 'far';

export function otherMode(m: WeaponMode): WeaponMode {
  return m === 'near' ? 'far' : 'near';
}

export interface Projectile {
  /** Unique per launch, so one projectile hits an enemy only once. */
  id: number;
  /** Its middle, in room pixels. */
  pos: Point;
  dir: Facing;
  /** Distance flown so far. */
  travelled: number;
}

export interface ProjectileTuning {
  speed: number;
  range: number;
  /** Length along its flight, and thickness across it. */
  length: number;
  thickness: number;
}

/** A new projectile leaving Jarrett's hand: level with the middle of his body, just in front of him. */
export function launch(id: number, feet: Point, facing: Facing, bodyHeight: number): Projectile {
  const v = facingVector(facing);
  const start = { x: feet.x + v.x * 8, y: feet.y - bodyHeight / 2 + v.y * 8 };
  return { id, pos: start, dir: facing, travelled: 0 };
}

/**
 * Flies a projectile for `dtMs`. It stops (`stopped: true`) when its middle enters
 * a solid cell or it has flown its full range. Moves in sub-tile steps so it
 * can't skip over a thin wall.
 */
export function stepProjectile(
  d: Projectile,
  dtMs: number,
  t: ProjectileTuning,
  solidAt: (cx: number, cy: number) => boolean,
): { projectile: Projectile; stopped: boolean } {
  const v = facingVector(d.dir);
  const want = Math.min((t.speed * dtMs) / 1000, t.range - d.travelled);
  const steps = Math.max(1, Math.ceil(want / (TILE / 4)));
  let pos = d.pos;
  for (let i = 1; i <= steps; i++) {
    const next = { x: d.pos.x + (v.x * want * i) / steps, y: d.pos.y + (v.y * want * i) / steps };
    if (solidAt(Math.floor(next.x / TILE), Math.floor(next.y / TILE))) {
      return {
        projectile: {
          ...d,
          pos,
          travelled: d.travelled + Math.hypot(pos.x - d.pos.x, pos.y - d.pos.y),
        },
        stopped: true,
      };
    }
    pos = next;
  }
  const travelled = d.travelled + want;
  return { projectile: { ...d, pos, travelled }, stopped: travelled >= t.range };
}

/** A projectile's hit box: long along its flight, thin across it. */
export function projectileBox(d: Projectile, t: ProjectileTuning): Rect {
  const sideways = d.dir === 'left' || d.dir === 'right';
  const w = sideways ? t.length : t.thickness;
  const h = sideways ? t.thickness : t.length;
  return { x: d.pos.x - w / 2, y: d.pos.y - h / 2, w, h };
}

/** Whether another projectile may be launched now (at most `maxInFlight`, `cooldownMs` apart). */
export function canThrow(
  inFlight: number,
  maxInFlight: number,
  lastThrowAt: number | null,
  now: number,
  cooldownMs: number,
): boolean {
  if (inFlight >= maxInFlight) return false;
  return lastThrowAt === null || now - lastThrowAt >= cooldownMs;
}
