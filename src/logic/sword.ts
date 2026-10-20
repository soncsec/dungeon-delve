/**
 * The sword (engine-free, unit tested): where a swing reaches, overlap tests,
 * knockback, and swing timing.
 */
import type { Facing } from './hero';
import type { Point } from './movement';

/** An axis-aligned rectangle in room pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far the blade reaches and how wide it sweeps, from the hero's feet. */
export interface SwordReach {
  /** Distance the blade reaches past the hero's body. */
  reach: number;
  /** Width of the sweep across the facing direction. */
  sweep: number;
  /** Height of the hero's body above the feet; the swing comes from its middle. */
  bodyHeight: number;
  /** Half the body's width. */
  bodyHalfWidth: number;
}

/** The area a swing hits, in front of the hero. */
export function swordBox(feet: Point, facing: Facing, r: SwordReach): Rect {
  const midY = feet.y - r.bodyHeight / 2;
  switch (facing) {
    case 'right':
      return { x: feet.x + r.bodyHalfWidth, y: midY - r.sweep / 2, w: r.reach, h: r.sweep };
    case 'left':
      return {
        x: feet.x - r.bodyHalfWidth - r.reach,
        y: midY - r.sweep / 2,
        w: r.reach,
        h: r.sweep,
      };
    case 'up':
      return {
        x: feet.x - r.sweep / 2,
        y: feet.y - r.bodyHeight - r.reach,
        w: r.sweep,
        h: r.reach,
      };
    case 'down':
      return { x: feet.x - r.sweep / 2, y: feet.y, w: r.sweep, h: r.reach };
  }
}

/** Whether two rectangles overlap (touching edges don't count). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The middle of a rectangle. */
export function centre(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Unit direction for a facing, e.g. 'left' → (-1, 0). */
export function facingVector(f: Facing): { x: -1 | 0 | 1; y: -1 | 0 | 1 } {
  switch (f) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
  }
}

/** Swing timing: a swing lasts `durationMs`; a new one can start once it ends. */
export interface Swing {
  /** Time the current swing started (ms), or null when not swinging. */
  startedAt: number | null;
}

export function startSwing(s: Swing, now: number, durationMs: number): Swing {
  if (isSwinging(s, now, durationMs)) return s;
  return { startedAt: now };
}

export function isSwinging(s: Swing, now: number, durationMs: number): boolean {
  return s.startedAt !== null && now - s.startedAt < durationMs;
}
