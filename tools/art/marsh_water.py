#!/usr/bin/env python3
"""Makes the marsh's pond tiles (owner decision 2026-10-20).

The Overworld sheet (TinyRPG) has water only as islands, with beaches and
cliffs. Their edge pieces, used as they are, make a pond's edges: an island's
bottom edge (land above, water below) is a pond's north edge, and so on. The
smaller island's inner corners make a pond's north corners, and flipped
upside down, its south corners. The sheet has no all-water cell, so the pond's
middle is the sheet's deep-water colour with a few of its lighter wave pixels.
The pieces' grass is recoloured to the forest's grass, which the marsh shares.

Writes public/assets/tiles/marsh-water.png: one row of 16x16 tiles, in the
order of POND_FRAMES in src/logic/tiles.ts. Standard library only.

    python3 tools/art/marsh_water.py
"""
from recolor_hair import write_rgba
from view_sheet import read

SOURCE = "legacy/TinyRPG/Environments/Overworld/Overworld 16x16/Tileset/overworld.png"
OUTPUT = "public/assets/tiles/marsh-water.png"
GRASS = {
    (0x85, 0xA4, 0x4B): (0x18, 0x74, 0x54),
    (0x90, 0xAD, 0x4C): (0x19, 0x7E, 0x52),
    (0x9D, 0xBC, 0x52): (0x19, 0x7E, 0x52),
    (0xA3, 0xC4, 0x55): (0x24, 0x87, 0x5C),
}
DEEP = (0x1E, 0x44, 0x5E)
WAVE = (0x16, 0x69, 0x8A)
WAVES = [(3, 4), (4, 4), (11, 9), (12, 9), (6, 13)]
# (name, column, row, flip upside down) on the Overworld sheet; None is the made water.
PIECES = [
    ("water", None, None, False),
    ("n", 2, 7, False),
    ("n2", 3, 7, False),
    ("s", 2, 4, False),
    ("s2", 3, 4, False),
    ("w", 5, 5, False),
    ("e", 0, 5, False),
    ("nw", 3, 11, False),
    ("ne", 1, 11, False),
    ("sw", 3, 11, True),
    ("se", 1, 11, True),
]


def main():
    _, _, px = read(SOURCE)  # rows of (r, g, b, a); the sheet is a palette PNG
    out = [bytearray() for _ in range(16)]
    for _, col, row, flip in PIECES:
        for y in range(16):
            if col is None:
                line = bytearray()
                for x in range(16):
                    line += bytes((*(WAVE if (x, y) in WAVES else DEEP), 255))
            else:
                sy = row * 16 + (15 - y if flip else y)
                line = bytearray()
                for x in range(16):
                    r, g, b, a = px[sy][col * 16 + x]
                    rgb = GRASS.get((r, g, b), (r, g, b)) if a else (r, g, b)
                    line += bytes((*rgb, a))
            out[y] += line
    write_rgba(OUTPUT, 16 * len(PIECES), 16, out)
    print(f"{len(PIECES)} tiles -> {OUTPUT}")


if __name__ == "__main__":
    main()
