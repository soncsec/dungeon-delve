import { readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  ASSET_GROUPS,
  OBJECT_FRAMES,
  animKey,
  type SheetAsset,
} from '../../src/assets/manifest';

const PUBLIC_DIR = `${process.cwd()}/public`;

/**
 * Decodes an 8-bit RGBA PNG (colour type 6, not interlaced) into its size and
 * alpha channel. Every sheet we ship is this kind; anything else fails the test.
 */
function pngAlpha(path: string): { width: number; height: number; alpha: Uint8Array } {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0) {
    throw new Error(`${path}: not an 8-bit RGBA non-interlaced PNG`);
  }
  const chunks: Uint8Array[] = [];
  for (let pos = 8; pos < bytes.length;) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (type === 'IDAT') chunks.push(bytes.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const joined = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  chunks.reduce((at, c) => (joined.set(c, at), at + c.length), 0);
  const raw = inflateSync(joined);
  const stride = width * 4;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x] ?? 0;
      const a = x >= 4 ? (out[y * stride + x - 4] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= 4 && y > 0 ? (out[(y - 1) * stride + x - 4] ?? 0) : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][filter] ?? 0;
      out[y * stride + x] = (cur + pred) & 0xff;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = out[i * 4 + 3] ?? 0;
  return { width, height, alpha };
}

/** Whether a frame of a sheet has at least one visible pixel. */
function frameHasPixels(sheet: SheetAsset, frame: number): boolean {
  const png = pngAlpha(`${PUBLIC_DIR}/${sheet.path}`);
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
