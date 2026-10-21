#!/usr/bin/env python3
"""Makes the forest art for village rooms (owner decision 2026-10-20).

The forest sheet's walls and props (pines, oaks, rocks) cast dark teal
shadows on the ground, and the props carry bits of the forest's dark grass;
both show as teal patches on the village's light grass. This writes a copy of
the sheet, public/assets/tiles/forest-village.png, with those colours turned
into the village's grass and its shade. None of them are in the trees
themselves. Standard library only.

    python3 tools/art/village_edges.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "public/assets/tiles/forest.png"
OUTPUT = "public/assets/tiles/forest-village.png"
SHADE = (0x8A, 0x9A, 0x35)  # the village grass in shadow
SWAP = {
    # Shadows on the ground: under the walls' edges, and under props.
    (0x18, 0x6A, 0x54): SHADE,
    (0x1A, 0x5F, 0x5A): SHADE,
    (0x19, 0x5E, 0x59): SHADE,
    # Bits of forest grass inside the prop art: village grass instead.
    (0x18, 0x74, 0x54): (0xAE, 0xBD, 0x42),
    (0x19, 0x7E, 0x52): (0xAE, 0xBD, 0x42),
    (0x24, 0x87, 0x5C): (0xA7, 0xB5, 0x3C),
}


def main():
    w, h, rows = read_rgba(SOURCE)
    changed = 0
    for y in range(h):
        row = rows[y]
        for x in range(w):
            r, g, b, a = row[x * 4 : x * 4 + 4]
            new = SWAP.get((r, g, b))
            if a and new:
                row[x * 4 : x * 4 + 3] = bytes(new)
                changed += 1
    write_rgba(OUTPUT, w, h, rows)
    print(f"recoloured {changed} pixels -> {OUTPUT}")


if __name__ == "__main__":
    main()
