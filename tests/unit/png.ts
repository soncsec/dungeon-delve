import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/**
 * Decodes an 8-bit RGBA, RGB or palette PNG (colour types 6, 2 and 3, not
 * interlaced) into its size and alpha channel (RGB pixels are all opaque). Every sheet we ship is one of
 * these; anything else fails the test.
 */
export function pngAlpha(path: string): { width: number; height: number; alpha: Uint8Array } {
  const { width, height, rgba } = pngRgba(path);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
  return { width, height, alpha };
}

/** Decodes the same PNGs into their size and RGBA pixels (4 bytes a pixel). */
export function pngRgba(path: string): { width: number; height: number; rgba: Uint8Array } {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colourType = bytes[25];
  if (bytes[24] !== 8 || ![6, 2, 3].includes(colourType ?? -1) || bytes[28] !== 0) {
    throw new Error(`${path}: not an 8-bit RGBA, RGB or palette non-interlaced PNG`);
  }
  // Bytes per pixel: 4 for RGBA, 3 for RGB, 1 (a palette index) for palette images.
  const bpp = colourType === 6 ? 4 : colourType === 2 ? 3 : 1;
  let transparency: Uint8Array = new Uint8Array();
  let palette: Uint8Array = new Uint8Array();
  const chunks: Uint8Array[] = [];
  for (let pos = 8; pos < bytes.length;) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (type === 'IDAT') chunks.push(bytes.subarray(pos + 8, pos + 8 + len));
    if (type === 'tRNS') transparency = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'PLTE') palette = bytes.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
  }
  const joined = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  chunks.reduce((at, c) => (joined.set(c, at), at + c.length), 0);
  const raw = inflateSync(joined);
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x] ?? 0;
      const a = x >= bpp ? (out[y * stride + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (out[(y - 1) * stride + x - bpp] ?? 0) : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][filter] ?? 0;
      out[y * stride + x] = (cur + pred) & 0xff;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < 3; k++) {
      rgba[i * 4 + k] = bpp === 1 ? (palette[(out[i] ?? 0) * 3 + k] ?? 0) : (out[i * bpp + k] ?? 0);
    }
    // Palette entries without a tRNS value are fully opaque.
    rgba[i * 4 + 3] =
      bpp === 4 ? (out[i * 4 + 3] ?? 0) : bpp === 3 ? 255 : (transparency[out[i] ?? 0] ?? 255);
  }
  return { width, height, rgba };
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
