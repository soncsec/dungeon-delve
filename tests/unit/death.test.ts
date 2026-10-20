import { describe, expect, it } from 'vitest';
import { fallMessage, gemsAfterFalling } from '../../src/logic/death';

describe('gemsAfterFalling', () => {
  it('loses a share of the gems, rounded down', () => {
    expect(gemsAfterFalling(100, 10)).toBe(90);
    expect(gemsAfterFalling(57, 10)).toBe(52);
  });
  it('never loses any of a handful of gems', () => {
    expect(gemsAfterFalling(9, 10)).toBe(9);
    expect(gemsAfterFalling(0, 10)).toBe(0);
  });
  it('rejects impossible percentages', () => {
    expect(() => gemsAfterFalling(10, -1)).toThrow(RangeError);
    expect(() => gemsAfterFalling(10, 101)).toThrow(RangeError);
  });
});

describe('fallMessage', () => {
  it('mentions the lost gems only when some were lost', () => {
    expect(fallMessage(5)).toEqual(['JARRETT FELL...', '-5 GEMS']);
    expect(fallMessage(0)).toEqual(['JARRETT FELL...']);
  });
});
