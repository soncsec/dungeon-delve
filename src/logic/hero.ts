/**
 * Hero movement (engine-free, unit tested): facing, and moving a small box at
 * the hero's feet through a room without entering solid cells.
 */
import { TILE } from '../config/tuning';
import type { Axis, Point } from './movement';

export type Facing = 'down' | 'up' | 'left' | 'right';

/** Half the size of the hero's collision box, which sits at the feet. */
export interface Box {
  halfWidth: number;
  height: number;
}

/**
 * Which way to face for the input. Keeps the current facing when there is no
 * input, or when moving diagonally along the axis already faced.
 */
export function facingFor(axis: Axis, current: Facing): Facing {
  if (axis.x === 0 && axis.y === 0) return current;
  const horizontal: Facing = axis.x < 0 ? 'left' : 'right';
  const vertical: Facing = axis.y < 0 ? 'up' : 'down';
  if (axis.y === 0) return horizontal;
  if (axis.x === 0) return vertical;
  return current === horizontal || current === vertical ? current : vertical;
}

/** Whether a box with its bottom-centre at `p` overlaps any solid cell. */
export function boxHitsSolid(
  p: Point,
  box: Box,
  solidAt: (cellX: number, cellY: number) => boolean,
): boolean {
  // A hair inside the box's right and bottom edges, so standing flush against a cell isn't touching it.
  const EPS = 1e-6;
  const x0 = Math.floor((p.x - box.halfWidth) / TILE);
  const x1 = Math.floor((p.x + box.halfWidth - EPS) / TILE);
  const y0 = Math.floor((p.y - box.height) / TILE);
  const y1 = Math.floor((p.y - EPS) / TILE);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) if (solidAt(cx, cy)) return true;
  return false;
}

/**
 * Moves the hero `dist` pixels along `axis` (normalised, so diagonals are no
 * faster), one axis at a time so it slides along walls. Each axis stops flush
 * against the first solid cell in the way.
 */
export function moveHero(
  p: Point,
  axis: Axis,
  dist: number,
  box: Box,
  solidAt: (cellX: number, cellY: number) => boolean,
): Point {
  if (dist < 0) throw new RangeError('distance must not be negative');
  const len = Math.hypot(axis.x, axis.y) || 1;
  let pos = { ...p };
  pos = slide(pos, 'x', (axis.x / len) * dist, box, solidAt);
  pos = slide(pos, 'y', (axis.y / len) * dist, box, solidAt);
  return pos;
}

function slide(
  p: Point,
  along: 'x' | 'y',
  delta: number,
  box: Box,
  solidAt: (cellX: number, cellY: number) => boolean,
): Point {
  if (delta === 0) return p;
  // Move in steps smaller than a tile, so the box can't jump over a cell.
  const steps = Math.ceil(Math.abs(delta) / (TILE / 2));
  let pos = p;
  for (let i = 1; i <= steps; i++) {
    // Measured from the start each time, so rounding errors don't add up.
    const next = { ...pos, [along]: p[along] + (delta * i) / steps };
    if (!boxHitsSolid(next, box, solidAt)) {
      pos = next;
      continue;
    }
    return { ...pos, [along]: flush(pos, along, Math.sign(delta), box) };
  }
  return pos;
}

/** The furthest position along one axis, moving in direction `sign`, before the box enters the next cell. */
function flush(p: Point, along: 'x' | 'y', sign: number, box: Box): number {
  if (along === 'x') {
    const edge = sign > 0 ? p.x + box.halfWidth : p.x - box.halfWidth;
    const cell = sign > 0 ? Math.ceil(edge / TILE) : Math.floor(edge / TILE);
    return sign > 0 ? cell * TILE - box.halfWidth : cell * TILE + box.halfWidth;
  }
  const edge = sign > 0 ? p.y : p.y - box.height;
  const cell = sign > 0 ? Math.ceil(edge / TILE) : Math.floor(edge / TILE);
  return sign > 0 ? cell * TILE : cell * TILE + box.height;
}
