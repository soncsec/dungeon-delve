#!/usr/bin/env python3
"""Draws an enlarged copy of a sprite sheet with a grid, for working out frame
positions by eye. Transparent pixels show as a grey checkerboard. Development
aid only; nothing in the game uses it. Standard library only.

    python3 tools/art/view_sheet.py SHEET.png OUT.png [scale] [grid] [x y w h]
"""
import struct
import sys
import zlib


def read(path):
    """Pixels of an 8-bit RGBA, RGB or palette PNG (not interlaced), as rows of (r, g, b, a)."""
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, plte, trns = 8, b"", b"", b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind, body = data[pos + 4 : pos + 8], data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and interlace == 0 and ctype in (2, 3, 6), "unsupported PNG"
        elif kind == b"PLTE":
            plte = body
        elif kind == b"tRNS":
            trns = body
        elif kind == b"IDAT":
            idat += body
    bpp = {6: 4, 2: 3, 3: 1}[ctype]
    raw, stride = zlib.decompress(idat), w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    px = []
    for r in rows:
        if ctype == 6:
            px.append([tuple(r[x * 4 : x * 4 + 4]) for x in range(w)])
        elif ctype == 2:
            px.append([tuple(r[x * 3 : x * 3 + 3]) + (255,) for x in range(w)])
        else:
            px.append([tuple(plte[r[x] * 3 : r[x] * 3 + 3]) + ((trns[r[x]] if r[x] < len(trns) else 255),) for x in range(w)])
    return w, h, px


def write(path, w, h, px, scale, grid):
    out = bytearray()
    for Y in range(h * scale):
        out.append(0)
        for X in range(w * scale):
            x, y = X // scale, Y // scale
            c = px[y][x]
            if grid and ((x % grid == 0 and X % scale == 0) or (y % grid == 0 and Y % scale == 0)):
                c = (255, 0, 255, 255)
            elif c[3] == 0:
                c = (40, 40, 40, 255) if (x // 4 + y // 4) % 2 else (60, 60, 60, 255)
            out += bytes(c[:3]) + b"\xff"

    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w * scale, h * scale, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(bytes(out))))
        f.write(chunk(b"IEND", b""))


def main(argv):
    src, dst = argv[0], argv[1]
    scale = int(argv[2]) if len(argv) > 2 else 4
    grid = int(argv[3]) if len(argv) > 3 else 16
    w, h, px = read(src)
    if len(argv) > 7:
        x0, y0, cw, ch = (int(v) for v in argv[4:8])
        px = [row[x0 : x0 + cw] for row in px[y0 : y0 + ch]]
        w, h = cw, ch
    write(dst, w, h, px, scale, grid)
    print(f"{src}: {w}x{h} -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1:])
