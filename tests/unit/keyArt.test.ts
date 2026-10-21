import { describe, expect, it } from 'vitest';
import { KEY_COLOURS, KEY_PIXELS } from '../../src/assets/keyArt';

describe('the key drawn in code', () => {
  it('is a small even grid of known colours', () => {
    const width = KEY_PIXELS[0]?.length ?? 0;
    expect(width).toBeGreaterThan(8);
    expect(width).toBeLessThanOrEqual(16);
    expect(KEY_PIXELS.length).toBeLessThanOrEqual(16);
    for (const row of KEY_PIXELS) {
      expect(row).toHaveLength(width);
      for (const ch of row) expect(ch === '.' || ch in KEY_COLOURS, ch).toBe(true);
    }
  });

  it('has a gold body inside a dark outline', () => {
    const all = KEY_PIXELS.join('');
    expect(all).toContain('#');
    expect(all).toContain('o');
  });
});
