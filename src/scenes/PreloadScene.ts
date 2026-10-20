import Phaser from 'phaser';
import { ASSETS, animKey } from '../assets/manifest';

/**
 * Loads every asset in the manifest and makes its animations, then starts the
 * game, or the asset preview when the page is opened with ?scene=preview.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    for (const a of ASSETS) {
      this.load.spritesheet(a.key, a.path, {
        frameWidth: a.frameWidth,
        frameHeight: a.frameHeight,
      });
    }
  }

  create(): void {
    for (const a of ASSETS) {
      for (const an of a.anims) {
        this.anims.create({
          key: animKey(a.key, an.name),
          frames: this.anims.generateFrameNumbers(a.key, { frames: [...an.frames] }),
          frameRate: an.frameRate,
          repeat: an.loop ? -1 : 0,
        });
      }
    }
    const wanted = new URLSearchParams(window.location.search).get('scene');
    this.scene.start(wanted === 'preview' ? 'AssetPreview' : 'Game');
  }
}
