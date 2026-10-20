import Phaser from 'phaser';
import { ASSETS, animKey } from '../assets/manifest';
import { PROP_REGIONS } from '../logic/tiles';

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
    // Props span several cells, so each gets its own frame on the forest sheet.
    const forest = this.textures.get('forest');
    for (const [name, r] of Object.entries(PROP_REGIONS))
      forest.add(`prop:${name}`, 0, r.x, r.y, r.w, r.h);

    const wanted = new URLSearchParams(window.location.search).get('scene');
    this.scene.start(wanted === 'preview' ? 'AssetPreview' : 'Game');
  }
}
