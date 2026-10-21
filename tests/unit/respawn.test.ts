import { describe, expect, it } from 'vitest';
import { NO_CLEARED, defeat, enterRoom, type Cleared } from '../../src/logic/respawn';

const AWAY = 4;
/** Walks through rooms in order, returning the state and what's gone in the last. */
function walk(c: Cleared, ...keys: string[]): { cleared: Cleared; gone: readonly number[] } {
  let r = { cleared: c, gone: [] as readonly number[] };
  for (const k of keys) r = enterRoom(r.cleared, k, AWAY);
  return r;
}

describe('respawn', () => {
  it('keeps defeated enemies gone when he steps out and straight back', () => {
    let { cleared } = walk(NO_CLEARED, 'a');
    cleared = defeat(defeat(cleared, 'a', 0), 'a', 1);
    expect(walk(cleared, 'b', 'a').gone).toEqual([0, 1]);
  });

  it('brings them back once he has been through 4 other rooms', () => {
    let { cleared } = walk(NO_CLEARED, 'a');
    cleared = defeat(cleared, 'a', 1);
    expect(walk(cleared, 'b', 'c', 'd', 'a').gone).toEqual([1]); // 3 rooms away: still gone
    expect(walk(cleared, 'b', 'c', 'd', 'e', 'a').gone).toEqual([]); // 4: back
  });

  it('counts from his last visit, not from the defeat', () => {
    let { cleared } = walk(NO_CLEARED, 'a');
    cleared = defeat(cleared, 'a', 0);
    // Back after 3 rooms (still gone), then 3 more: 3 rooms since he last left.
    const back = walk(cleared, 'b', 'c', 'd', 'a');
    expect(walk(back.cleared, 'e', 'f', 'g', 'a').gone).toEqual([0]);
  });

  it('remembers rooms separately; rooms with nothing defeated have nothing gone', () => {
    let { cleared } = walk(NO_CLEARED, 'a');
    cleared = defeat(cleared, 'a', 0);
    cleared = walk(cleared, 'b').cleared;
    cleared = defeat(cleared, 'b', 2);
    expect(walk(cleared, 'a').gone).toEqual([0]);
    expect(walk(cleared, 'c').gone).toEqual([]);
    expect(walk(cleared, 'a', 'b').gone).toEqual([2]);
  });
});
