#!/usr/bin/env python3
"""Makes the Demon, the Sorcerer's true shape: the pack's horned demon at 80%.

At its native 144 px it is too tall for a 160 px room (its horns go off the top
of the screen), so the owner chose (2026-10-22) to scale it down, once, here:
an exception to keeping the pack's native pixel resolution. Each new pixel
takes the colour covering most of its area (transparent counts as a colour),
so the art keeps its palette and crisp edges rather than blurring.

Reads TinyRPG's Monster Pack demon-sheet.png (5 frames of 112x153) and writes
public/assets/bosses/demon.png (5 frames of 89x122). Standard library only.

    python3 tools/art/scale_demon.py
"""
from fractions import Fraction

from recolor_hair import read_rgba, write_rgba

SOURCE = "legacy/TinyRPG/Characters/Battle Sprites/Monster Pack Files/spritesheets/demon-sheet.png"
OUTPUT = "public/assets/bosses/demon.png"
FRAME = (112, 153)
FRAMES = 5
SCALE = Fraction(4, 5)


def scale_frame(rows, left, scale):
    """One frame, scaled: each new pixel the colour covering most of its area."""
    fw, fh = FRAME
    ow, oh = int(fw * scale), int(fh * scale)
    step = 1 / scale
    out = []
    for oy in range(oh):
        y0, y1 = oy * step, (oy + 1) * step
        line = bytearray()
        for ox in range(ow):
            x0, x1 = ox * step, (ox + 1) * step
            cover = {}
            for sy in range(int(y0), min(fh, -(-y1 // 1))):
                hy = min(y1, sy + 1) - max(y0, sy)
                for sx in range(int(x0), min(fw, -(-x1 // 1))):
                    hx = min(x1, sx + 1) - max(x0, sx)
                    if hx <= 0 or hy <= 0:
                        continue
                    pixel = bytes(rows[sy][(left + sx) * 4 : (left + sx) * 4 + 4])
                    if pixel[3] == 0:
                        pixel = bytes(4)
                    cover[pixel] = cover.get(pixel, 0) + hx * hy
            line += max(cover.items(), key=lambda kv: kv[1])[0]
        out.append(line)
    return ow, oh, out


def main():
    _, _, rows = read_rgba(SOURCE)
    frames = [scale_frame(rows, i * FRAME[0], SCALE) for i in range(FRAMES)]
    ow, oh = frames[0][0], frames[0][1]
    out = [bytearray().join(f[2][y] for f in frames) for y in range(oh)]
    write_rgba(OUTPUT, ow * FRAMES, oh, out)
    print(f"{FRAMES} frames of {ow}x{oh} -> {OUTPUT}")


if __name__ == "__main__":
    main()
