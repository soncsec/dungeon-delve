import { describe, expect, it } from 'vitest';
import { shieldBlocks } from '../../src/logic/shield';

const COS_60 = 0.5;

describe('shieldBlocks', () => {
  it('blocks a shot coming straight at his front', () => {
    expect(shieldBlocks('right', { x: -1, y: 0 }, false, COS_60)).toBe(true);
    expect(shieldBlocks('up', { x: 0, y: 1 }, false, COS_60)).toBe(true);
  });

  it('blocks a slanted shot within the arc, but not one wider than it', () => {
    const at = (deg: number) => ({
      x: -Math.cos((deg * Math.PI) / 180),
      y: Math.sin((deg * Math.PI) / 180),
    });
    expect(shieldBlocks('right', at(59), false, COS_60)).toBe(true);
    expect(shieldBlocks('right', at(61), false, COS_60)).toBe(false);
  });

  it('does not block shots from the side or behind', () => {
    expect(shieldBlocks('right', { x: 0, y: 1 }, false, COS_60)).toBe(false);
    expect(shieldBlocks('right', { x: 1, y: 0 }, false, COS_60)).toBe(false);
  });

  it('does not block while his hands are busy', () => {
    expect(shieldBlocks('right', { x: -1, y: 0 }, true, COS_60)).toBe(false);
  });
});
