#!/usr/bin/env python3
"""Makes the shard of the Star of Power: the pack's red crystal turned gold,
to match the gold Star in the inventory (owner decision 2026-10-20).

Reads Gothicvania's Rocky Pass crystal-1.png (25x25) and writes
public/assets/items/shard.png. Only its four crystal colours change.
Standard library only.

    python3 tools/art/gold_shard.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/Gothicvania/Environments/Rocky Pass Files/PNG/Props/crystal-1.png"
OUTPUT = "public/assets/items/shard.png"
SWAP = {
    (0xE9, 0x87, 0xB8): (0xFF, 0xF4, 0xAA),  # highlight
    (0xDD, 0x25, 0x1F): (0xFF, 0xD1, 0x66),  # light face (the inventory Star's gold)
    (0xA5, 0x0A, 0x31): (0xE0, 0x96, 0x28),  # mid face
    (0x6B, 0x0A, 0x32): (0x96, 0x55, 0x14),  # shade
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
