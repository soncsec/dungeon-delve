import type Phaser from 'phaser';
import { ASSETS } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';
import type { EnemyKind } from '../logic/enemies';
import type { Facing } from '../logic/hero';
import type { ItemId } from '../logic/inventory';
import type { GameScene, GameSnapshot, PickupKind } from '../scenes/GameScene';
import type { InventoryScene } from '../scenes/InventoryScene';
import type { TitleScene } from '../scenes/TitleScene';
import type { ShopScene } from '../scenes/ShopScene';

/**
 * Test-only hook for Playwright (ADR-006). It is loaded only in the e2e build
 * (`vite build --mode e2e`), so the build players get never includes it.
 * Add controls here as the game grows (spawn an enemy, skip a level, ...).
 */
export interface TestHook {
  /** The key of the scene that is running, or null while loading. */
  scene(): string | null;
  snapshot(): GameSnapshot | null;
  /** What the title screen's menu shows, or null when it isn't running. */
  title(): { screen: 'menu' | 'confirm'; options: string[]; cursor: number } | null;
  /** The asset group the preview scene shows, or null when it isn't running. */
  previewGroup(): string | null;
  /** Texture keys that failed to load or are missing. */
  missingTextures(): string[];
  /** Put the hero's feet at a room position (room pixels), optionally facing a way. */
  placeHero(x: number, y: number, facing?: Facing): void;
  /** An enemy with its feet at a room position. */
  spawnEnemy(kind: EnemyKind, x: number, y: number): void;
  /** A gem, small heart or potion at a room position. */
  spawnPickup(kind: PickupKind, x: number, y: number): void;
  /** Remove every enemy and enemy shot in the current room. */
  clearEnemies(): void;
  /** An enemy shot from a room position, flying along (dx, dy). */
  fireEnemyShot(x: number, y: number, dx: number, dy: number): void;
  /** Stop enemies moving and shooting (true), or let them go again; knockback still moves them. */
  holdEnemies(hold: boolean): void;
  /** Every enemy's shooting timer runs out now: each one that shoots (or puffs) does so at its next step. */
  enemiesShootNow(): void;
  /** The next defeated enemy drops this, instead of the random roll. */
  nextDrop(drop: 'gem' | 'heart'): void;
  /** Set the mana level. */
  setMana(current: number): void;
  /** Change one cell of the current room's text, e.g. to try a thorn bush (t) not yet placed. */
  setCell(x: number, y: number, ch: string): void;
  /** Set the boss's health (at least 1; it still needs a hit to be beaten). */
  setBossHealth(health: number): void;
  /** Give Jarrett a small key for the map he's on. */
  giveKey(): void;
  /** Count dungeon n's shard as found (as picking it up does). */
  takeShard(dungeon: number): void;
  /** Turn every page of the talk under way, as pressing Space through it does (gifts, save and all). */
  finishTalk(): void;
  /** Bump into a cell of the current room, as walking into it does (opens a chest, or a door with a key). */
  bump(x: number, y: number): void;
  /** Jump to a room on the map he's on. */
  goToRoom(col: number, row: number): void;
  /** Set his hearts (in half hearts) and gems. */
  setHealth(points: number): void;
  setGems(gems: number): void;
  /** Each frame's work (update and render) in ms since the last reset, and Phaser's measured fps. */
  frameTimes(reset?: boolean): { workMs: number[]; fps: number };
  /** Give Jarrett an item (it goes in the inventory). */
  giveItem(item: ItemId): void;
  /** What the shop screen shows, or null when it isn't open. */
  shop(): {
    cursor: number;
    items: { name: string; price: number; owned: boolean }[];
    gems: number;
    message: string;
  } | null;
  /** What the inventory screen shows, or null when it isn't open. */
  inventory(): {
    cursor: number;
    slots: Record<string, string>;
    map: {
      name: string;
      rooms: { x: number; y: number; current: boolean; boss: boolean }[];
    } | null;
  } | null;
  /** What the status bar shows: each heart's state, and the gem count text. */
  hud(): {
    hearts: ('full' | 'half' | 'empty')[];
    gems: string;
    weapon: string;
    /** The mana bar's full width (0 until he knows a spell), and its blue fill's. */
    manaBar: number;
    manaWidth: number;
    potions: { health: string; mana: string };
    keys: string | null;
  };
}

/** Frames kept for `frameTimes` (about 30 s at 60 fps). */
const FRAME_RECORD = 1800;

declare global {
  interface Window {
    __game?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
  // Time each frame's work: from the start of the step to the end of rendering.
  const work: number[] = [];
  let stepStart = 0;
  game.events.on('prestep', () => {
    stepStart = performance.now();
  });
  game.events.on('postrender', () => {
    work.push(performance.now() - stepStart);
    if (work.length > FRAME_RECORD) work.shift();
  });

  window.__game = {
    scene: () => game.scene.getScenes(true)[0]?.scene.key ?? null,
    snapshot: () => {
      const s = game.scene.getScene('Game') as GameScene | null;
      return s && game.scene.isActive('Game') ? s.snapshot() : null;
    },
    title: () => {
      const s = game.scene.getScene('Title') as TitleScene | null;
      return s && game.scene.isActive('Title') ? s.shows() : null;
    },
    previewGroup: () => {
      const s = game.scene.getScene('AssetPreview') as AssetPreviewScene | null;
      return s && game.scene.isActive('AssetPreview') ? s.currentGroup() : null;
    },
    placeHero: (x, y, facing) => gameScene(game).placeHero(x, y, facing),
    spawnEnemy: (kind, x, y) => gameScene(game).testSpawnEnemy(kind, x, y),
    spawnPickup: (kind, x, y) => gameScene(game).testSpawnPickup(kind, x, y),
    clearEnemies: () => gameScene(game).testClearEnemies(),
    fireEnemyShot: (x, y, dx, dy) => gameScene(game).testFireEnemyShot(x, y, dx, dy),
    holdEnemies: (hold) => gameScene(game).testHoldEnemies(hold),
    enemiesShootNow: () => gameScene(game).testEnemiesShootNow(),
    nextDrop: (drop) => gameScene(game).testNextDrop(drop),
    setMana: (current) => gameScene(game).testSetMana(current),
    setBossHealth: (health) => gameScene(game).testSetBossHealth(health),
    setCell: (x, y, ch) => gameScene(game).testSetCell(x, y, ch),
    giveKey: () => gameScene(game).testGiveKey(),
    takeShard: (n) => gameScene(game).testTakeShard(n),
    finishTalk: () => gameScene(game).testFinishTalk(),
    bump: (x, y) => gameScene(game).testBump(x, y),
    goToRoom: (col, row) => gameScene(game).testGoToRoom(col, row),
    setHealth: (points) => gameScene(game).testSetHealth(points),
    setGems: (gems) => gameScene(game).testSetGems(gems),
    frameTimes: (reset) => {
      if (reset) work.length = 0;
      return { workMs: [...work], fps: game.loop.actualFps };
    },
    giveItem: (item) => gameScene(game).testGiveItem(item),
    inventory: () => {
      const s = game.scene.getScene('Inventory') as InventoryScene | null;
      return s && game.scene.isActive('Inventory') ? s.shows() : null;
    },
    hud: () => gameScene(game).hudShows(),
    shop: () => {
      const s = game.scene.getScene('Shop') as ShopScene | null;
      return s && game.scene.isActive('Shop') ? s.shows() : null;
    },
    missingTextures: () => ASSETS.filter((a) => !game.textures.exists(a.key)).map((a) => a.key),
  };
}

function gameScene(game: Phaser.Game): GameScene {
  const s = game.scene.getScene('Game') as GameScene | null;
  if (!s || !game.scene.isActive('Game')) throw new Error('game scene is not running');
  return s;
}
