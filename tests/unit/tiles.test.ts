import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/logic/room';
import {
  DUNGEON_COLUMNS,
  DUNGEON_FRAMES,
  FOREST_COLUMNS,
  FOREST_FRAMES,
  PROP_REGIONS,
  PROP_SHEET,
  crackAt,
  dungeonArt,
  dungeonFrame,
  forestFrame,
  propDraw,
  POND_FRAMES,
  pondFrame,
  MOUNTAIN_COLUMNS,
  MOUNTAIN_FRAMES,
  MOUNTAIN_PROP_REGIONS,
  cliffFrame,
  THORN_TINT,
  SWITCH_DIM,
  EYE_TINT,
  FALSE_WALL_TINT,
  mixTint,
  propSheet,
  roomArt,
  coveredCells,
  TOWN_COLUMNS,
  TOWN_FRAMES,
} from '../../src/logic/tiles';
import { hasPixels, pngAlpha } from './png';

const OPEN = '....................';
const room = (rows: Record<number, string>): string[] =>
  Array.from({ length: 10 }, (_, y) => rows[y] ?? OPEN);
const FOREST_PNG = pngAlpha(`${process.cwd()}/public/assets/tiles/forest.png`);

describe('forest frames', () => {
  it('are visible tiles on the forest sheet', () => {
    const frames = [
      FOREST_FRAMES.grass,
      ...[0, 1, 2].flatMap((i) => [
        FOREST_FRAMES.fill(i, 0),
        FOREST_FRAMES.fill(0, i),
        FOREST_FRAMES.left(i),
        FOREST_FRAMES.right(i),
        FOREST_FRAMES.aboveBottom(i),
        FOREST_FRAMES.bottom(i),
        FOREST_FRAMES.top(i),
      ]),
    ];
    for (const f of frames) {
      const x = (f % FOREST_COLUMNS) * 16;
      const y = Math.floor(f / FOREST_COLUMNS) * 16;
      expect(hasPixels(FOREST_PNG, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });

  it('repeat every 3 cells, including at negative positions', () => {
    expect(FOREST_FRAMES.fill(3, 4)).toBe(FOREST_FRAMES.fill(0, 1));
    expect(FOREST_FRAMES.fill(-1, -1)).toBe(FOREST_FRAMES.fill(2, 2));
  });
});

describe('forestFrame', () => {
  // Rows 2–6: a wall block columns 2–8 inside open grass.
  const r = parseRoom(
    room({
      2: '..FFFFFFF...........',
      3: '..FFFFFFF...........',
      4: '..FFFFFFF...........',
      5: '..FFFFFFF...........',
      6: '..FFFFFFF...........',
    }),
  );

  it('fills the inside', () => {
    expect(forestFrame(r, 5, 3)).toBe(FOREST_FRAMES.fill(5, 3));
  });

  it('uses the side pieces on the left and right edges', () => {
    expect(forestFrame(r, 2, 3)).toBe(FOREST_FRAMES.left(3));
    expect(forestFrame(r, 8, 3)).toBe(FOREST_FRAMES.right(3));
  });

  it('uses the trunk row at the bottom and the row above it, even at the corners', () => {
    expect(forestFrame(r, 5, 6)).toBe(FOREST_FRAMES.bottom(5));
    expect(forestFrame(r, 5, 5)).toBe(FOREST_FRAMES.aboveBottom(5));
    expect(forestFrame(r, 2, 6)).toBe(FOREST_FRAMES.bottom(2));
  });
});

describe('roomArt', () => {
  const r = parseRoom(room({ 0: 'FFFFFFFFFFFFFFFFFFFF', 3: 'FF..T...R.....O.....' }));
  const art = roomArt(r);

  it('lays grass under every cell, and forest on wall cells', () => {
    const grass = art.ground.filter((t) => t.frame === FOREST_FRAMES.grass);
    expect(grass).toHaveLength(200);
    expect(art.ground).toHaveLength(200 + 22);
  });

  it('puts tree tops above a wall top edge, but never above the room', () => {
    // Row 3's wall cells (0, 1) have grass above; row 0's run off the top of the room.
    expect(art.over).toEqual([
      { frame: FOREST_FRAMES.top(0), x: 0, y: 32 },
      { frame: FOREST_FRAMES.top(1), x: 16, y: 32 },
    ]);
  });

  it('places props by their anchors, sorted for depth', () => {
    expect(art.props.map((p) => p.prop)).toEqual(['pine', 'oak', 'boulder']);
    expect(art.props[0]).toEqual({ prop: 'pine', x: 72, y: 64 });
  });

  it('stands the archway on its 4×3 block, drawn from the dungeon sheet', () => {
    expect(propDraw('arch', 8, 1)).toEqual({ prop: 'arch', x: 160, y: 64 });
    expect(PROP_SHEET.arch).toBe('dungeon');
    expect(PROP_SHEET.pine).toBe('forest');
  });

  it('stands the boulder on its 2×2 block', () => {
    expect(propDraw('boulder', 8, 3)).toEqual({ prop: 'boulder', x: 144, y: 80 });
  });

  it.each(Object.entries(PROP_REGIONS))('prop %s art is on its sheet and visible', (k, reg) => {
    // Each prop's own sheet: forest, dungeon or town.
    const png = pngAlpha(
      `${process.cwd()}/public/assets/tiles/${PROP_SHEET[k as keyof typeof PROP_SHEET]}.png`,
    );
    expect(reg.x + reg.w).toBeLessThanOrEqual(png.width);
    expect(reg.y + reg.h).toBeLessThanOrEqual(png.alpha.length / png.width);
    expect(hasPixels(png, reg.x, reg.y, reg.w, reg.h)).toBe(true);
  });
});

describe('dungeon tiles', () => {
  const DUNGEON_PNG = pngAlpha(`${process.cwd()}/public/assets/tiles/dungeon.png`);
  // Walls along the top two rows and down the left side, floor elsewhere.
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) => (y < 2 ? '####################' : '##..................')),
  );

  it('draws wall tops, and the brick face where a wall meets the floor', () => {
    expect(dungeonFrame(r, 5, 0)).toBe(DUNGEON_FRAMES.top);
    expect(dungeonFrame(r, 5, 1)).toBe(DUNGEON_FRAMES.face);
    // The left wall runs down to the room's bottom edge, and on past it: all tops.
    expect(dungeonFrame(r, 0, 9)).toBe(DUNGEON_FRAMES.top);
  });

  it('draws a secret wall as wall until it crumbles, then floor, and the wall above ends there', () => {
    const secret = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 4 || y === 5 ? '##................uu' : '##................##',
      ),
    );
    // Standing, it shows a small crack (M10.3a): the tell for a sharp eye.
    expect(dungeonFrame(secret, 18, 4)).toBe(DUNGEON_FRAMES.crackedTop);
    expect(dungeonFrame(secret, 18, 5)).toBe(DUNGEON_FRAMES.crackedTop);
    expect(DUNGEON_FRAMES.crackedTop).not.toBe(DUNGEON_FRAMES.top);
    const open = (x: number, y: number) => (y === 4 || y === 5) && x >= 18;
    expect([DUNGEON_FRAMES.floor, ...DUNGEON_FRAMES.cracks]).toContain(
      dungeonFrame(secret, 19, 4, true, open),
    );
    expect(dungeonFrame(secret, 18, 3, false, open)).toBe(DUNGEON_FRAMES.face);
    expect(dungeonFrame(secret, 18, 3)).toBe(DUNGEON_FRAMES.top);
  });

  it('shades floor next to a wall on its left, and scatters cracks elsewhere', () => {
    expect(dungeonFrame(r, 2, 5)).toBe(DUNGEON_FRAMES.shadow);
    const floors = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 17 }, (_, x) => dungeonFrame(r, x + 3, y + 2)),
    ).flat();
    const cracked = floors.filter((f) => f !== DUNGEON_FRAMES.floor);
    expect(cracked.length).toBeGreaterThan(0);
    expect(cracked.length).toBeLessThan(floors.length / 4);
    for (const f of cracked) expect(DUNGEON_FRAMES.cracks).toContain(f);
  });

  it('crackAt is the same every time', () => {
    expect(crackAt(4, 7)).toBe(crackAt(4, 7));
    expect(crackAt(0, 0)).not.toBeNull();
  });

  it('lays one tile per cell and nothing else', () => {
    const art = dungeonArt(r);
    expect(art.ground).toHaveLength(200);
    expect(art.over).toEqual([]);
    expect(art.props).toEqual([]);
    expect(art.ground[0]).toEqual({ frame: DUNGEON_FRAMES.top, x: 0, y: 0 });
  });

  it('draws a locked door as the barred gate, and as floor once opened', () => {
    const d = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 0
          ? '#########KK#########'
          : y === 4
            ? '##..C...............'
            : '##..................',
      ),
    );
    expect(dungeonFrame(d, 9, 0)).toBe(DUNGEON_FRAMES.gate);
    expect(dungeonFrame(d, 9, 0, true)).not.toBe(DUNGEON_FRAMES.gate);
    const closed = dungeonArt(d);
    expect(closed.chests).toEqual([{ x: 64, y: 64 }]);
    expect(closed.ground[9]?.frame).toBe(DUNGEON_FRAMES.gate);
    // Opened: the door is floor and the chest is gone.
    const open = dungeonArt(d, () => true);
    expect(open.chests).toEqual([]);
    expect(open.ground[9]?.frame).not.toBe(DUNGEON_FRAMES.gate);
  });

  it('every dungeon frame is visible art on the sheet', () => {
    for (const f of [
      DUNGEON_FRAMES.top,
      DUNGEON_FRAMES.face,
      DUNGEON_FRAMES.floor,
      DUNGEON_FRAMES.shadow,
      DUNGEON_FRAMES.gate,
      ...DUNGEON_FRAMES.cracks,
    ]) {
      const x = (f % DUNGEON_COLUMNS) * 16;
      const y = Math.floor(f / DUNGEON_COLUMNS) * 16;
      expect(hasPixels(DUNGEON_PNG, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });
});

describe('village art', () => {
  const TOWN_PNG = pngAlpha(`${process.cwd()}/public/assets/tiles/town.png`);
  const villageRoom = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 3 ? 'p,".................' : '....................',
    ),
  );

  it('draws town grass, with paths, flowers and tall grass where the text says', () => {
    const art = roomArt(villageRoom, 'village');
    const at = (x: number, y: number) => art.ground.find((t) => t.x === x * 16 && t.y === y * 16);
    expect(at(0, 3)).toEqual({ frame: TOWN_FRAMES.ground.path, x: 0, y: 48, sheet: 'town' });
    expect(at(1, 3)?.frame).toBe(TOWN_FRAMES.ground.flowers);
    expect(at(2, 3)?.frame).toBe(TOWN_FRAMES.ground.tall);
    // Mostly plain grass, with a little textured grass scattered about.
    const frames = art.ground.filter((t) => t.y !== 48).map((t) => t.frame);
    expect(frames).toContain(TOWN_FRAMES.grass);
    expect(frames).toContain(TOWN_FRAMES.grassLight);
    expect(frames.filter((f) => f === TOWN_FRAMES.grassLight).length).toBeLessThan(
      frames.length / 4,
    );
    expect(art.ground.every((t) => t.sheet === 'town')).toBe(true);
  });

  it('every town frame has art', () => {
    const frames = [
      TOWN_FRAMES.grass,
      TOWN_FRAMES.grassLight,
      ...Object.values(TOWN_FRAMES.ground),
    ];
    for (const f of frames) {
      const x = (f % TOWN_COLUMNS) * 16;
      const y = Math.floor(f / TOWN_COLUMNS) * 16;
      expect(hasPixels(TOWN_PNG, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });

  it('places village props on their anchors', () => {
    expect(propDraw('house', 3, 4)).toEqual({ prop: 'house', x: 88, y: 128 }); // steps below the walls
    expect(propDraw('maple', 6, 2)).toEqual({ prop: 'maple', x: 112, y: 48 });
    expect(propDraw('stump', 0, 0)).toEqual({ prop: 'stump', x: 16, y: 16 });
    expect(propDraw('cone', 0, 0)).toEqual({ prop: 'cone', x: 8, y: 16 });
    expect(propDraw('shrub', 1, 1)).toEqual({ prop: 'shrub', x: 24, y: 32 });
  });

  it('draws village walls from the recoloured forest sheet', () => {
    const walled = parseRoom(
      // A band of forest across rows 3–5, with tree tops drawn above it.
      Array.from({ length: 10 }, (_, y) =>
        y >= 3 && y <= 5 ? 'FFFFFFFFFFFFFFFFFFFF' : '....................',
      ),
    );
    const art = roomArt(walled, 'village');
    const walls = art.ground.filter((t) => t.sheet === 'forest-village');
    expect(walls).toHaveLength(60);
    expect(art.over.length).toBeGreaterThan(0);
    expect(art.over.every((t) => t.sheet === 'forest-village')).toBe(true);
    // In the forest, walls and tops come from the map's own sheet.
    const forest = roomArt(walled);
    expect(forest.ground.some((t) => t.sheet !== undefined)).toBe(false);
    expect(forest.over.some((t) => t.sheet !== undefined)).toBe(false);
  });

  it('draws a false wall a little duller than the wall round it (in forest and mountains), until it is opened', () => {
    const r = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 2 ? 'FFoh................' : y < 2 ? 'FFFFFFFFFFFFFFFFFFFF' : '....................',
      ),
    );
    const at = (art: ReturnType<typeof roomArt>, x: number, y: number) =>
      art.ground.filter((t) => t.x === x * 16 && t.y === y * 16);
    const forest = roomArt(r);
    expect(at(forest, 3, 2).some((t) => t.tint === FALSE_WALL_TINT)).toBe(true);
    expect(at(forest, 4, 1).some((t) => t.tint !== undefined)).toBe(false);
    const cliffs = roomArt(r, 'mountains');
    expect(at(cliffs, 3, 2).some((t) => t.sheet === 'mountain' && t.tint === FALSE_WALL_TINT)).toBe(
      true,
    );
    // Opened, it is ground, with no tell.
    const opened = roomArt(r, 'forest', (x, y) => x === 3 && y === 2);
    expect(at(opened, 3, 2).some((t) => t.tint !== undefined)).toBe(false);
  });

  it('draws forest props from the recoloured sheet in the village only', () => {
    expect(propSheet('pine', 'village')).toBe('forest-village');
    expect(propSheet('pine', 'forest')).toBe('forest');
    expect(propSheet('house', 'village')).toBe('town');
    expect(propSheet('arch', 'forest')).toBe('dungeon');
  });

  it('forest rooms keep the forest grass', () => {
    expect(roomArt(villageRoom).ground[0]).toEqual({ frame: FOREST_FRAMES.grass, x: 0, y: 0 });
  });
});

describe('ponds', () => {
  const pond = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y >= 2 && y <= 4 ? '..WWWW..............' : '....................',
    ),
  );

  it('picks corners, edges and open water by the land around each cell', () => {
    expect(pondFrame(pond, 2, 2)).toBe(POND_FRAMES.nw);
    expect(pondFrame(pond, 5, 2)).toBe(POND_FRAMES.ne);
    expect(pondFrame(pond, 2, 4)).toBe(POND_FRAMES.sw);
    expect(pondFrame(pond, 5, 4)).toBe(POND_FRAMES.se);
    expect(pondFrame(pond, 3, 2)).toBe(POND_FRAMES.n[1]);
    expect(pondFrame(pond, 4, 2)).toBe(POND_FRAMES.n[0]);
    expect(pondFrame(pond, 3, 4)).toBe(POND_FRAMES.s[1]);
    expect(pondFrame(pond, 4, 4)).toBe(POND_FRAMES.s[0]);
    expect(pondFrame(pond, 2, 3)).toBe(POND_FRAMES.w);
    expect(pondFrame(pond, 5, 3)).toBe(POND_FRAMES.e);
    expect(pondFrame(pond, 3, 3)).toBe(POND_FRAMES.water);
  });

  it('draws water over the ground, from the pond sheet', () => {
    const art = roomArt(pond, 'marsh');
    const water = art.ground.filter((t) => t.sheet === 'marsh-water');
    expect(water).toHaveLength(12);
    expect(water[0]).toEqual({ frame: POND_FRAMES.nw, x: 32, y: 32, sheet: 'marsh-water' });
    // Under it, and everywhere else, the forest's grass.
    expect(art.ground.filter((t) => t.frame === FOREST_FRAMES.grass)).toHaveLength(200);
  });

  it('every pond tile has art', () => {
    const png = pngAlpha(`${process.cwd()}/public/assets/tiles/marsh-water.png`);
    for (let f = 0; f <= POND_FRAMES.se; f++) expect(hasPixels(png, f * 16, 0, 16, 16)).toBe(true);
  });
});

describe('ruins', () => {
  // A two-high ruined wall on grass, with paving below it.
  const ruin = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 3 || y === 4
        ? '....####............'
        : y === 5
          ? '....qqqq............'
          : '....................',
    ),
  );

  it('draws ruined walls with the dungeon wall top over its face, on grass', () => {
    const art = roomArt(ruin, 'ruins');
    const at = (x: number, y: number) => art.ground.filter((t) => t.x === x * 16 && t.y === y * 16);
    expect(at(5, 3)).toEqual([
      { frame: FOREST_FRAMES.grass, x: 80, y: 48 },
      { frame: DUNGEON_FRAMES.top, x: 80, y: 48, sheet: 'dungeon' },
    ]);
    expect(at(5, 4)[1]).toEqual({ frame: DUNGEON_FRAMES.face, x: 80, y: 64, sheet: 'dungeon' });
  });

  it('draws paving from the dungeon floor, cracked here and there', () => {
    const art = roomArt(ruin, 'ruins');
    const paving = art.ground.filter((t) => t.y === 80 && t.x >= 64 && t.x < 128);
    expect(paving.every((t) => t.sheet === 'dungeon')).toBe(true);
    for (const t of paving) {
      expect([DUNGEON_FRAMES.floor, ...DUNGEON_FRAMES.cracks]).toContain(t.frame);
    }
  });
});

describe('mountains', () => {
  // A cliff four rows deep across the top, then open dirt.
  const valley = parseRoom(
    Array.from({ length: 10 }, (_, y) => (y < 4 ? 'FFFFFFFFFFFFFFFFFFFF' : '....................')),
  );

  it('draws cliffs by depth: rock face at the foot, then the ledge, then the grassy top', () => {
    const [face, faceMid, faceTop, ledge, top] = MOUNTAIN_FRAMES.cliff;
    expect(cliffFrame(valley, 0, 3)).toBe(face?.[0]);
    expect(cliffFrame(valley, 1, 3)).toBe(face?.[1]); // alternating columns
    expect(cliffFrame(valley, 0, 2)).toBe(faceMid?.[0]);
    expect(cliffFrame(valley, 0, 1)).toBe(faceTop?.[0]);
    expect(cliffFrame(valley, 0, 0)).toBe(ledge?.[0]);
    // Deeper than the face and ledge: the top (a wall running on down to the room's edge).
    const plateau = parseRoom(Array.from({ length: 10 }, () => 'F...................'));
    expect(cliffFrame(plateau, 0, 2)).toBe(top?.[0]);
  });

  it('draws dirt with cliffs on the mountain sheet, and no forest tops', () => {
    const art = roomArt(valley, 'mountains');
    expect(art.over).toEqual([]);
    expect(art.ground.every((t) => t.sheet === 'mountain')).toBe(true);
    const dirt = art.ground.filter((t) => t.y >= 64).map((t) => t.frame);
    expect(dirt).toContain(MOUNTAIN_FRAMES.dirt);
    expect(dirt).toContain(MOUNTAIN_FRAMES.dirtPatch);
    // The volcano edge is drawn the same way (the scene adds its tint).
    expect(roomArt(valley, 'volcano')).toEqual(art);
  });

  it('every mountain frame has art', () => {
    const png = pngAlpha(`${process.cwd()}/public/assets/tiles/mountain.png`);
    const frames = [
      MOUNTAIN_FRAMES.dirt,
      MOUNTAIN_FRAMES.dirtPatch,
      ...MOUNTAIN_FRAMES.cliff.flat(),
    ];
    for (const f of frames) {
      const x = (f % MOUNTAIN_COLUMNS) * 16;
      const y = Math.floor(f / MOUNTAIN_COLUMNS) * 16;
      expect(hasPixels(png, x, y, 16, 16), `frame ${f}`).toBe(true);
    }
  });

  it('draws boulders and rocks from the mountain sheet in the mountains only', () => {
    expect(propSheet('boulder', 'mountains')).toBe('mountain');
    expect(propSheet('rock', 'volcano')).toBe('mountain');
    expect(propSheet('pine', 'mountains')).toBe('forest');
    expect(propSheet('boulder', 'forest')).toBe('forest');
    // Same size as the forest's, so the same anchors fit.
    for (const [k, r] of Object.entries(MOUNTAIN_PROP_REGIONS)) {
      const forest = PROP_REGIONS[k as keyof typeof PROP_REGIONS];
      expect([r.w, r.h]).toEqual([forest.w, forest.h]);
      const png = pngAlpha(`${process.cwd()}/public/assets/tiles/mountain.png`);
      expect(hasPixels(png, r.x, r.y, r.w, r.h)).toBe(true);
    }
  });

  it('places the cave by its top-left cell', () => {
    expect(propDraw('cave', 8, 1)).toEqual({ prop: 'cave', x: 152, y: 64 });
  });
});

describe('secrets', () => {
  // A false wall (h) in a forest wall, with a hole (o) behind it, and a stone on a hole (Q).
  const secret = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 2
        ? 'FohFF...............'
        : y === 5
          ? '......Q.............'
          : y < 4
            ? 'FFFFF...............'
            : '....................',
    ),
  );
  const at = (art: ReturnType<typeof roomArt>, x: number, y: number) =>
    art.ground.filter((t) => t.x === x * 16 && t.y === y * 16);

  it('draws a false wall as the wall around it until it is opened', () => {
    const closed = roomArt(secret);
    expect(at(closed, 2, 2)).toHaveLength(2); // grass, then the forest wall
    const open = roomArt(secret, 'forest', (x, y) => x === 2 && y === 2);
    expect(at(open, 2, 2)).toEqual([{ frame: FOREST_FRAMES.grass, x: 32, y: 32 }]);
  });

  it('grows no tree top over a hole', () => {
    // A forest wall along row 3, with open ground above it and a hole at (1, 2).
    const edge = parseRoom(
      Array.from({ length: 10 }, (_, y) =>
        y === 2
          ? '.o..................'
          : y === 3
            ? 'FFFF................'
            : '....................',
      ),
    );
    const tops = roomArt(edge).over.map((t) => t.x / 16);
    expect(tops).toEqual([0, 2, 3]); // every wall cell but the one under the hole
  });

  it('draws holes from the mountain sheet, in any region', () => {
    for (const region of ['forest', 'village', 'ruins'] as const) {
      const art = roomArt(secret, region);
      expect(at(art, 1, 2)).toEqual([
        { frame: MOUNTAIN_FRAMES.hole, x: 16, y: 32, sheet: 'mountain' },
      ]);
      expect(at(art, 6, 5)[0]?.frame).toBe(MOUNTAIN_FRAMES.hole);
    }
  });
});

describe('breakables', () => {
  const room = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 3 ? 'xx..t..R............' : '....................',
    ),
  );

  it('draws cracked walls as rubble until smashed, then as ground', () => {
    const closed = roomArt(room, 'mountains');
    const at = (art: ReturnType<typeof roomArt>, x: number) =>
      art.ground.filter((t) => t.x === x * 16 && t.y === 48);
    expect(at(closed, 0)[1]).toEqual({
      frame: MOUNTAIN_FRAMES.rubble[0],
      x: 0,
      y: 48,
      sheet: 'mountain',
    });
    expect(at(closed, 1)[1]?.frame).toBe(MOUNTAIN_FRAMES.rubble[1]);
    const smashed = roomArt(room, 'mountains', (x, y) => y === 3 && x === 0);
    expect(at(smashed, 0)).toHaveLength(1); // just the dirt
  });

  it('leaves out a burned thorn bush and a smashed boulder', () => {
    expect(roomArt(room).props.map((p) => p.prop)).toEqual(['thorns', 'boulder']);
    const gone = roomArt(room, 'forest', (x, y) => y === 3 && (x === 4 || x === 7));
    expect(gone.props).toEqual([]);
    expect(THORN_TINT).toBeGreaterThan(0);
  });
});

describe('thorns in a dungeon', () => {
  // A closet whose doorway (column 5, row 4) is a thorn bush, and another bush lower down.
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 4
        ? '##..#t..............'
        : y === 6
          ? '##.t................'
          : y < 2
            ? '####################'
            : '##..................',
    ),
  );

  it('draws the bushes over the floor, top to bottom, until they have burned', () => {
    const art = dungeonArt(r);
    expect(art.props).toEqual([propDraw('thorns', 5, 4), propDraw('thorns', 3, 6)]);
    expect(art.ground).toHaveLength(200);
    expect(dungeonFrame(r, 5, 4)).not.toBe(DUNGEON_FRAMES.top);
    expect(dungeonArt(r, (x, y) => x === 5 && y === 4).props).toEqual([propDraw('thorns', 3, 6)]);
  });
});

describe('mixTint', () => {
  it('multiplies each channel, so white changes nothing', () => {
    expect(mixTint(0xffffff, 0x9cae8c)).toBe(0x9cae8c);
    expect(mixTint(THORN_TINT, 0xffffff)).toBe(THORN_TINT);
    expect(mixTint(0x808080, 0x808080)).toBe(0x404040);
    expect(mixTint(0xff0000, 0x00ff00)).toBe(0x000000);
  });
});

describe('crystal switches and gates in a dungeon', () => {
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 0
        ? '###z################'
        : y === 1
          ? '####################'
          : y === 9
            ? '#########gg#########'
            : '##..................',
    ),
  );
  const powered = (x: number, y: number) => x === 3 && y === 0;

  it('a switch is the orb in the wall; a gate is barred until opened', () => {
    expect(dungeonFrame(r, 3, 0)).toBe(DUNGEON_FRAMES.orb);
    expect(dungeonFrame(r, 9, 9)).toBe(DUNGEON_FRAMES.gate);
    expect(dungeonFrame(r, 9, 9, true)).not.toBe(DUNGEON_FRAMES.gate);
  });

  it('draws a gate opened on its own as open, with the switch still dim', () => {
    const art = dungeonArt(r, (x, y) => x === 9 && y === 9);
    expect(art.ground.find((t) => t.x === 144 && t.y === 144)?.frame).not.toBe(DUNGEON_FRAMES.gate);
    expect(art.ground.find((t) => t.x === 160 && t.y === 144)?.frame).toBe(DUNGEON_FRAMES.gate);
    expect(art.ground.filter((t) => t.dim)).toHaveLength(1);
  });

  it('draws a switch dim until powered, and its gates open once it is', () => {
    const before = dungeonArt(r);
    expect(before.ground.filter((t) => t.dim)).toEqual([
      { frame: DUNGEON_FRAMES.orb, x: 48, y: 0, dim: true },
    ]);
    const gateBefore = before.ground.find((t) => t.x === 144 && t.y === 144);
    expect(gateBefore?.frame).toBe(DUNGEON_FRAMES.gate);
    const after = dungeonArt(r, powered);
    expect(after.ground.filter((t) => t.dim)).toEqual([]);
    expect(after.ground.find((t) => t.x === 144 && t.y === 144)?.frame).not.toBe(
      DUNGEON_FRAMES.gate,
    );
    expect(SWITCH_DIM).toBeLessThan(0xffffff);
  });
});

describe('rubble in a dungeon', () => {
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 1 ? '#########xx#########' : y === 0 ? '#########..#########' : '##..................',
    ),
  );

  it('draws the mountain set’s rubble over the floor, until the Axe smashes it', () => {
    const rubble = dungeonArt(r).ground.filter((t) => t.sheet === 'mountain');
    expect(rubble).toEqual([
      { frame: MOUNTAIN_FRAMES.rubble[1], x: 144, y: 16, sheet: 'mountain' },
      { frame: MOUNTAIN_FRAMES.rubble[0], x: 160, y: 16, sheet: 'mountain' },
    ]);
    const smashed = dungeonArt(r, (x, y) => y === 1 && x === 9).ground.filter(
      (t) => t.sheet === 'mountain',
    );
    expect(smashed).toHaveLength(1);
  });
});

describe('coveredCells: where the art hides the ground', () => {
  const OPEN = '....................';
  const at = (rows: Record<number, string>) =>
    parseRoom(Array.from({ length: 10 }, (_, y) => rows[y] ?? OPEN));
  const sorted = (cells: ReadonlySet<string>) =>
    [...cells].sort((a, b) => {
      const [ax = 0, ay = 0] = a.split(',').map(Number);
      const [bx = 0, by = 0] = b.split(',').map(Number);
      return ay - by || ax - bx;
    });

  it('a pine hides the 3×3 cells round its trunk: its canopy and branches', () => {
    const covered = coveredCells(roomArt(at({ 5: '.....T..............' })));
    expect(sorted(covered)).toEqual([
      '4,3',
      '5,3',
      '6,3',
      '4,4',
      '5,4',
      '6,4',
      '4,5',
      '5,5',
      '6,5',
    ]);
  });

  it('a rock hides only its own cell; a boulder its 2×2', () => {
    expect(sorted(coveredCells(roomArt(at({ 5: '.....r..............' }))))).toEqual(['5,5']);
    expect(sorted(coveredCells(roomArt(at({ 5: '.....R..............' }))))).toEqual([
      '5,5',
      '6,5',
      '5,6',
      '6,6',
    ]);
  });

  it('tree tops hang over the row above a forest wall', () => {
    const covered = coveredCells(
      roomArt(at({ 8: 'FFF.................', 9: 'FFF.................' })),
    );
    expect(sorted(covered)).toEqual(['0,7', '1,7', '2,7']);
  });

  it('art at the edge of the room is cut to the room', () => {
    const covered = coveredCells(roomArt(at({ 1: 'T...................' })));
    expect(sorted(covered)).toEqual(['0,0', '1,0', '0,1', '1,1']);
  });

  it('open ground with nothing on it is not covered; a smashed boulder hides nothing', () => {
    expect(coveredCells(roomArt(at({}))).size).toBe(0);
    const r = at({ 5: '.....R..............' });
    expect(coveredCells(roomArt(r, 'forest', () => true)).size).toBe(0);
  });
});

describe('eye statues in a dungeon', () => {
  const r = parseRoom(
    Array.from({ length: 10 }, (_, y) =>
      y === 0 ? '###y################' : '#..................#',
    ),
  );
  const at = (art: ReturnType<typeof dungeonArt>) =>
    art.ground.find((t) => t.x === 48 && t.y === 0);

  it('is drawn as the pillar orb, glowing red while it watches', () => {
    expect(at(dungeonArt(r))).toEqual({ frame: DUNGEON_FRAMES.orb, x: 48, y: 0, tint: EYE_TINT });
  });

  it('dim once shut', () => {
    expect(at(dungeonArt(r, (x, y) => x === 3 && y === 0))).toEqual({
      frame: DUNGEON_FRAMES.orb,
      x: 48,
      y: 0,
      dim: true,
    });
  });
});
