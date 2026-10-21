import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH, HUD } from './config/tuning';
import { installTouchControls } from './input/TouchControls';
import { integerZoom } from './logic/scaling';
import { isTouchDevice } from './platform/touch';
import { AssetPreviewScene } from './scenes/AssetPreviewScene';
import { GameScene } from './scenes/GameScene';
import { InventoryScene } from './scenes/InventoryScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';

const zoomForWindow = (): number =>
  integerZoom(window.innerWidth, window.innerHeight, GAME_WIDTH, GAME_HEIGHT);

// Wait for the status bar font, so the first frame doesn't draw text in a fallback font.
await document.fonts.load(`8px ${HUD.font}`).catch(() => undefined);

const touch = isTouchDevice();

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05070f',
  pixelArt: true,
  roundPixels: true,
  scale: touch
    ? {
        // Phones and tablets (owner 2026-10-20, as in Star Destroyer): fill the screen,
        // even at an in-between zoom; a whole-number zoom is often 1× on a phone.
        // The page places the canvas (style.css): at the top when upright, with the
        // controls below it; centred when sideways.
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
      }
    : {
        // Whole-number zoom keeps pixels crisp; the page's CSS centers the canvas.
        mode: Phaser.Scale.NONE,
        zoom: zoomForWindow(),
      },
  scene: [PreloadScene, TitleScene, GameScene, InventoryScene, ShopScene, AssetPreviewScene],
});

// FIT follows the window by itself; the whole-number zoom is redone here.
if (touch) {
  document.body.classList.add('touch');
  installTouchControls();
} else {
  window.addEventListener('resize', () => {
    const zoom = zoomForWindow();
    if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
  });
}

// The e2e build adds a test hook. Vite replaces MODE at build time, so this
// branch and the hook module are left out of the normal build entirely.
if (import.meta.env.MODE === 'e2e') {
  void import('./debug/testHook').then(({ installTestHook }) => installTestHook(game));
}
