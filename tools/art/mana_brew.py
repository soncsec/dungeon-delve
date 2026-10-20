#!/usr/bin/env python3
"""Makes the Mana Brew: the pack's red potion with its liquid turned blue
(owner request 2026-10-20; a runtime tint could only darken it to navy).

Cuts the potion (16x16 at x 208, y 48) from the pack's dungeon-objects sheet
and writes public/assets/items/mana-brew.png. Only the four red liquid colours
change; the cork and outline stay. Standard library only.

    python3 tools/art/mana_brew.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/TinyRPG/Environments/single-dungeon-crawler-objects/PNG/dungeon-crawler-objects-transparent.png"
OUTPUT = "public/assets/items/mana-brew.png"
X, Y, SIZE = 208, 48, 16
SWAP = {
    (0xD2, 0x38, 0x2F): (0x6F, 0xB4, 0xFF),  # highlight
    (0x96, 0x1A, 0x13): (0x2F, 0x6F, 0xD8),  # liquid
    (0x68, 0x05, 0x2E): (0x1C, 0x3F, 0x9A),  # shade
    (0x59, 0x04, 0x34): (0x15, 0x2A, 0x6A),  # deepest shade
}


def main():
    _, _, rows = read_rgba(SOURCE)
    out = []
    changed = 0
    for y in range(Y, Y + SIZE):
        line = bytearray(rows[y][X * 4 : (X + SIZE) * 4])
        for x in range(SIZE):
            r, g, b, a = line[x * 4 : x * 4 + 4]
            new = SWAP.get((r, g, b))
            if a and new:
                line[x * 4 : x * 4 + 3] = bytes(new)
                changed += 1
        out.append(line)
    write_rgba(OUTPUT, SIZE, SIZE, out)
    print(f"recoloured {changed} pixels -> {OUTPUT}")


if __name__ == "__main__":
    main()
