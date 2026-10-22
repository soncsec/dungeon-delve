/**
 * The Centaur's storm (Thunder Spire's boss, owner 2026-10-22): it rears and
 * calls down lightning. Dark marks appear on patches of floor (2×2 cells), one
 * under Jarrett, and a moment later a bolt strikes each. Below half health the
 * storm covers the whole arena but for one safe patch; the Ward, or that gap,
 * saves him. Engine-free and unit tested.
 */
import { TILE } from '../config/tuning';
import type { Rng } from './rng';

/** A patch of floor a bolt strikes: its top-left cell (room cells); it is 2 cells each way. */
export interface Patch {
  x: number;
  y: number;
}

/** The floor the storm can strike, in cells: its top-left cell, and its size in patches. */
export interface StormArena {
  x: number;
  y: number;
  /** Patches across and down (each 2×2 cells). */
  across: number;
  down: number;
}

/** A bolt on its way: the patch, and the time left until it strikes (ms). */
export interface Strike {
  patch: Patch;
  inMs: number;
}

/** Every patch of the arena, row by row. */
export function patchesOf(a: StormArena): Patch[] {
  return Array.from({ length: a.across * a.down }, (_, i) => ({
    x: a.x + 2 * (i % a.across),
    y: a.y + 2 * Math.floor(i / a.across),
  }));
}

/** The patch under a point (room pixels), kept inside the arena. */
export function patchUnder(a: StormArena, p: { x: number; y: number }): Patch {
  const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  const col = clamp(Math.floor((Math.floor(p.x / TILE) - a.x) / 2), a.across);
  const row = clamp(Math.floor((Math.floor((p.y - 1) / TILE) - a.y) / 2), a.down);
  return { x: a.x + 2 * col, y: a.y + 2 * row };
}

const same = (p: Patch, q: Patch) => p.x === q.x && p.y === q.y;

/**
 * Where the bolts fall. Calm: the patch under Jarrett, and `others` more picked
 * at random. Fierce: every patch but one, picked at random (never his own, so
 * he has to move to it, or ward).
 */
export function stormPatches(
  a: StormArena,
  hero: { x: number; y: number },
  fierce: boolean,
  others: number,
  rng: Rng,
): Patch[] {
  const all = patchesOf(a);
  const his = patchUnder(a, hero);
  const rest = all.filter((p) => !same(p, his));
  if (fierce) {
    const safe = rest[rng.int(0, rest.length - 1)] as Patch;
    return all.filter((p) => !same(p, safe));
  }
  const picked: Patch[] = [his];
  const pool = [...rest];
  for (let i = 0; i < others && pool.length > 0; i++) {
    picked.push(pool.splice(rng.int(0, pool.length - 1), 1)[0] as Patch);
  }
  return picked;
}

/** The marks go down: each bolt strikes after `delayMs`. */
export function markStrikes(patches: readonly Patch[], delayMs: number): Strike[] {
  return patches.map((patch) => ({ patch: { ...patch }, inMs: delayMs }));
}

/** Counts the bolts down: those whose time is up strike now (`landed`); the rest wait. */
export function stepStrikes(
  strikes: readonly Strike[],
  dtMs: number,
): { pending: Strike[]; landed: Patch[] } {
  const pending: Strike[] = [];
  const landed: Patch[] = [];
  for (const s of strikes) {
    const inMs = s.inMs - dtMs;
    if (inMs <= 0) landed.push(s.patch);
    else pending.push({ ...s, inMs });
  }
  return { pending, landed };
}

/** Whether a bolt on `patch` catches a body box (room pixels). */
export function strikeHits(
  patch: Patch,
  body: { x: number; y: number; w: number; h: number },
): boolean {
  const px = patch.x * TILE;
  const py = patch.y * TILE;
  const size = 2 * TILE;
  return body.x < px + size && body.x + body.w > px && body.y < py + size && body.y + body.h > py;
}
