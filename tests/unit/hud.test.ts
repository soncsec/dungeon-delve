import { describe, expect, it } from 'vitest';
import { fullHealth } from '../../src/logic/health';
import { gemLabel, heartIcons } from '../../src/logic/hud';

describe('heartIcons', () => {
  it('lays out one icon per heart with its state', () => {
    expect(heartIcons({ points: 3, max: 6, invulnerableUntil: 0 }, 4, 15)).toEqual([
      { x: 4, state: 'full' },
      { x: 19, state: 'half' },
      { x: 34, state: 'empty' },
    ]);
  });
  it('grows with heart containers', () => {
    expect(heartIcons(fullHealth(11), 0, 15)).toHaveLength(11);
  });
});

describe('gemLabel', () => {
  it('pads to the width of the maximum', () => {
    expect(gemLabel(7, 999)).toBe('007');
    expect(gemLabel(42, 999)).toBe('042');
  });
  it('caps at the maximum and never goes below zero', () => {
    expect(gemLabel(1500, 999)).toBe('999');
    expect(gemLabel(-3, 999)).toBe('000');
    expect(gemLabel(2.7, 999)).toBe('002');
  });
});
