import { describe, expect, it } from 'vitest';
import { boxHitsSolid, facingFor, moveHero, type Box } from '../../src/logic/hero';

const box: Box = { halfWidth: 5, height: 6 };
/** Solid cells given as "x,y" strings. */
const solids =
  (...cells: string[]) =>
  (x: number, y: number): boolean =>
    cells.includes(`${x},${y}`);
const none = solids();

describe('facingFor', () => {
  it('faces the way of straight input', () => {
    expect(facingFor({ x: -1, y: 0 }, 'down')).toBe('left');
    expect(facingFor({ x: 1, y: 0 }, 'down')).toBe('right');
    expect(facingFor({ x: 0, y: -1 }, 'down')).toBe('up');
    expect(facingFor({ x: 0, y: 1 }, 'up')).toBe('down');
  });

  it('keeps facing with no input', () => {
    expect(facingFor({ x: 0, y: 0 }, 'left')).toBe('left');
  });

  it('keeps facing on a diagonal that includes it, otherwise faces up or down', () => {
    expect(facingFor({ x: 1, y: -1 }, 'right')).toBe('right');
    expect(facingFor({ x: 1, y: -1 }, 'up')).toBe('up');
    expect(facingFor({ x: 1, y: -1 }, 'left')).toBe('up');
    expect(facingFor({ x: -1, y: 1 }, 'right')).toBe('down');
  });
});

describe('boxHitsSolid', () => {
  it('finds solid cells under the box, but not ones it is flush against', () => {
    // Box at feet (40, 48): spans x 35–45, y 42–48, all in cells (2, 2).
    expect(boxHitsSolid({ x: 40, y: 48 }, box, solids('2,2'))).toBe(true);
    expect(boxHitsSolid({ x: 40, y: 48 }, box, solids('2,3', '3,2', '1,2'))).toBe(false);
  });
});

describe('moveHero', () => {
  it('moves freely in open ground, no faster diagonally', () => {
    expect(moveHero({ x: 100, y: 100 }, { x: 1, y: 0 }, 20, box, none)).toEqual({ x: 120, y: 100 });
    const d = moveHero({ x: 100, y: 100 }, { x: 1, y: 1 }, 20, box, none);
    expect(Math.hypot(d.x - 100, d.y - 100)).toBeCloseTo(20);
  });

  it('does not move without input or distance', () => {
    expect(moveHero({ x: 100, y: 100 }, { x: 0, y: 0 }, 20, box, none)).toEqual({ x: 100, y: 100 });
    expect(moveHero({ x: 100, y: 100 }, { x: 1, y: 0 }, 0, box, none)).toEqual({ x: 100, y: 100 });
  });

  it('rejects a negative distance', () => {
    expect(() => moveHero({ x: 0, y: 0 }, { x: 1, y: 0 }, -1, box, none)).toThrow(RangeError);
  });

  it('stops flush against a wall in each direction', () => {
    // Start in cell (5, 5): feet at (88, 90).
    const start = { x: 88, y: 90 };
    expect(moveHero(start, { x: 1, y: 0 }, 50, box, solids('7,5'))).toEqual({ x: 107, y: 90 });
    expect(moveHero(start, { x: -1, y: 0 }, 50, box, solids('3,5'))).toEqual({ x: 69, y: 90 });
    expect(moveHero(start, { x: 0, y: 1 }, 50, box, solids('5,7'))).toEqual({ x: 88, y: 112 });
    expect(moveHero(start, { x: 0, y: -1 }, 50, box, solids('5,3'))).toEqual({ x: 88, y: 70 });
  });

  it('stays put when already flush against the wall', () => {
    expect(moveHero({ x: 107, y: 90 }, { x: 1, y: 0 }, 5, box, solids('7,5'))).toEqual({
      x: 107,
      y: 90,
    });
  });

  it('slides along a wall when moving diagonally into it', () => {
    const p = moveHero({ x: 88, y: 90 }, { x: 1, y: -1 }, 30, box, solids('5,4', '6,4', '7,4'));
    expect(p.y).toBe(86); // stopped by the wall above (cells in row 4 end at y 80; box is 6 tall)
    expect(p.x).toBeGreaterThan(100);
  });

  it('cannot tunnel through a one-cell wall with a big step', () => {
    expect(moveHero({ x: 88, y: 90 }, { x: 1, y: 0 }, 200, box, solids('8,5')).x).toBe(123);
  });
});
