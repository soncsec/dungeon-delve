import Phaser from 'phaser';

/**
 * Reuses sprites instead of creating and destroying them (enemies, pickups,
 * effects), so busy rooms don't churn memory. `take` hands out a hidden
 * sprite or makes one; `give` hides it and puts it back.
 */
export class SpritePool {
  private readonly free: Phaser.GameObjects.Sprite[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  take(texture: string, frame: string | number = 0): Phaser.GameObjects.Sprite {
    const s = this.free.pop() ?? this.scene.add.sprite(0, 0, texture, frame);
    s.setTexture(texture, frame).setActive(true).setVisible(true).setAlpha(1).clearTint();
    s.setFlip(false, false).setOrigin(0.5, 0.5);
    return s;
  }

  give(s: Phaser.GameObjects.Sprite): void {
    s.stop();
    s.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
    s.setActive(false).setVisible(false);
    this.free.push(s);
  }

  /** Sprites made so far that are waiting for reuse (for the e2e test hook). */
  get spare(): number {
    return this.free.length;
  }
}
