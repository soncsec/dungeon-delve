import { describe, expect, it } from 'vitest';
import { NO_HOLD, findTune, holdsUp, isHolding, startHold } from '../../src/logic/finds';

describe('holding up a find', () => {
  it('holds up anything from a chest', () => {
    for (const kind of [
      'gem',
      'key',
      'item',
      'health-potion',
      'mana-brew',
      'heart-container',
    ] as const) {
      expect(holdsUp(kind, true), kind).toBe(true);
    }
  });

  it('holds up a heart container, a shard or the Mana Crystal wherever it comes from', () => {
    expect(holdsUp('heart-container', false)).toBe(true);
    expect(holdsUp('shard', false)).toBe(true);
    expect(holdsUp('mana-crystal', false)).toBe(true);
  });

  it('not an enemy’s drop', () => {
    expect(holdsUp('gem', false)).toBe(false);
    expect(holdsUp('heart', false)).toBe(false);
  });

  it('plays the big fanfare for a shard or the Mana Crystal, the success jingle for the rest', () => {
    expect(findTune('shard')).toBe('shard');
    expect(findTune('mana-crystal')).toBe('shard');
    expect(findTune('item')).toBe('found');
    expect(findTune('key')).toBe('found');
    expect(findTune('heart-container')).toBe('found');
  });

  it('lasts its time, then he is free', () => {
    expect(isHolding(NO_HOLD, 0)).toBe(false);
    const hold = startHold(1000, 1500);
    expect(isHolding(hold, 1000)).toBe(true);
    expect(isHolding(hold, 2499)).toBe(true);
    expect(isHolding(hold, 2500)).toBe(false);
  });
});
