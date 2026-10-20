#!/usr/bin/env python3
"""Recolours Jarrett's and Kira's hair from the pack's red-orange to brown
(owner requests 2026-10-20).

Reads the original sheets from the art pack ("Guy" for Jarrett, "PirateGirl"
for Kira) and writes public/assets/characters/<name>.png. Only the two hair
colours change, and only above a cut-off row in each 32x32 frame, because
Jarrett's shoes and Kira's trousers use the same two colours lower down:
- Jarrett: the hair is in rows 0-20 of every frame.
- Kira: the hair ends above her red belt, whose row shifts as she walks, so the
  cut-off is the belt's row in each frame (ignoring her red bandana up top).
Standard library only.

    python3 tools/art/recolor_hair.py            # both characters
    python3 tools/art/recolor_hair.py kira       # one character
"""
import struct
import sys
import zlib

PACK = "legacy/TinyRPG/Characters/Top-Down-16-bit-fantasy/Characters pack 1"
FRAME = 32
BELT = (0xD6, 0x24, 0x11)  # Kira's belt (and bandana) red
BELT_FROM_ROW = 19  # below the bandana
SWAP = {
    (0xB5, 0x55, 0x28): (0x8A, 0x5A, 0x32),  # hair, lit: red-orange -> warm brown
    (0x7F, 0x06, 0x22): (0x4E, 0x2C, 0x18),  # hair, shadow: dark red -> dark brown
}


def read_rgba(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat = 8, b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind, body = data[pos + 4 : pos + 8], data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            assert (depth, ctype, interlace) == (8, 6, 0), "expects 8-bit RGBA, not interlaced"
        elif kind == b"IDAT":
            idat += body
    raw, stride = zlib.decompress(idat), w * 4
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1 : i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - 4] if x >= 4 else 0
            b = prev[x]
            c = prev[x - 4] if x >= 4 else 0
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
    return w, h, rows


def write_rgba(path, w, h, rows):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    with open(path, "wb") as out:
        out.write(b"\x89PNG\r\n\x1a\n")
        out.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)))
        out.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        out.write(chunk(b"IEND", b""))


def jarrett_cutoff(rows, fx, fy):
    """Jarrett's hair is in rows 0-20 of every frame; his shoes start at row 28."""
    return 21


def kira_cutoff(rows, fx, fy):
    """The first row with Kira's belt in this frame: hair above it, trousers from it."""
    for y in range(BELT_FROM_ROW, FRAME):
        line = rows[fy + y]
        for x in range(fx, fx + FRAME):
            if tuple(line[x * 4 : x * 4 + 3]) == BELT and line[x * 4 + 3]:
                return y
    raise SystemExit(f"kira: no belt found in the frame at ({fx}, {fy})")


CHARACTERS = {
    "jarrett": (f"{PACK}/Guy/aseprite.png", jarrett_cutoff),
    "kira": (f"{PACK}/PirateGirl/spritesheet.png", kira_cutoff),
}


def recolour(name):
    source, cutoff = CHARACTERS[name]
    output = f"public/assets/characters/{name}.png"
    w, h, rows = read_rgba(source)
    changed = 0
    for fy in range(0, h, FRAME):
        for fx in range(0, w, FRAME):
            stop = cutoff(rows, fx, fy)
            for y in range(fy, fy + stop):
                row = rows[y]
                for x in range(fx, fx + FRAME):
                    r, g, b, a = row[x * 4 : x * 4 + 4]
                    new = SWAP.get((r, g, b))
                    if a and new:
                        row[x * 4 : x * 4 + 3] = bytes(new)
                        changed += 1
    write_rgba(output, w, h, rows)
    print(f"{name}: recoloured {changed} hair pixels -> {output}")


if __name__ == "__main__":
    for name in sys.argv[1:] or CHARACTERS:
        recolour(name)
