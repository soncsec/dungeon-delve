import { describe, expect, it } from 'vitest';
import { isNewBest, parseFastest } from '../../src/logic/fastest';

describe('the fastest finish', () => {
  it('reads a stored time only if it is a sensible whole number of ms', () => {
    expect(parseFastest('3600000')).toBe(3_600_000);
    expect(parseFastest(null)).toBeNull();
    expect(parseFastest('')).toBeNull();
    expect(parseFastest('0')).toBeNull();
    expect(parseFastest('-5')).toBeNull();
    expect(parseFastest('12.5')).toBeNull();
    expect(parseFastest('1e9')).toBeNull();
    expect(parseFastest('99999999999')).toBeNull(); // over a year
    expect(parseFastest('9999999999999')).toBeNull(); // too long to be a time
  });

  it('a finish is a new best if it is the first, or quicker; a play-test run never is', () => {
    expect(isNewBest(null, 5000, false)).toBe(true);
    expect(isNewBest(6000, 5000, false)).toBe(true);
    expect(isNewBest(5000, 5000, false)).toBe(false);
    expect(isNewBest(4000, 5000, false)).toBe(false);
    expect(isNewBest(null, 5000, true)).toBe(false);
    expect(isNewBest(null, 0, false)).toBe(false);
  });
});
