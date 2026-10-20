import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/**
 * Decodes an 8-bit RGBA PNG (colour type 6, not interlaced) into its size and
 * alpha channel. Every sheet we ship is this kind; anything else fails the test.
 */
export function pngAlpha(path: string): { width: number; height: number; alpha: Uint8Array } {
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

/** Whether a rectangle of a PNG has at least one visible pixel. */
export function hasPixels(
  png: { width: number; alpha: Uint8Array },
  x0: number,
  y0: number,
  w: number,
  h: number,
): boolean {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) if ((png.alpha[y * png.width + x] ?? 0) > 0) return true;
  return false;
}
