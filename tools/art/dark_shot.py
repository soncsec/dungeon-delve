#!/usr/bin/env python3
"""Makes the Vampire's dark shots: the pack's enemy orb recoloured purple
(owner request 2026-10-22; a runtime tint could only darken its orange).

Reads the enemy orb (2 frames of 16x16) and writes
public/assets/effects/dark-shot.png. The orb's three colours swap for
purples of matching brightness, so it still pulses the same way: frame 0 a
violet ring round a pale lavender core, frame 1 a deep purple ring round a
violet core. Standard library only.

    python3 tools/art/dark_shot.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/Gothicvania/Misc/EnemyProjectile/spritesheet.png"
OUTPUT = "public/assets/effects/dark-shot.png"
SWAP = {
    (0xFA, 0xFD, 0xFF): (0xEE, 0xD8, 0xFF),  # white core -> pale lavender
    (0xFF, 0xD1, 0x00): (0xB8, 0x5C, 0xFF),  # yellow -> violet
    (0xFF, 0x84, 0x26): (0x74, 0x2C, 0xC8),  # orange -> deep purple
}


def main():
    width, height, rows = read_rgba(SOURCE)
    assert (width, height) == (32, 16), "unexpected sheet size"
    out = []
    changed = 0
    for row in rows:
        line = bytearray(row)
        for x in range(width):
            r, g, b, a = line[x * 4 : x * 4 + 4]
            if not a:
                continue
            new = SWAP.get((r, g, b))
            assert new, f"unexpected colour #{r:02X}{g:02X}{b:02X}"
            line[x * 4 : x * 4 + 3] = bytes(new)
            changed += 1
        out.append(line)
    write_rgba(OUTPUT, width, height, out)
    print(f"recoloured {changed} pixels -> {OUTPUT}")


if __name__ == "__main__":
    main()
