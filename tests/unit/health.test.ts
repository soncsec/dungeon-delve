import { describe, expect, it } from 'vitest';
import {
  fullHealth,
  heal,
  heartStates,
  isInvulnerable,
  isOut,
  takeDamage,
} from '../../src/logic/health';

describe('health', () => {
  it('starts full, two half hearts per heart', () => {
    expect(fullHealth(3)).toEqual({ points: 6, max: 6, invulnerableUntil: 0 });
  });

  it('takes damage, then ignores more until invulnerability ends', () => {
    let h = takeDamage(fullHealth(3), 1, 1000, 1000);
    expect(h.points).toBe(5);
    expect(isInvulnerable(h, 1999)).toBe(true);
    expect(takeDamage(h, 1, 1500, 1000)).toBe(h);
    h = takeDamage(h, 2, 2000, 1000);
    expect(h.points).toBe(3);
  });

  it('ignores zero or negative damage', () => {
    const h = fullHealth(3);
    expect(takeDamage(h, 0, 0, 1000)).toBe(h);
    expect(takeDamage(h, -2, 0, 1000)).toBe(h);
  });

  it('never drops below zero, and is out at zero', () => {
    const h = takeDamage(fullHealth(1), 5, 0, 1000);
    expect(h.points).toBe(0);
    expect(isOut(h)).toBe(true);
    expect(isOut(fullHealth(1))).toBe(false);
  });

  it('heals up to the maximum, never by a negative amount', () => {
    const hurt = { points: 2, max: 6, invulnerableUntil: 0 };
    expect(heal(hurt, 2).points).toBe(4);
    expect(heal(hurt, 10).points).toBe(6);
    expect(heal(hurt, -3).points).toBe(2);
  });

  it('shows hearts as full, half or empty', () => {
    expect(heartStates({ points: 3, max: 6, invulnerableUntil: 0 })).toEqual([
      'full',
      'half',
      'empty',
    ]);
    expect(heartStates(fullHealth(2))).toEqual(['full', 'full']);
  });
});
