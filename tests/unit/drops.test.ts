import { describe, expect, it } from 'vitest';
import { dropSpot, rollDrop } from '../../src/logic/drops';
import { createRng, type Rng } from '../../src/logic/rng';

/** An Rng whose int() always returns `n`. */
const rolls = (n: number): Rng => ({
  next: () => 0,
  int: () => n,
  range: (a) => a,
  pick: (i) => i[0] as (typeof i)[number],
});
const table = { gem: 40, heart: 20 };

describe('rollDrop', () => {
  it('splits the 0–99 roll into gem, heart, then nothing', () => {
    expect(rollDrop(rolls(0), table)).toBe('gem');
    expect(rollDrop(rolls(39), table)).toBe('gem');
    expect(rollDrop(rolls(40), table)).toBe('heart');
    expect(rollDrop(rolls(59), table)).toBe('heart');
    expect(rollDrop(rolls(60), table)).toBeNull();
    expect(rollDrop(rolls(99), table)).toBeNull();
  });

  it('rejects impossible chances', () => {
    expect(() => rollDrop(rolls(0), { gem: 80, heart: 30 })).toThrow(RangeError);
    expect(() => rollDrop(rolls(0), { gem: -1, heart: 30 })).toThrow(RangeError);
    expect(() => rollDrop(rolls(0), { gem: 10, heart: -3 })).toThrow(RangeError);
    expect(() => rollDrop(rolls(0), { gem: 10.5, heart: 3 })).toThrow(RangeError);
  });

  it('comes out close to the chances over many rolls', () => {
    const rng = createRng(42);
    const counts = { gem: 0, heart: 0, none: 0 };
    for (let i = 0; i < 10_000; i++) counts[rollDrop(rng, table) ?? 'none']++;
    expect(counts.gem / 10_000).toBeCloseTo(0.4, 1);
    expect(counts.heart / 10_000).toBeCloseTo(0.2, 1);
  });
});

describe('dropSpot: a drop lands where Jarrett can reach and see it', () => {
  /** A map of the room: '#' he can't walk, '~' walkable but hidden (under a canopy). */
  const grid = (rows: Record<number, string>) => {
    const lines = Array.from({ length: 10 }, (_, y) => rows[y] ?? '....................');
    return {
      walkable: (x: number, y: number) => lines[y]?.[x] !== '#',
      shows: (x: number, y: number) => lines[y]?.[x] === '.',
    };
  };
  /** The bottom middle of a cell, where drops sit. */
  const spot = (x: number, y: number) => ({ x: x * 16 + 8, y: (y + 1) * 16 - 1 });
  const hero = spot(1, 1);

  it('where it fell, if he can reach and see that cell', () => {
    const g = grid({});
    const at = { x: 100.5, y: 70.25 };
    expect(dropSpot(at, hero, g.walkable, g.shows)).toEqual(at);
  });

  it('in a tree (solid), it moves to the nearest open cell', () => {
    const g = grid({ 5: '.....#..............' });
    expect(dropSpot(spot(5, 5), hero, g.walkable, g.shows)).toEqual(spot(5, 4));
  });

  it('under a canopy (hidden), it moves out to where it shows', () => {
    const g = grid({
      4: '....~~~.............',
      5: '....~#~.............',
      6: '....~~~.............',
    });
    expect(dropSpot(spot(5, 4), hero, g.walkable, g.shows)).toEqual(spot(5, 3));
  });

  it('on a tie, the higher cell, then the one further left', () => {
    // From (5,5) inside a wall: (5,4) and (5,6) are as near; the higher wins.
    const across = grid({ 5: '....###.............' });
    expect(dropSpot(spot(5, 5), hero, across.walkable, across.shows)).toEqual(spot(5, 4));
    // From (5,5) in a column of wall: (4,5) and (6,5) are as near; the left one wins.
    const down = grid({
      4: '.....#..............',
      5: '.....#..............',
      6: '.....#..............',
    });
    expect(dropSpot(spot(5, 5), hero, down.walkable, down.shows)).toEqual(spot(4, 5));
  });

  it('never where he can’t reach: across a wall, it comes to his side', () => {
    // A wall down column 10; he is on the left; it fell on the right.
    const g = grid(
      Object.fromEntries(Array.from({ length: 10 }, (_, y) => [y, '..........#.........'])),
    );
    expect(dropSpot(spot(14, 5), hero, g.walkable, g.shows)).toEqual(spot(9, 5));
  });

  it('stays put if he can reach nowhere (standing off the room or in a wall)', () => {
    const g = grid({ 1: '.#..................' });
    const at = spot(5, 5);
    expect(dropSpot(at, hero, g.walkable, g.shows)).toEqual(at);
    expect(dropSpot(at, { x: -20, y: 40 }, g.walkable, g.shows)).toEqual(at);
  });

  it('stays put if nowhere he can reach shows it', () => {
    const g = grid(
      Object.fromEntries(Array.from({ length: 10 }, (_, y) => [y, '~~~~~~~~~~~~~~~~~~~~'])),
    );
    const at = spot(5, 5);
    expect(dropSpot(at, hero, g.walkable, g.shows)).toEqual(at);
  });
});
