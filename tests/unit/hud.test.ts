import { describe, expect, it } from 'vitest';
import { fullHealth } from '../../src/logic/health';
import { gemLabel, heartIcons } from '../../src/logic/hud';

describe('heartIcons', () => {
  it('lays out one icon per heart with its state', () => {
    expect(heartIcons({ points: 3, max: 6, invulnerableUntil: 0 }, 4, 15, 6)).toEqual([
      { x: 4, row: 0, state: 'full' },
      { x: 19, row: 0, state: 'half' },
      { x: 34, row: 0, state: 'empty' },
    ]);
  });
  it('grows with heart containers, wrapping onto a second row', () => {
    const icons = heartIcons(fullHealth(11), 1, 12, 6);
    expect(icons).toHaveLength(11);
    expect(icons[5]).toMatchObject({ x: 61, row: 0 });
    expect(icons[6]).toMatchObject({ x: 1, row: 1 });
    expect(icons[10]).toMatchObject({ x: 49, row: 1 });
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
