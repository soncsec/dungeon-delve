import Phaser from 'phaser';
import { KEY_COLOURS, KEY_PIXELS } from '../assets/keyArt';
import { ASSETS, animKey } from '../assets/manifest';
import type { PropKind } from '../logic/room';
import { PROP_REGIONS, PROP_SHEET } from '../logic/tiles';

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
    // Props span several cells, so each gets its own frame on its sheet.
    for (const [name, r] of Object.entries(PROP_REGIONS)) {
      this.textures.get(PROP_SHEET[name as PropKind]).add(`prop:${name}`, 0, r.x, r.y, r.w, r.h);
    }

    // The small key is drawn in code: the art pack has none (owner, 2026-10-20).
    const g = this.make.graphics({}, false);
    KEY_PIXELS.forEach((row, y) => {
      Array.from(row).forEach((ch, x) => {
        const colour = KEY_COLOURS[ch];
        if (colour === undefined) return;
        g.fillStyle(colour).fillRect(x, y, 1, 1);
      });
    });
    g.generateTexture('key', KEY_PIXELS[0]?.length ?? 0, KEY_PIXELS.length);
    g.destroy();

    const wanted = new URLSearchParams(window.location.search).get('scene');
    this.scene.start(wanted === 'preview' ? 'AssetPreview' : 'Game');
  }
}
