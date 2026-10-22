#!/usr/bin/env python3
"""Makes the spark barrier, Thunder Spire's Ward puzzle (owner decision 2026-10-21):
16x16 tiles of crackling energy cut from the middle of the pack's "waveform"
shot. Nothing is redrawn or recoloured; the pixels are the pack's own.

Reads Warped shooting fx/waveform/spritesheet.png (4 frames of 95x32) and
writes public/assets/effects/spark.png: 8 tiles of 16x16 in a row. From each
frame it takes a 32x16 strip through the crackle's core and splits it in two,
so tile 2f is frame f's left half and tile 2f+1 its right half. Two barrier
cells side by side (a doorway) show one unbroken strip. Standard library only.

    python3 tools/art/spark_barrier.py
"""
from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/Explosions and Magic/Warped shooting fx/waveform/spritesheet.png"
OUTPUT = "public/assets/effects/spark.png"
FRAME_W, FRAMES = 95, 4
# The strip: 32 wide, 16 high, through the core of each frame (by eye, in view_sheet.py).
STRIP_X, STRIP_Y, STRIP_W, TILE = 30, 8, 32, 16


def main():
    width, height, rows = read_rgba(SOURCE)
    assert (width, height) == (FRAME_W * FRAMES, 32), "unexpected sheet size"
    out = [bytearray() for _ in range(TILE)]
    for f in range(FRAMES):
        left = f * FRAME_W + STRIP_X
        for y in range(TILE):
            src = rows[STRIP_Y + y]
            out[y] += src[left * 4 : (left + STRIP_W) * 4]
    write_rgba(OUTPUT, STRIP_W * FRAMES, TILE, [bytes(r) for r in out])
    print(f"wrote {OUTPUT}: {FRAMES * 2} tiles of {TILE}x{TILE}")


if __name__ == "__main__":
    main()
