import type Phaser from 'phaser';
import { ASSETS } from '../assets/manifest';
import type { AssetPreviewScene } from '../scenes/AssetPreviewScene';
import type { EnemyKind } from '../logic/enemies';
import type { Facing } from '../logic/hero';
import type { GameScene, GameSnapshot, PickupKind } from '../scenes/GameScene';

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
  /** Stop enemies moving and shooting (true), or let them go again; knockback still moves them. */
  holdEnemies(hold: boolean): void;
  /** Set the mana level. */
  setMana(current: number): void;
  /** What the status bar shows: each heart's state, and the gem count text. */
  hud(): {
    hearts: ('full' | 'half' | 'empty')[];
    gems: string;
    weapon: string;
    manaWidth: number;
    potions: { health: string; mana: string };
  };
}

declare global {
  interface Window {
    __game?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game): void {
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
    holdEnemies: (hold) => gameScene(game).testHoldEnemies(hold),
    setMana: (current) => gameScene(game).testSetMana(current),
    hud: () => gameScene(game).hudShows(),
    missingTextures: () => ASSETS.filter((a) => !game.textures.exists(a.key)).map((a) => a.key),
  };
}

function gameScene(game: Phaser.Game): GameScene {
  const s = game.scene.getScene('Game') as GameScene | null;
  if (!s || !game.scene.isActive('Game')) throw new Error('game scene is not running');
  return s;
}
