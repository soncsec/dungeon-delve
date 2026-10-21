import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  ASSET_GROUPS,
  OBJECT_FRAMES,
  animKey,
  type SheetAsset,
} from '../../src/assets/manifest';
import { pngAlpha } from './png';

const PUBLIC_DIR = `${process.cwd()}/public`;

/** Each image decoded once: the checks below look at many frames of the same sheets. */
const cache = new Map<string, ReturnType<typeof pngAlpha>>();
function decoded(path: string): ReturnType<typeof pngAlpha> {
  let png = cache.get(path);
  if (!png) {
    png = pngAlpha(`${PUBLIC_DIR}/${path}`);
    cache.set(path, png);
  }
  return png;
}

/** Whether a frame of a sheet has at least one visible pixel. */
function frameHasPixels(sheet: SheetAsset, frame: number): boolean {
  const png = decoded(sheet.path);
  const x0 = (frame % sheet.columns) * sheet.frameWidth;
  const y0 = Math.floor(frame / sheet.columns) * sheet.frameHeight;
  for (let y = y0; y < y0 + sheet.frameHeight; y++)
    for (let x = x0; x < x0 + sheet.frameWidth; x++)
      if ((png.alpha[y * png.width + x] ?? 0) > 0) return true;
  return false;
}

const byKey = (key: string): SheetAsset => {
  const a = ASSETS.find((s) => s.key === key);
  if (!a) throw new Error(`no asset ${key}`);
  return a;
};

describe('asset manifest', () => {
  it('has unique keys and only known groups', () => {
    const keys = ASSETS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ASSETS) expect(ASSET_GROUPS).toContain(a.group);
  });

  it('lists every file in public/assets exactly once', () => {
    const onDisk = readdirSync(`${PUBLIC_DIR}/assets`, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.png'))
      .map((f) => `assets/${f}`)
      .sort();
    expect(ASSETS.map((a) => a.path).sort()).toEqual(onDisk);
  });

  it('every file is listed in CREDITS.md', () => {
    const credits = readFileSync(`${process.cwd()}/CREDITS.md`, 'utf8');
    for (const a of ASSETS) expect(credits).toContain(`\`${a.path}\``);
  });

  it.each(ASSETS.map((a) => [a.key, a] as const))('%s: image size is the frame grid', (_k, a) => {
    const png = pngAlpha(`${PUBLIC_DIR}/${a.path}`);
    expect({ width: png.width, height: png.height }).toEqual({
      width: a.columns * a.frameWidth,
      height: a.rows * a.frameHeight,
    });
  });

  it.each(ASSETS.flatMap((a) => a.anims.map((an) => [animKey(a.key, an.name), a, an] as const)))(
    '%s: frames are on the sheet, visible, and the speed is sane',
    (_k, a, an) => {
      expect(an.frames.length).toBeGreaterThan(0);
      expect(an.frameRate).toBeGreaterThan(0);
      for (const f of an.frames) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(a.columns * a.rows);
        expect(frameHasPixels(a, f), `frame ${f}`).toBe(true);
      }
    },
  );

  it('animation names are unique within each sheet', () => {
    for (const a of ASSETS) {
      const names = a.anims.map((an) => an.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it.each(Object.entries(OBJECT_FRAMES))('object frame %s is not blank', (_name, frame) => {
    expect(frameHasPixels(byKey('objects'), frame)).toBe(true);
  });

  it('the walkers have a down, left and up walk', () => {
    for (const key of ['jarrett', 'kira']) {
      expect(byKey(key).anims.map((an) => an.name)).toEqual(['walk-down', 'walk-left', 'walk-up']);
    }
  });
});
