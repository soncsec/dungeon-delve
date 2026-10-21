import type Phaser from 'phaser';
import { ASSETS } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';
import type { EnemyKind } from '../logic/enemies';
import type { Facing } from '../logic/hero';
import type { ItemId } from '../logic/inventory';
import type { GameScene, GameSnapshot, PickupKind } from '../scenes/GameScene';
import type { InventoryScene } from '../scenes/InventoryScene';

/**
 * Test-only hook for Playwright (ADR-006). It is loaded only in the e2e build
 * (`vite build --mode e2e`), so the build players get never includes it.
 * Add controls here as the game grows (spawn an enemy, skip a level, ...).
 */
export interface TestHook {
  /** The key of the scene that is running, or null while loading. */
  scene(): string | null;
  snapshot(): GameSnapshot | null;
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
  /** Set the mana level. */
  setMana(current: number): void;
  /** Give Jarrett a small key for the map he's on. */
  giveKey(): void;
  /** Jump to a room on the map he's on. */
  goToRoom(col: number, row: number): void;
  /** Set his hearts (in half hearts) and gems. */
  setHealth(points: number): void;
  setGems(gems: number): void;
  /** Each frame's work (update and render) in ms since the last reset, and Phaser's measured fps. */
  frameTimes(reset?: boolean): { workMs: number[]; fps: number };
  /** Give Jarrett an item (it goes in the inventory). */
  giveItem(item: ItemId): void;
  /** What the inventory screen shows, or null when it isn't open. */
  inventory(): { cursor: number; slots: Record<string, string> } | null;
  /** What the status bar shows: each heart's state, and the gem count text. */
  hud(): {
    hearts: ('full' | 'half' | 'empty')[];
    gems: string;
    weapon: string;
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
    setMana: (current) => gameScene(game).testSetMana(current),
    giveKey: () => gameScene(game).testGiveKey(),
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
    missingTextures: () => ASSETS.filter((a) => !game.textures.exists(a.key)).map((a) => a.key),
  };
}

function gameScene(game: Phaser.Game): GameScene {
  const s = game.scene.getScene('Game') as GameScene | null;
  if (!s || !game.scene.isActive('Game')) throw new Error('game scene is not running');
  return s;
}
