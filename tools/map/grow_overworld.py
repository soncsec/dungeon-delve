#!/usr/bin/env python3
"""Grows the overworld from 8x8 screens to 16 wide by 12 tall (owner 2026-10-22).

The 64 hand-made screens in src/world/overworld.ts were spread apart (old
column c to 2c, old rows 0-7 to rows 0, 2, 3, 5, 6, 8, 9, 11). This makes the
128 screens between them, each in the style of its region, with its doorways
matching its neighbours'. The output is plain room text in src/world/wilds.ts,
made once and then edited by hand like any other room: running this again
starts the wilds over (hand edits are lost). Standard library only; seeded,
so it makes the same rooms every time. (Given the old 8x8 file, it spreads
the rooms itself first.)

    python3 tools/map/grow_overworld.py            # writes src/world/wilds.ts
"""
import random
import re
import sys

COLS, ROWS = 20, 10
WIDE, TALL = 16, 12
ROW_OF = [0, 2, 3, 5, 6, 8, 9, 11]
SEED = 20261022
SOURCE = "src/world/overworld.ts"
OUTPUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "src/world/wilds.ts"

# Each prop's art, in cells round its anchor: (left, top, right, bottom), inclusive.
ART = {
    "T": (-1, -2, 1, 0),  # pine, 48x48 on its trunk
    "O": (-1, -2, 1, 0),  # oak, 48x48 on the middle of its base
    "R": (0, 0, 1, 1),  # boulder, 2x2 from its top-left
    "r": (0, 0, 0, 0),
    "b": (0, 0, 0, 0),
    "M": (-1, -3, 2, 0),  # maple, 64x64 on its two-cell trunk (anchored left)
    "S": (0, -1, 1, 0),  # stump, 32x32 on its two cells
    "n": (0, -1, 0, 0),  # cone bush, 16x32
    "w": (0, 0, 0, 0),
}
# The cells each prop blocks, round its anchor.
SOLID = {
    "T": [(0, 0)],
    "O": [(-1, 0), (0, 0), (1, 0)],
    "R": [(0, 0), (1, 0), (0, 1), (1, 1)],
    "r": [(0, 0)],
    "b": [(0, 0)],
    "M": [(0, 0), (1, 0)],
    "S": [(0, 0), (1, 0)],
    "n": [(0, 0)],
    "w": [(0, 0)],
}
FLIERS = {"bird", "eye", "ghost"}
BOX = {  # enemy body boxes (half width, height), from src/config/tuning.ts
    "robot": (7, 10), "bird": (9, 14), "ghost": (10, 22), "eye": (10, 18), "wolf": (14, 12),
    "snake": (7, 10), "mushroom": (9, 14), "toad": (9, 14),
}
ENEMIES = {
    "forest": ["wolf", "bird", "robot", "robot", "wolf"],
    "village": ["robot", "bird"],
    "marsh": ["ghost", "eye", "snake", "toad"],
    "ruins": ["ghost", "mushroom", "eye", "mushroom"],
    "mountains": ["wolf", "eye", "toad", "bird"],
    "volcano": ["eye", "ghost", "eye"],
    "vault": ["ghost", "ghost"],
}


def parse_old(text):
    """The old rooms: their position, region, lines, and where their header sits in the file."""
    rooms = []
    for m in re.finditer(r"\n  \{\n    col: (\d+),\n    row: (\d+),\n", text):
        end = text.find("\n  },\n", m.end())
        block = text[m.start():end]
        region = re.search(r"region: '(\w+)'", block)
        lines = re.findall(r"'([^']{20})'", block)
        assert len(lines) == ROWS, (m.group(1), m.group(2))
        rooms.append({
            "col": int(m.group(1)), "row": int(m.group(2)),
            "region": region.group(1) if region else "forest",
            "lines": lines, "start": m.start(),
        })
    return rooms


def edges_of(lines):
    """Which of a room's four standard doorways are open (north, south: columns 9-10; west, east: rows 4-5)."""
    walk = lambda ch: ch not in "F#WRTOrbHMSnwAVxht"
    return {
        "n": walk(lines[0][9]) and walk(lines[0][10]),
        "s": walk(lines[9][9]) and walk(lines[9][10]),
        "w": walk(lines[4][0]) and walk(lines[5][0]),
        "e": walk(lines[4][19]) and walk(lines[5][19]),
    }


def region_for(c, r, old):
    """A new room takes the region of the old rooms round it."""
    get = lambda cc, rr: old.get((cc, rr), {}).get("region")
    w, e = get(c - 1, r), get(c + 1, r)
    if w and w == e:
        return w
    n, s = get(c, r - 1), get(c, r + 1)
    if n and n == s:
        return n
    best = None
    for (cc, rr), room in old.items():
        d = abs(cc - c) + abs(rr - r)
        # Ties: the room to the west, then north, then the rest in a fixed order.
        rank = (d, 0 if (cc < c and rr == r) else 1 if (rr < r and cc == c) else 2, rr, cc)
        if best is None or rank < best[0]:
            best = (rank, room["region"])
    return best[1]


class Room:
    def __init__(self, rng, region, edges):
        self.rng, self.region, self.edges = rng, region, edges
        self.g = [["." for _ in range(COLS)] for _ in range(ROWS)]

    def put(self, x, y, ch):
        self.g[y][x] = ch

    def at(self, x, y):
        return self.g[y][x] if 0 <= x < COLS and 0 <= y < ROWS else "F"

    def walls(self):
        """The room's edge of trees (or cliffs, or stone), ragged, with its doorways open."""
        rng, e = self.rng, self.edges
        wall = "#" if self.region == "vault" else "F"
        if self.region == "vault":
            for y in range(ROWS):
                for x in range(COLS):
                    side = x < 2 or x > 17 or y < 2 or y > 7
                    self.g[y][x] = wall if side else "."
        else:
            widths = {1: rng.randint(3, 6), 2: rng.randint(2, 4), 7: rng.randint(2, 4), 8: rng.randint(3, 6)}
            widths_r = {1: rng.randint(3, 6), 2: rng.randint(2, 4), 7: rng.randint(2, 4), 8: rng.randint(3, 6)}
            for y in range(ROWS):
                if y in (0, 9):
                    left = right = COLS
                elif y in widths:
                    left, right = widths[y], widths_r[y]
                else:
                    left, right = rng.randint(1, 3), rng.randint(1, 3)
                for x in range(COLS):
                    if x < left or x >= COLS - right:
                        self.g[y][x] = wall
        # The doorways, and the way in from each, clear.
        if e["n"]:
            for y in (0, 1):
                self.put(9, y, "."), self.put(10, y, ".")
        if e["s"]:
            for y in (8, 9):
                self.put(9, y, "."), self.put(10, y, ".")
        if e["w"]:
            for x in (0, 1, 2):
                self.put(x, 4, "."), self.put(x, 5, ".")
        if e["e"]:
            for x in (17, 18, 19):
                self.put(x, 4, "."), self.put(x, 5, ".")
        # The way in from each doorway stays clear of anything solid (art may hang over it).
        self.lanes = set()
        if e["n"]:
            self.lanes |= {(x, y) for x in (8, 9, 10, 11) for y in (0, 1, 2)}
        if e["s"]:
            self.lanes |= {(x, y) for x in (8, 9, 10, 11) for y in (7, 8, 9)}
        if e["w"]:
            self.lanes |= {(x, y) for x in (0, 1, 2) for y in (3, 4, 5, 6)}
        if e["e"]:
            self.lanes |= {(x, y) for x in (17, 18, 19) for y in (3, 4, 5, 6)}
        # And nothing solid on the straight ways across, from each doorway to the middle and on.
        if e["w"] or e["e"]:
            self.lanes |= {(x, y) for x in range(COLS) for y in (4, 5)}
        if e["n"] or e["s"]:
            self.lanes |= {(x, y) for x in (9, 10) for y in range(ROWS)}

    def open_cells(self):
        return [(x, y) for y in range(ROWS) for x in range(COLS) if self.g[y][x] in ".pq,\""]

    def connected(self):
        """Every open cell joined to every other (and so to every doorway)."""
        cells = set(self.open_cells())
        if not cells:
            return False
        start = next(iter(cells))
        seen, todo = {start}, [start]
        while todo:
            x, y = todo.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in cells and n not in seen:
                    seen.add(n)
                    todo.append(n)
        return seen == cells

    def try_prop(self, ch, x, y):
        """Puts a prop down if its cells are free, its art clears the lanes, and the room stays joined."""
        cells = [(x + dx, y + dy) for dx, dy in SOLID[ch]]
        if any(not (1 <= cx < COLS - 1 and 1 <= cy < ROWS - 1) or self.g[cy][cx] != "." for cx, cy in cells):
            return False
        if set(cells) & self.lanes:
            return False
        # Keep a cell of grass round a prop's foot, so things don't crowd together.
        for cx, cy in cells:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = self.at(cx + dx, cy + dy)
                    if (n in SOLID or n in "_W#") and (cx + dx, cy + dy) not in cells:
                        return False
        before = [row[:] for row in self.g]
        self.g[y][x] = ch
        for cx, cy in cells:
            if (cx, cy) != (x, y):
                self.g[cy][cx] = "_"  # part of the prop (written back as '.' below the anchor's char)
        if not self.connected():
            self.g = before
            return False
        return True

    def pond(self):
        rng = self.rng
        for _ in range(30):
            w, h = rng.randint(3, 5), rng.randint(2, 3)
            x, y = rng.randint(2, COLS - 2 - w), rng.randint(2, ROWS - 2 - h)
            cells = {(x + i, y + j) for i in range(w) for j in range(h)}
            ring = {(cx + dx, cy + dy) for cx, cy in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
            if cells & self.lanes or any(self.at(cx, cy) != "." for cx, cy in ring):
                continue
            before = [row[:] for row in self.g]
            for cx, cy in cells:
                self.g[cy][cx] = "W"
            if self.connected():
                return True
            self.g = before
        return False

    def ruin(self):
        """A broken stretch of old wall, with paving round it."""
        rng = self.rng
        for _ in range(30):
            w, h = rng.choice([(1, 2), (2, 2), (3, 2), (1, 3), (4, 2)])
            x, y = rng.randint(2, COLS - 2 - w), rng.randint(2, ROWS - 2 - h)
            cells = {(x + i, y + j) for i in range(w) for j in range(h)}
            ring = {(cx + dx, cy + dy) for cx, cy in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
            if cells & self.lanes or any(self.at(cx, cy) not in ".q" for cx, cy in ring):
                continue
            before = [row[:] for row in self.g]
            for cx, cy in cells:
                self.g[cy][cx] = "#"
            for cx, cy in ring - cells:
                if self.g[cy][cx] == "." and rng.random() < 0.5:
                    self.g[cy][cx] = "q"
            if self.connected():
                return True
            self.g = before
        return False

    def pillars(self):
        """The vault grounds: a few blocks of old stone standing about."""
        rng = self.rng
        for _ in range(rng.randint(2, 4)):
            for _ in range(30):
                w, h = rng.choice([(2, 2), (2, 2), (3, 2), (1, 2)])
                x, y = rng.randint(2, COLS - 2 - w), rng.randint(2, ROWS - 2 - h)
                cells = {(x + i, y + j) for i in range(w) for j in range(h)}
                ring = {(cx + dx, cy + dy) for cx, cy in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
                # Clear of other pillars (it may stand against the outer wall).
                if cells & self.lanes or any(self.at(cx, cy) == "#" for cx, cy in cells) or any(
                    self.at(cx, cy) == "#" and 2 <= cx < COLS - 2 and 2 <= cy < ROWS - 2 for cx, cy in ring
                ):
                    continue
                before = [row[:] for row in self.g]
                for cx, cy in cells:
                    self.g[cy][cx] = "#"
                if self.connected():
                    break
                self.g = before

    def streets(self):
        """The village road and paths, and garden bits."""
        e = self.edges
        if e["w"] or e["e"]:
            lo = 0 if e["w"] else 9
            hi = COLS if e["e"] else 11
            for x in range(lo, hi):
                self.g[4][x] = "p"
        if e["n"]:
            for y in range(0, 5):
                self.g[y][9] = self.g[y][10] = "p"
        if e["s"]:
            for y in range(4, ROWS):
                self.g[y][9] = self.g[y][10] = "p"
        for _ in range(self.rng.randint(4, 8)):
            x, y = self.rng.randint(2, 17), self.rng.randint(2, 7)
            if (x, y) not in self.lanes and self.g[y][x] == ".":
                self.g[y][x] = self.rng.choice([",", ",", '"'])

    def scatter(self, kinds, count):
        rng = self.rng
        placed = 0
        for _ in range(count * 25):
            if placed >= count:
                break
            ch = rng.choice(kinds)
            x, y = rng.randint(2, COLS - 3), rng.randint(2, ROWS - 3)
            if self.try_prop(ch, x, y):
                placed += 1

    def text(self):
        return ["".join("." if ch in "_X" else ch for ch in row) for row in self.g]


def covered(lines, region):
    """Cells the art hides (as the game's coveredCells): props' art, and tree tops above a forest wall."""
    out = set()
    for y, row in enumerate(lines):
        for x, ch in enumerate(row):
            if ch in ART:
                l, t, r, b = ART[ch]
                for dy in range(t, b + 1):
                    for dx in range(l, r + 1):
                        if 0 <= x + dx < COLS and 0 <= y + dy < ROWS:
                            out.add((x + dx, y + dy))
    if region not in ("mountains", "volcano", "vault"):
        for y in range(1, ROWS):
            for x in range(COLS):
                if lines[y][x] == "F" and lines[y - 1][x] != "F":
                    out.add((x, y - 1))
    return out


def solid_cells(lines):
    out = set()
    for y, row in enumerate(lines):
        for x, ch in enumerate(row):
            if ch in "F#W":
                out.add((x, y))
            if ch in SOLID:
                for dx, dy in SOLID[ch]:
                    out.add((x + dx, y + dy))
    return out


def place_enemies(rng, lines, region, n):
    solid = solid_cells(lines)
    hidden = covered(lines, region)
    doors = [(x, y) for y in range(ROWS) for x in range(COLS)
             if (x in (0, COLS - 1) or y in (0, ROWS - 1)) and (x, y) not in solid]
    out, taken = [], set()
    cells = [(x, y) for y in range(ROWS) for x in range(COLS)]
    rng.shuffle(cells)
    kinds = ENEMIES[region]
    for kind in [rng.choice(kinds) for _ in range(n)]:
        hw, h = BOX[kind]
        for x, y in cells:
            if (x, y) in taken or any(max(abs(a - x), abs(b - y)) < 3 for a, b in doors):
                continue
            px, py = x * 16 + 8, (y + 1) * 16 - 1
            box = {(cx, cy) for cy in range((py - h) // 16, py // 16 + 1)
                   for cx in range(int((px - hw) // 16), int((px + hw - 1e-6) // 16) + 1)}
            if any(c in solid for c in box):
                continue
            if kind not in FLIERS and any(c in hidden for c in box):
                continue
            out.append((kind, x, y))
            taken.add((x, y))
            break
    return out


def make_room(rng, region, edges, town):
    for _ in range(50):
        room = Room(rng, region, edges)
        room.walls()
        if region == "vault":
            room.pillars()
        elif town:
            room.streets()
            room.scatter(["M", "S", "n", "w", "w"], rng.randint(3, 5))
        elif region == "marsh":
            if rng.random() < 0.8:
                room.pond()
            room.scatter(["b", "O", "T", "R", "b", "T"], rng.randint(4, 7))
        elif region == "ruins":
            for _ in range(rng.randint(1, 3)):
                room.ruin()
            room.scatter(["b", "r", "T", "R"], rng.randint(3, 5))
        elif region in ("mountains", "volcano"):
            room.scatter(["R", "r", "r", "R"], rng.randint(5, 8))
        else:  # forest and meadows
            room.scatter(["T", "T", "O", "b", "r", "R", "T"], rng.randint(5, 9))
        if room.connected():
            return room.text()
    raise SystemExit(f"no room for {region} {edges}")


def main():
    text = open(SOURCE).read()
    old_list = parse_old(text)
    spread = all(r["col"] < 8 and r["row"] < 8 for r in old_list)
    old = {((r["col"] * 2, ROW_OF[r["row"]]) if spread else (r["col"], r["row"])): r for r in old_list}
    rng = random.Random(SEED)
    spots = [(c, r) for r in range(TALL) for c in range(WIDE) if (c, r) not in old]
    regions = {s: region_for(*s, old) for s in spots}
    # Doorways: to an old room, whatever it has; between new rooms, mostly open.
    def open_between(a, b, side_a, side_b):
        if a in old:
            return edges_of(old[a]["lines"])[side_a]
        if b in old:
            return edges_of(old[b]["lines"])[side_b]
        return rng.random() < 0.8
    edges = {s: {"n": False, "s": False, "w": False, "e": False} for s in spots}
    for (c, r) in spots:
        if c + 1 < WIDE:
            o = open_between((c, r), (c + 1, r), "e", "w")
            edges[(c, r)]["e"] = o
            if (c + 1, r) in edges:
                edges[(c + 1, r)]["w"] = o
        if r + 1 < TALL:
            o = open_between((c, r), (c, r + 1), "s", "n")
            edges[(c, r)]["s"] = o
            if (c, r + 1) in edges:
                edges[(c, r + 1)]["n"] = o
        if c > 0 and (c - 1, r) in old:
            edges[(c, r)]["w"] = edges_of(old[(c - 1, r)]["lines"])["e"]
        if r > 0 and (c, r - 1) in old:
            edges[(c, r)]["n"] = edges_of(old[(c, r - 1)]["lines"])["s"]
    # Every new room must be reachable: open a way from a reached neighbour into any that isn't.
    def joined():
        start = (8, 11)
        seen, todo = {start}, [start]
        def doors(p):
            c, r = p
            e = edges[p] if p in edges else edges_of(old[p]["lines"])
            for side, (dc, dr) in (("n", (0, -1)), ("s", (0, 1)), ("w", (-1, 0)), ("e", (1, 0))):
                if e[side] and 0 <= c + dc < WIDE and 0 <= r + dr < TALL:
                    yield (c + dc, r + dr)
        while todo:
            p = todo.pop()
            for q in doors(p):
                if q not in seen:
                    seen.add(q)
                    todo.append(q)
        return seen
    opposite = {"n": "s", "s": "n", "w": "e", "e": "w"}
    for _ in range(200):
        seen = joined()
        lost = [s for s in spots if s not in seen]
        if not lost:
            break
        for (c, r) in lost:
            for side, (dc, dr) in (("n", (0, -1)), ("s", (0, 1)), ("w", (-1, 0)), ("e", (1, 0))):
                q = (c + dc, r + dr)
                if q in seen and q in edges:
                    edges[(c, r)][side] = True
                    edges[q][opposite[side]] = True
                    break
            else:
                continue
            break
    else:
        raise SystemExit("could not join every room")
    out = []
    for s in spots:
        c, r = s
        region = regions[s]
        # The village's own streets: between two town rooms of the old village row.
        town = region == "village" and r == 9
        lines = make_room(rng, region, edges[s], town)
        assert edges_of(lines) == edges[s], (s, edges_of(lines), edges[s])
        quiet = region == "village" and town
        n = 0 if quiet else rng.randint(1, 3)
        foes = place_enemies(rng, lines, region, n)
        out.append((c, r, region, lines, foes))
    write(out)


def write(rooms):
    head = """/**
 * The overworld's wilder screens (M5.8, owner 2026-10-22): the 128 screens
 * between the 64 first ones when the map grew from 8x8 to 16 wide by 12 tall.
 * Made by tools/map/grow_overworld.py in each region's style; edited by hand
 * from here on like any other room (legend in src/logic/room.ts).
 */
import type { RoomDef } from '../logic/world';

export const WILDS: readonly RoomDef[] = [
"""
    body = []
    for c, r, region, lines, foes in rooms:
        enemies = ""
        if foes:
            enemies = "    enemies: [\n" + "".join(
                f"      {{ kind: '{k}', col: {x}, row: {y} }},\n" for k, x, y in foes) + "    ],\n"
        rows = "".join(f"      '{line}',\n" for line in lines)
        body.append(f"  {{\n    col: {c},\n    row: {r},\n    region: '{region}',\n{enemies}    lines: [\n{rows}    ],\n  }},\n")
    open(OUTPUT, "w").write(head + "".join(body) + "];\n")
    print(f"wrote {OUTPUT}: {len(rooms)} rooms")


if __name__ == "__main__":
    main()
