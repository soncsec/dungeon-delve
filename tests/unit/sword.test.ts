import { describe, expect, it } from 'vitest';
import {
  centre,
  facingVector,
  isSwinging,
  overlaps,
  startSwing,
  swordBox,
  type SwordReach,
} from '../../src/logic/sword';

const reach: SwordReach = { reach: 16, sweep: 20, bodyHeight: 20, bodyHalfWidth: 4 };
const feet = { x: 100, y: 100 };

describe('swordBox', () => {
  it('reaches out in front, level with the middle of the body', () => {
    expect(swordBox(feet, 'right', reach)).toEqual({ x: 104, y: 80, w: 16, h: 20 });
    expect(swordBox(feet, 'left', reach)).toEqual({ x: 80, y: 80, w: 16, h: 20 });
  });

  it('reaches above the head and below the feet', () => {
    expect(swordBox(feet, 'up', reach)).toEqual({ x: 90, y: 64, w: 20, h: 16 });
    expect(swordBox(feet, 'down', reach)).toEqual({ x: 90, y: 100, w: 20, h: 16 });
  });
});

describe('overlaps', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  it('detects overlap', () => {
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: -5, y: -5, w: 30, h: 30 })).toBe(true);
  });
  it('ignores rectangles that only touch or are apart', () => {
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 0, y: 10, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: -5, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 0, y: -5, w: 5, h: 5 })).toBe(false);
  });
});

describe('helpers', () => {
  it('centre is the middle', () => {
    expect(centre({ x: 10, y: 20, w: 4, h: 6 })).toEqual({ x: 12, y: 23 });
  });
  it('facingVector points the way faced', () => {
    expect(facingVector('left')).toEqual({ x: -1, y: 0 });
    expect(facingVector('right')).toEqual({ x: 1, y: 0 });
    expect(facingVector('up')).toEqual({ x: 0, y: -1 });
    expect(facingVector('down')).toEqual({ x: 0, y: 1 });
  });
});

describe('swing timing', () => {
  it('swings for the duration, then can swing again', () => {
    let s = startSwing({ startedAt: null }, 1000, 250);
    expect(s).toEqual({ startedAt: 1000 });
    expect(isSwinging(s, 1249, 250)).toBe(true);
    // Pressing again mid-swing doesn't restart it.
    expect(startSwing(s, 1100, 250)).toBe(s);
    expect(isSwinging(s, 1250, 250)).toBe(false);
    s = startSwing(s, 1300, 250);
    expect(s.startedAt).toBe(1300);
  });
  it('is not swinging before any swing', () => {
    expect(isSwinging({ startedAt: null }, 0, 250)).toBe(false);
  });
});
