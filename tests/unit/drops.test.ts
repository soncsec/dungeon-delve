import { describe, expect, it } from 'vitest';
import { rollDrop } from '../../src/logic/drops';
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
