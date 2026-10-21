#!/usr/bin/env python3
"""Makes the Mana Crystal, Bog Grotto's prize (a bigger mana bar): the pack's
second red crystal turned the blue of the mana bar (owner decision 2026-10-21).

Reads Gothicvania's Rocky Pass crystal-2.png (26x20) and writes
public/assets/items/mana-crystal.png. Only its four crystal colours change.
Standard library only.

    python3 tools/art/mana_crystal.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/Gothicvania/Environments/Rocky Pass Files/PNG/Props/crystal-2.png"
OUTPUT = "public/assets/items/mana-crystal.png"
SWAP = {
    (0xE9, 0x87, 0xB8): (0xC8, 0xF0, 0xFF),  # highlight
    (0xDD, 0x25, 0x1F): (0x3F, 0xA0, 0xFF),  # light face (the mana bar's blue)
    (0xA5, 0x0A, 0x31): (0x20, 0x60, 0xC8),  # mid face
    (0x6B, 0x0A, 0x32): (0x18, 0x30, 0x6E),  # shade
}


def main():
    width, height, rows = read_rgba(SOURCE)
    out = []
    changed = 0
    for y in range(height):
        line = bytearray(rows[y][: width * 4])
        for x in range(width):
            r, g, b, a = line[x * 4 : x * 4 + 4]
            new = SWAP.get((r, g, b))
            if a and new:
                line[x * 4 : x * 4 + 3] = bytes(new)
                changed += 1
        out.append(line)
    write_rgba(OUTPUT, width, height, out)
    print(f"recoloured {changed} pixels -> {OUTPUT}")


if __name__ == "__main__":
    main()
