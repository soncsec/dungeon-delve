/**
 * Enemy shots (engine-free, unit tested): small orbs that fly straight in any
 * direction until they hit a wall, Jarrett, or the end of their range. A flier
 * may fire from above a wall or tree: its shot flies out of it, and is only
 * stopped once it has been in the open and then meets something solid.
 */
import { TILE } from '../config/tuning';
import type { Point } from './movement';
import type { Rect } from './sword';
import type { Vec } from './enemies';

export interface EnemyShot {
  pos: Point;
  /** Unit direction. */
  dir: Vec;
  travelled: number;
  /** Has been over open ground since it was fired (until then, walls don't stop it). */
  clear: boolean;
}

export interface ShotTuning {
  speed: number;
  range: number;
  /** Width and height of its hit box. */
  size: number;
}

export function fireShot(from: Point, dir: Vec): EnemyShot {
  return { pos: { ...from }, dir: { ...dir }, travelled: 0, clear: false };
}

/** Flies a shot for `dtMs`; `stopped` when it meets a solid cell (once clear) or its range ends. Sub-tile steps. */
export function stepShot(
  s: EnemyShot,
  dtMs: number,
  t: ShotTuning,
  solidAt: (cx: number, cy: number) => boolean,
): { shot: EnemyShot; stopped: boolean } {
  const solid = (p: Point): boolean => solidAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  const want = Math.min((t.speed * dtMs) / 1000, t.range - s.travelled);
  const steps = Math.max(1, Math.ceil(want / (TILE / 4)));
  let pos = s.pos;
  let clear = s.clear || !solid(s.pos);
  for (let i = 1; i <= steps; i++) {
    const next = {
      x: s.pos.x + (s.dir.x * want * i) / steps,
      y: s.pos.y + (s.dir.y * want * i) / steps,
    };
    if (!solid(next)) {
      clear = true;
    } else if (clear) {
      const flown = Math.hypot(pos.x - s.pos.x, pos.y - s.pos.y);
      return { shot: { ...s, pos, travelled: s.travelled + flown, clear }, stopped: true };
    }
    pos = next;
  }
  const travelled = s.travelled + want;
  return { shot: { ...s, pos, travelled, clear }, stopped: travelled >= t.range };
}

export function shotBox(s: EnemyShot, t: ShotTuning): Rect {
  return { x: s.pos.x - t.size / 2, y: s.pos.y - t.size / 2, w: t.size, h: t.size };
}
