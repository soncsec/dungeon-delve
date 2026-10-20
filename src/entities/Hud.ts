import Phaser from 'phaser';
import { OBJECT_FRAMES } from '../assets/manifest';
import { GAME_WIDTH, HUD, HUD_HEIGHT } from '../config/tuning';
import type { Health } from '../logic/health';
import type { Mana } from '../logic/mana';
import type { Potions } from '../logic/potions';
import type { WeaponMode } from '../logic/weapons';
import { gemLabel, heartIcons } from '../logic/hud';

/** Empty hearts: the heart art darkened (runtime tint, ADR-D05). */
const EMPTY_TINT = 0x40303a;
/** The small heart's art spans x 3–13 of its frame; half a heart shows up to x 8. */
const HALF_WIDTH = 8;
const MANA_BAR = { x: HUD.manaBarX, y: 7, w: HUD.manaBarWidth, h: 6 } as const;

/**
 * The status bar: hearts on the left, gems on the right. Fixed to the screen
 * (it doesn't scroll with the rooms) and redrawn only when something changes.
 */
export class Hud {
  private readonly backs: Phaser.GameObjects.Image[] = [];
  private readonly fronts: Phaser.GameObjects.Image[] = [];
  private readonly gemText: Phaser.GameObjects.Text;
  private readonly weapon: Phaser.GameObjects.Image;
  private readonly manaFill: Phaser.GameObjects.Rectangle;
  private readonly potionText: Record<'health' | 'mana', Phaser.GameObjects.Text>;
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
    // The mana bar: a dark track with a blue fill, between the hearts and the weapon.
    scene.add
      .rectangle(MANA_BAR.x, MANA_BAR.y, MANA_BAR.w, MANA_BAR.h, 0x1a2230)
      .setOrigin(0)
      .setStrokeStyle(1, 0x3a5a8a)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    this.manaFill = scene.add
      .rectangle(MANA_BAR.x + 1, MANA_BAR.y + 1, MANA_BAR.w - 2, MANA_BAR.h - 2, 0x3fa0ff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth + 2);
    // Potions: a red Health Potion and a blue Mana Brew, each with its count.
    const potion = (x: number, texture: string, frame: number) => {
      scene.add
        .image(x, (HUD_HEIGHT - 16) / 2, texture, frame)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(depth + 1);
      return scene.add
        .text(x + 14, HUD_HEIGHT / 2 - 4, '0', {
          fontFamily: HUD.font,
          fontSize: '8px',
          color: '#e8f4f0',
        })
        .setScrollFactor(0)
        .setDepth(depth + 1);
    };
    this.potionText = {
      health: potion(HUD.healthPotionX, 'objects', OBJECT_FRAMES.potion),
      mana: potion(HUD.manaPotionX, 'mana-brew', 0),
    };
    // The ready weapon, in a dark box left of the gems.
    scene.add
      .rectangle(HUD.weaponBoxX, 2, 28, HUD_HEIGHT - 4, 0x1a2230)
      .setOrigin(0)
      .setStrokeStyle(1, 0x4fd3d6)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    this.weapon = scene.add
      .image(HUD.weaponBoxX + 14, HUD_HEIGHT / 2, 'sword-icon')
      .setScrollFactor(0)
      .setDepth(depth + 2);
    this.gemText = scene.add
      .text(GAME_WIDTH - 34, HUD_HEIGHT / 2 - 4, '', {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#e8f4f0',
      })
      .setScrollFactor(0)
      .setDepth(depth + 1);
  }

  update(health: Health, gems: number, mode: WeaponMode, mana: Mana, potions: Potions): void {
    const filled = Math.round((MANA_BAR.w - 2) * (mana.current / mana.max));
    const key = `${health.points}/${health.max}/${gems}/${mode}/${filled}/${potions.health}/${potions.mana}`;
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
    this.weapon.setTexture(mode === 'near' ? 'sword-icon' : 'dagger');
    this.manaFill.width = filled;
    this.potionText.health.setText(String(potions.health));
    this.potionText.mana.setText(String(potions.mana));
    this.manaFill.setVisible(filled > 0);
  }

  /** What the bar shows, for the e2e test hook. */
  shows(): {
    hearts: ('full' | 'half' | 'empty')[];
    gems: string;
    weapon: string;
    manaWidth: number;
    potions: { health: string; mana: string };
  } {
    const hearts = this.backs
      .map((back, i) => ({ back, front: this.fronts[i] }))
      .filter(({ back }) => back.visible)
      .map(({ front }) => {
        if (!front?.visible) return 'empty' as const;
        return front.isCropped ? ('half' as const) : ('full' as const);
      });
    return {
      hearts,
      gems: this.gemText.text,
      weapon: this.weapon.texture.key,
      manaWidth: this.manaFill.visible ? this.manaFill.width : 0,
      potions: { health: this.potionText.health.text, mana: this.potionText.mana.text },
    };
  }

  private addHeartSlot(): void {
    const y = (HUD_HEIGHT - 16) / 2;
    const make = () =>
      this.scene.add
        .image(0, y, 'objects', OBJECT_FRAMES.smallHeart)
        .setOrigin(0)
        .setScrollFactor(0);
    this.backs.push(
      make()
        .setTint(EMPTY_TINT)
        .setDepth(this.depth + 1),
    );
    this.fronts.push(make().setDepth(this.depth + 2));
  }
}
