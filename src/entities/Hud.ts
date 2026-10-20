import Phaser from 'phaser';
import { OBJECT_FRAMES } from '../assets/manifest';
import { GAME_WIDTH, HUD, HUD_HEIGHT } from '../config/tuning';
import type { Health } from '../logic/health';
import { gemLabel, heartIcons } from '../logic/hud';

/** Empty hearts: the heart art darkened (runtime tint, ADR-D05). */
const EMPTY_TINT = 0x40303a;
/** The heart's art is 15 px wide; half a heart shows its left 8 px. */
const HALF_WIDTH = 8;

/**
 * The status bar: hearts on the left, gems on the right. Fixed to the screen
 * (it doesn't scroll with the rooms) and redrawn only when something changes.
 */
export class Hud {
  private readonly backs: Phaser.GameObjects.Image[] = [];
  private readonly fronts: Phaser.GameObjects.Image[] = [];
  private readonly gemText: Phaser.GameObjects.Text;
  private shown = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {
    scene.add
      .rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x05070f)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth);
    scene.add
      .sprite(GAME_WIDTH - 44, HUD_HEIGHT / 2, 'gems', 0)
      .play('gems:teal')
      .setScrollFactor(0)
      .setDepth(depth + 1);
    this.gemText = scene.add
      .text(GAME_WIDTH - 34, HUD_HEIGHT / 2 - 4, '', {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#e8f4f0',
      })
      .setScrollFactor(0)
      .setDepth(depth + 1);
  }

  update(health: Health, gems: number): void {
    const key = `${health.points}/${health.max}/${gems}`;
    if (key === this.shown) return;
    this.shown = key;
    const icons = heartIcons(health, HUD.heartX, HUD.heartSpacing);
    while (this.backs.length < icons.length) this.addHeartSlot();
    icons.forEach((icon, i) => {
      const back = this.backs[i];
      const front = this.fronts[i];
      if (!back || !front) return;
      back.setX(icon.x).setVisible(true);
      front.setX(icon.x).setVisible(icon.state !== 'empty');
      if (icon.state === 'half') front.setCrop(0, 0, HALF_WIDTH, 16);
      else front.setCrop();
    });
    for (let i = icons.length; i < this.backs.length; i++) {
      this.backs[i]?.setVisible(false);
      this.fronts[i]?.setVisible(false);
    }
    this.gemText.setText(gemLabel(gems, HUD.maxGems));
  }

  /** What the bar shows, for the e2e test hook. */
  shows(): { hearts: ('full' | 'half' | 'empty')[]; gems: string } {
    const hearts = this.backs
      .map((back, i) => ({ back, front: this.fronts[i] }))
      .filter(({ back }) => back.visible)
      .map(({ front }) => {
        if (!front?.visible) return 'empty' as const;
        return front.isCropped ? ('half' as const) : ('full' as const);
      });
    return { hearts, gems: this.gemText.text };
  }

  private addHeartSlot(): void {
    const y = (HUD_HEIGHT - 16) / 2;
    const make = () =>
      this.scene.add.image(0, y, 'objects', OBJECT_FRAMES.heart).setOrigin(0).setScrollFactor(0);
    this.backs.push(
      make()
        .setTint(EMPTY_TINT)
        .setDepth(this.depth + 1),
    );
    this.fronts.push(make().setDepth(this.depth + 2));
  }
}
