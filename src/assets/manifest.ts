/**
 * Every image the game loads, with its frame grid and named animations.
 * All art is from the Ansimuz Legacy Collection (CC0); see CREDITS.md.
 * tests/unit/manifest.test.ts checks these numbers against the real PNG files.
 */
export type AssetGroup = 'characters' | 'enemies' | 'bosses' | 'tiles' | 'effects' | 'items';

export const ASSET_GROUPS: readonly AssetGroup[] = [
  'characters',
  'enemies',
  'bosses',
  'tiles',
  'effects',
  'items',
];

/** A named animation: frame indexes into the sheet's grid (row by row). */
export interface Anim {
  name: string;
  frames: readonly number[];
  /** Frames per second. */
  frameRate: number;
  loop: boolean;
}

/** A sheet cut into a grid of equal frames. Tilesets are sheets with 16×16 frames. */
export interface SheetAsset {
  key: string;
  group: AssetGroup;
  /** Path under public/, e.g. assets/characters/jarrett.png */
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  anims: readonly Anim[];
}

const sheet = (
  group: AssetGroup,
  key: string,
  frameWidth: number,
  frameHeight: number,
  columns: number,
  rows: number,
  anims: readonly Anim[] = [],
): SheetAsset => ({
  key,
  group,
  path: `assets/${group}/${key}.png`,
  frameWidth,
  frameHeight,
  columns,
  rows,
  anims,
});

const anim = (name: string, frames: readonly number[], frameRate: number, loop = true): Anim => ({
  name,
  frames,
  frameRate,
  loop,
});

const range = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => from + i);

/** Top-down walkers: 4 frames each, rows facing down, right (mirrored for left), up. */
const walker = (key: string, frameRate: number): SheetAsset =>
  sheet('characters', key, 32, 32, 4, 3, [
    anim('walk-down', range(0, 4), frameRate),
    anim('walk-right', range(4, 4), frameRate),
    anim('walk-up', range(8, 4), frameRate),
  ]);

/** Gems: 7-frame spins on a 16×16 grid, one colour every 8 columns from column 4, row 2. */
const GEM_COLOURS = ['teal', 'orange', 'red', 'yellow', 'pink', 'blue'] as const;
const GEMS_COLUMNS = 53;

export const ASSETS: readonly SheetAsset[] = [
  // Jarrett: TinyRPG "Guy"; Princess Kira: TinyRPG "PirateGirl" (owner 2026-10-20).
  walker('jarrett', 8),
  walker('kira', 6),
  // Walker, the guide: TinyRPG "Blond_kid" with paler blonde hair (owner 2026-10-20).
  walker('walker', 6),
  // The village shopkeeper: "Guy" with grey hair and a red shirt (owner 2026-10-21).
  walker('shopkeeper', 6),

  // The TinyRPG top-down robot: one sheet per facing, 4 frames of 20×16. The side sheet faces left.
  sheet('enemies', 'robot-front', 20, 16, 4, 1, [anim('walk', range(0, 4), 8)]),
  sheet('enemies', 'robot-side', 20, 16, 4, 1, [anim('walk', range(0, 4), 8)]),
  sheet('enemies', 'robot-back', 20, 16, 4, 1, [anim('walk', range(0, 4), 8)]),

  // M2.6 enemies (Gothicvania): side views facing right, mirrored to face left.
  sheet('enemies', 'bird', 32, 32, 7, 1, [anim('fly', range(0, 7), 12)]),
  sheet('enemies', 'eye', 48, 48, 8, 1, [anim('fly', range(0, 8), 10)]),
  sheet('enemies', 'ghost', 64, 64, 6, 1, [anim('fly', range(0, 6), 8)]),
  sheet('enemies', 'wolf', 56, 32, 4, 1, [anim('run', range(0, 4), 10)]),
  // M5.4: the marsh's snake, the ruins' mushroom, and the toad of the marsh and mountains.
  sheet('enemies', 'snake', 27, 20, 4, 1, [anim('crawl', range(0, 4), 8)]),
  sheet('enemies', 'mushroom', 41, 30, 10, 1, [anim('walk', range(0, 10), 10)]),
  sheet('enemies', 'toad', 42, 38, 10, 1, [anim('hop', range(0, 10), 12)]),

  // Bosses (TinyRPG battle sprites), swaying where they stand: the Treant (dungeon 1),
  // the Giant Frog (dungeon 2) and the Mummy (dungeon 3).
  sheet('bosses', 'treant', 80, 84, 4, 1, [anim('sway', range(0, 4), 6)]),
  sheet('bosses', 'frog', 63, 68, 6, 1, [anim('sway', range(0, 6), 8)]),
  // The Mummy (dungeon 3), its loose wrappings stirring.
  sheet('bosses', 'mummy', 69, 83, 6, 1, [anim('sway', range(0, 6), 7)]),
  // The Ogre (dungeon 4), a two-headed giant with a club.
  sheet('bosses', 'ogre', 128, 128, 5, 1, [anim('sway', range(0, 5), 6)]),
  // The Centaur (dungeon 5): 4 frames of 112×144; its art faces left.
  sheet('bosses', 'centaur', 112, 144, 4, 1, [anim('sway', range(0, 4), 6)]),
  // The Witch (dungeon 6): 5 frames of 55×93, floating.
  sheet('bosses', 'witch', 55, 93, 5, 1, [anim('sway', range(0, 5), 7)]),
  // The Vampire (dungeon 7): 4 frames of 121×110; its art faces left.
  sheet('bosses', 'vampire', 121, 110, 4, 1, [anim('sway', range(0, 4), 6)]),
  // The Dragon (dungeon 8): frames of 144×64, its art facing left. Idle; rearing, then breathing
  // fire (the breath sheet: frames 0-2 rear, 3-6 the flame); and its tail lash.
  sheet('bosses', 'dragon', 144, 64, 6, 1, [anim('sway', range(0, 6), 8)]),
  sheet('bosses', 'dragon-breath', 144, 64, 7, 1, [
    anim('rear', range(0, 3), 5, false),
    anim('breathe', range(3, 4), 10),
  ]),
  sheet('bosses', 'dragon-tail', 144, 64, 8, 1, [anim('lash', range(0, 8), 12, false)]),

  // Overworld tiles and props on a 16×16 grid (trees and rocks span several cells).
  sheet('tiles', 'forest', 16, 16, 27, 11),
  // The forest walls for village rooms: their teal edge shadows turned village green (tools/art/village_edges.py).
  sheet('tiles', 'forest-village', 16, 16, 27, 11),
  // The marsh's ponds: the Overworld sheet's island shores, used inside out (tools/art/marsh_water.py).
  sheet('tiles', 'marsh-water', 16, 16, 11, 1),
  // The mountains: cliffs, dirt, rocks and a cave entrance (Tiny RPG Mountain, unchanged).
  sheet('tiles', 'mountain', 16, 16, 23, 8),
  sheet('tiles', 'town', 16, 16, 24, 13),
  // Dungeon tiles: the pack's example dungeon (preview-simple-dungeon-crawler-set1.png), used
  // unchanged as a 16×16 sheet; it has the wall-top stones the tileset sheet lacks.
  sheet('tiles', 'dungeon', 16, 16, 19, 15),

  // Sword swing (drawn over a walk frame), hit spark, and the puff an enemy vanishes in.
  sheet('effects', 'slash-horizontal', 65, 40, 5, 1, [anim('play', range(0, 5), 20, false)]),
  sheet('effects', 'slash-upward', 52, 56, 5, 1, [anim('play', range(0, 5), 20, false)]),
  sheet('effects', 'hit', 31, 32, 3, 1, [anim('play', range(0, 3), 15, false)]),
  sheet('effects', 'puff', 64, 64, 7, 1, [anim('play', range(0, 7), 14, false)]),
  // The Fireball spell in flight (points right; rotated to its direction).
  sheet('effects', 'fire-ball', 52, 29, 3, 1, [anim('fly', range(0, 3), 12)]),
  // The snake's venom.
  sheet('effects', 'snake-spit', 14, 5, 1, 1),
  // The Lightning bolt: a crackling ball with sparks trailing behind (it points left).
  sheet('effects', 'bolt', 48, 32, 4, 1, [anim('fly', range(0, 4), 14)]),
  // The flying eye's shot.
  sheet('effects', 'enemy-shot', 16, 16, 2, 1, [anim('fly', range(0, 2), 8)]),
  // The Vampire's dark shots: the same orb recoloured purple (tools/art/dark_shot.py).
  sheet('effects', 'dark-shot', 16, 16, 2, 1, [anim('fly', range(0, 2), 8)]),
  // The Ward: a bubble that shimmers while it is up, then breaks up as it drops.
  sheet('effects', 'ward', 51, 47, 8, 1, [
    anim('up', range(0, 4), 8),
    anim('break', range(4, 4), 10, false),
  ]),
  // The Centaur's lightning: frame 0 is the dark mark where a bolt will fall; 2-11 the strike.
  sheet('effects', 'electro-shock', 96, 96, 12, 1, [anim('strike', range(2, 10), 14, false)]),
  // A spark barrier: tiles cut from the pack's waveform shot (tools/art/spark_barrier.py).
  // Each frame is a strip two tiles wide, so a cell plays its left or right half.
  sheet('effects', 'spark', 16, 16, 8, 1, [
    anim('left', [0, 2, 4, 6], 10),
    anim('right', [1, 3, 5, 7], 10),
  ]),

  // Pickups: spinning gems (money) and the dungeon-objects sheet (hearts, potions, chests).
  sheet(
    'items',
    'gems',
    16,
    16,
    GEMS_COLUMNS,
    11,
    GEM_COLOURS.map((colour, i) => anim(colour, range(2 * GEMS_COLUMNS + 4 + 8 * i, 7), 10)),
  ),
  sheet('items', 'objects', 16, 16, 17, 9),

  // Weapons: the throwing dagger (points right; rotated in flight) and the sword icon for the status bar.
  sheet('items', 'dagger', 32, 32, 1, 1),
  sheet('items', 'sword-icon', 16, 16, 1, 1),
  // The Mana Brew: the pack's potion with its liquid recoloured blue (tools/art/mana_brew.py).
  sheet('items', 'mana-brew', 16, 16, 1, 1),
  // A shard of the Star of Power: a crystal from Gothicvania's Rocky Pass.
  sheet('items', 'shard', 25, 25, 1, 1),
  // The Mana Crystal (Bog Grotto's prize): another Rocky Pass crystal, recoloured blue
  // by tools/art/mana_crystal.py.
  sheet('items', 'mana-crystal', 26, 20, 1, 1),
];

/** Animation key for one of a sheet's named animations. */
export const animKey = (sheetKey: string, animName: string): string => `${sheetKey}:${animName}`;

/** Single frames on the objects sheet (index = row × 17 + column). */
export const OBJECT_FRAMES = {
  heart: 3 * 17 + 15,
  smallHeart: 7 * 17 + 14,
  potion: 3 * 17 + 13,
  chest: 5 * 17 + 3,
  pot: 5 * 17 + 7,
  /** A pushable stone block. */
  stone: 7 * 17 + 9,
} as const;
