import { describe, expect, it } from 'vitest';
import { NO_KEYS, padChanges, padKeys } from '../../src/logic/touchPad';

describe('padKeys', () => {
  it('holds nothing in the dead zone', () => {
    expect(padKeys(0, 0, 10)).toEqual(NO_KEYS);
    expect(padKeys(6, -6, 10)).toEqual(NO_KEYS);
  });

  it('holds one arrow straight out, and two on a diagonal', () => {
    expect(padKeys(30, 0, 10)).toEqual({ ...NO_KEYS, right: true });
    expect(padKeys(-30, 2, 10)).toEqual({ ...NO_KEYS, left: true });
    expect(padKeys(-30, -2, 10)).toEqual({ ...NO_KEYS, left: true });
    expect(padKeys(0, -30, 10)).toEqual({ ...NO_KEYS, up: true });
    expect(padKeys(1, 30, 10)).toEqual({ ...NO_KEYS, down: true });
    expect(padKeys(20, 20, 10)).toEqual({ ...NO_KEYS, right: true, down: true });
    expect(padKeys(-20, 20, 10)).toEqual({ ...NO_KEYS, left: true, down: true });
    expect(padKeys(-20, -20, 10)).toEqual({ ...NO_KEYS, left: true, up: true });
    expect(padKeys(20, -20, 10)).toEqual({ ...NO_KEYS, right: true, up: true });
  });

  it('rounds to the nearest of the eight ways', () => {
    expect(padKeys(30, 10, 10)).toEqual({ ...NO_KEYS, right: true }); // 18° below right
    expect(padKeys(30, 15, 10)).toEqual({ ...NO_KEYS, right: true, down: true }); // 27°
  });
});

describe('padChanges', () => {
  it('presses the arrows newly held and lets go of those no longer held', () => {
    const right = { ...NO_KEYS, right: true };
    const rightDown = { ...NO_KEYS, right: true, down: true };
    expect(padChanges(NO_KEYS, right)).toEqual({ press: ['ArrowRight'], release: [] });
    expect(padChanges(right, rightDown)).toEqual({ press: ['ArrowDown'], release: [] });
    expect(padChanges(rightDown, { ...NO_KEYS, up: true })).toEqual({
      press: ['ArrowUp'],
      release: ['ArrowRight', 'ArrowDown'],
    });
    expect(padChanges(right, right)).toEqual({ press: [], release: [] });
  });
});
