import { describe, expect, it } from 'vitest';
import {
  boost,
  canCast,
  fullMana,
  maxMana,
  isBoosted,
  refill,
  spend,
  type ManaTuning,
} from '../../src/logic/mana';

const t: ManaTuning = { perSecond: 10, delayMs: 1000, boostFactor: 3 };

describe('mana', () => {
  it('starts full', () => {
    expect(fullMana(100)).toEqual({ current: 100, max: 100, lastSpentAt: null, boostUntil: 0 });
  });

  it('spends mana on a cast, only if there is enough', () => {
    const m = spend(fullMana(100), 25, 500);
    expect(m.current).toBe(75);
    expect(m.lastSpentAt).toBe(500);
    const low = { ...m, current: 20 };
    expect(canCast(low, 25)).toBe(false);
    expect(spend(low, 25, 600)).toBe(low);
    expect(canCast(low, 20)).toBe(true);
  });

  it('refills only after a pause since the last cast', () => {
    const m = spend(fullMana(100), 50, 1000);
    expect(refill(m, 1999, 100, t)).toBe(m);
    expect(refill(m, 2000, 100, t).current).toBe(51);
  });

  it('refills from the start when nothing has been cast yet, never past full', () => {
    const m = { ...fullMana(100), current: 99.5 };
    expect(refill(m, 0, 1000, t).current).toBe(100);
    const full = fullMana(100);
    expect(refill(full, 0, 1000, t)).toBe(full);
  });

  it('refills faster during a Mana Brew, and only then', () => {
    const m = { ...spend(fullMana(100), 50, 0), lastSpentAt: 0 };
    const brewed = boost(m, 2000, 30_000);
    expect(isBoosted(brewed, 31_999)).toBe(true);
    expect(isBoosted(brewed, 32_000)).toBe(false);
    expect(refill(brewed, 2000, 1000, t).current).toBe(80);
    expect(refill(brewed, 32_000, 1000, t).current).toBe(60);
  });

  it('a second brew extends the first instead of restarting it', () => {
    const once = boost(fullMana(100), 1000, 30_000);
    expect(boost(once, 5000, 30_000).boostUntil).toBe(61_000);
    // After the first has worn off, a new one starts from now.
    expect(boost(once, 40_000, 30_000).boostUntil).toBe(70_000);
  });
});

describe('maxMana', () => {
  it('is the base, and more for each Mana Crystal', () => {
    expect(maxMana(100, 50, 0)).toBe(100);
    expect(maxMana(100, 50, 1)).toBe(150);
    expect(maxMana(100, 50, 2)).toBe(200);
  });
});
