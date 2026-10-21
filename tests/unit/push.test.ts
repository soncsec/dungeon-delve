import { describe, expect, it } from 'vitest';
import { NO_LEAN, lean, stoneAt, type Stone } from '../../src/logic/push';

const stones: Stone[] = [
  { cx: 5, cy: 5 },
  { cx: 7, cy: 5 },
];
const open = (): boolean => true;

describe('pushable stones', () => {
  it('finds a stone by its cell', () => {
    expect(stoneAt(stones, 7, 5)).toBe(1);
    expect(stoneAt(stones, 6, 5)).toBe(-1);
  });

  it('leaning briefly does nothing; long enough slides the stone one cell', () => {
    let r = lean(stones, NO_LEAN, 0, 'up', 200, 300, open);
    expect(r.moved).toBeNull();
    expect(r.lean).toEqual({ stone: 0, ms: 200 });
    r = lean(r.stones, r.lean, 0, 'up', 150, 300, open);
    expect(r.moved).toBe(0);
    expect(r.stones[0]).toEqual({ cx: 5, cy: 4 });
    expect(r.stones[1]).toEqual({ cx: 7, cy: 5 });
    expect(r.lean).toEqual(NO_LEAN);
  });

  it('pushes the way he faces', () => {
    expect(lean(stones, NO_LEAN, 0, 'left', 400, 300, open).stones[0]).toEqual({ cx: 4, cy: 5 });
    expect(lean(stones, NO_LEAN, 0, 'down', 400, 300, open).stones[0]).toEqual({ cx: 5, cy: 6 });
  });

  it('switching to another stone starts the lean again', () => {
    const r = lean(stones, { stone: 1, ms: 280 }, 0, 'up', 50, 300, open);
    expect(r.lean).toEqual({ stone: 0, ms: 50 });
    expect(r.moved).toBeNull();
  });

  it('will not slide into a wall or onto another stone', () => {
    const blocked = lean(stones, NO_LEAN, 0, 'up', 400, 300, () => false);
    expect(blocked.moved).toBeNull();
    expect(blocked.stones).toBe(stones);
    const onStone = lean(stones, NO_LEAN, 0, 'right', 400, 300, open);
    expect(onStone.moved).toBe(0); // (6, 5) is free
    const r = lean(
      [
        { cx: 5, cy: 5 },
        { cx: 6, cy: 5 },
      ],
      NO_LEAN,
      0,
      'right',
      400,
      300,
      open,
    );
    expect(r.moved).toBeNull();
  });

  it('a stone that is not there never moves', () => {
    expect(lean(stones, NO_LEAN, 9, 'up', 400, 300, open).moved).toBeNull();
  });
});
