import { describe, expect, it } from 'vitest';
import {
  canThrow,
  daggerBox,
  otherMode,
  stepDagger,
  throwDagger,
  type Dagger,
  type DaggerTuning,
} from '../../src/logic/weapons';

const t: DaggerTuning = { speed: 200, range: 100, length: 12, thickness: 4 };
const open = (): boolean => false;
const dagger = (over: Partial<Dagger> = {}): Dagger => ({
  id: 1,
  pos: { x: 100, y: 50 },
  dir: 'right',
  travelled: 0,
  ...over,
});

describe('weapon mode', () => {
  it('switches between near and far', () => {
    expect(otherMode('near')).toBe('far');
    expect(otherMode('far')).toBe('near');
  });
});

describe('throwDagger', () => {
  it('leaves his hand level with the middle of his body, a little in front', () => {
    expect(throwDagger(3, { x: 100, y: 100 }, 'right', 20)).toEqual({
      id: 3,
      pos: { x: 108, y: 90 },
      dir: 'right',
      travelled: 0,
    });
    expect(throwDagger(4, { x: 100, y: 100 }, 'up', 20).pos).toEqual({ x: 100, y: 82 });
  });
});

describe('stepDagger', () => {
  it('flies straight at its speed', () => {
    const r = stepDagger(dagger(), 100, t, open);
    expect(r.dagger.pos).toEqual({ x: 120, y: 50 });
    expect(r.dagger.travelled).toBe(20);
    expect(r.stopped).toBe(false);
  });

  it('stops when its range runs out, never flying past it', () => {
    const r = stepDagger(dagger({ travelled: 90 }), 100, t, open);
    expect(r.dagger.pos).toEqual({ x: 110, y: 50 });
    expect(r.dagger.travelled).toBe(100);
    expect(r.stopped).toBe(true);
  });

  it('stops at a wall, before entering it, even with a big step', () => {
    const wall = (cx: number): boolean => cx === 8; // x 128–143
    const r = stepDagger(dagger(), 1000, { ...t, range: 1000 }, wall);
    expect(r.stopped).toBe(true);
    expect(r.dagger.pos.x).toBeLessThan(128);
    expect(r.dagger.pos.x).toBeGreaterThan(120);
    expect(r.dagger.travelled).toBeCloseTo(r.dagger.pos.x - 100);
  });

  it('stops at once when thrown straight into a wall', () => {
    const r = stepDagger(dagger(), 100, t, () => true);
    expect(r).toEqual({ dagger: dagger(), stopped: true });
  });

  it('a dagger with no range left stays put and is stopped', () => {
    const r = stepDagger(dagger({ travelled: 100 }), 100, t, open);
    expect(r.dagger.pos).toEqual({ x: 100, y: 50 });
    expect(r.stopped).toBe(true);
  });
});

describe('daggerBox', () => {
  it('is long along the flight and thin across it', () => {
    expect(daggerBox(dagger(), t)).toEqual({ x: 94, y: 48, w: 12, h: 4 });
    expect(daggerBox(dagger({ dir: 'down' }), t)).toEqual({ x: 98, y: 44, w: 4, h: 12 });
  });
});

describe('canThrow', () => {
  it('allows the first throw, then waits for the cooldown', () => {
    expect(canThrow(0, 2, null, 0, 300)).toBe(true);
    expect(canThrow(1, 2, 1000, 1299, 300)).toBe(false);
    expect(canThrow(1, 2, 1000, 1300, 300)).toBe(true);
  });
  it('never allows more daggers in flight than the maximum', () => {
    expect(canThrow(2, 2, null, 5000, 300)).toBe(false);
  });
});
