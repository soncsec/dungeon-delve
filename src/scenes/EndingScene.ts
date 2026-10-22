import Phaser from 'phaser';
import { ENDING, GAME_HEIGHT, GAME_WIDTH, HERO, HUD } from '../config/tuning';
import { KeyInput } from '../input/keyboard';
import { formatPlayTime } from '../logic/title';

/**
 * What the ending needs from the game: how long the quest took, whether it was
 * a play-test run, and the fastest finish (this one, if it is a new best).
 */
export interface EndingData {
  playMs: number;
  cheated: boolean;
  best: number | null;
  newBest: boolean;
}

/** The credits, a card at a time beneath the three of them. */
const CREDITS: readonly (readonly [string, string])[] = [
  ['DUNGEON DELVE', 'A SONCRANT ARCADE GAME'],
  ['ART', 'ANSIMUZ LEGACY COLLECTION (CC0)'],
  ['MADE WITH', 'PHASER'],
  ['THANK YOU', 'FOR PLAYING!'],
];

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0', align: 'center' } as const;
const GOLD = '#ffd166';
const DIM = '#7f8ea3';
const BACK_KEYS = new Set(['Enter', 'Space', 'KeyJ']);

/**
 * The ending (M7.3): Jarrett, Princess Kira and Walker together under the
 * whole Star, the time the quest took, and the credits, a card at a time.
 * Enter, Space or a tap goes back to the title.
 */
export class EndingScene extends Phaser.Scene {
  private keys!: KeyInput;
  private playTime = '';
  private best: string | null = null;
  private newBest = false;
  private card = 0;
  private ready = false;

  constructor() {
    super('Ending');
  }

  create(data: EndingData): void {
    this.keys = new KeyInput(BACK_KEYS);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    this.cameras.main.setBackgroundColor(ENDING.background);
    this.ready = false;
    this.card = 0;
    const mid = GAME_WIDTH / 2;
    this.add
      .text(mid, 12, 'THE STAR OF POWER SHINES AGAIN,\nAND PRINCESS KIRA IS FREE.', {
        ...TEXT,
        color: GOLD,
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    // The three of them side by side, facing out, at twice their size.
    ENDING.cast.forEach(({ key, dx }) => {
      this.add
        .sprite(mid + dx, ENDING.feetY, key, HERO.standFrame.down)
        .setOrigin(0.5, HERO.feetY / HERO.frameHeight)
        .setScale(ENDING.castScale);
    });
    this.playTime = formatPlayTime(data.playMs);
    this.add
      .text(mid, ENDING.timeY, `YOUR TIME  ${this.playTime}`, { ...TEXT, color: GOLD })
      .setOrigin(0.5, 0);
    this.best = data.best === null ? null : formatPlayTime(data.best);
    this.newBest = data.newBest;
    // Under the time: a play-test run doesn't count; else a new best, or the best so far.
    const note = data.cheated
      ? { text: '(A PLAY-TEST RUN)', color: DIM }
      : data.newBest
        ? { text: 'A NEW BEST TIME!', color: GOLD }
        : this.best
          ? { text: `BEST  ${this.best}`, color: DIM }
          : null;
    if (note) {
      this.add
        .text(mid, ENDING.timeY + 10, note.text, { ...TEXT, color: note.color })
        .setOrigin(0.5, 0);
    }
    const credit = this.add
      .text(mid, ENDING.creditY, '', { ...TEXT, lineSpacing: 4 })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    const show = () => {
      const [a, b] = CREDITS[this.card % CREDITS.length] ?? ['', ''];
      credit.setText(`${a}\n${b}`);
      this.tweens.add({
        targets: credit,
        alpha: { from: 0, to: 1 },
        duration: ENDING.fadeMs,
        yoyo: true,
        hold: ENDING.cardMs - 2 * ENDING.fadeMs,
      });
      this.card += 1;
    };
    show();
    this.time.addEvent({ delay: ENDING.cardMs, loop: true, callback: show });
    // A moment before it can be left, so a held key doesn't skip it.
    this.time.delayedCall(ENDING.promptAfterMs, () => {
      this.ready = true;
      this.add
        .text(mid, GAME_HEIGHT - 12, 'ENTER OR TAP: TITLE', { ...TEXT, color: DIM })
        .setOrigin(0.5, 0);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.leave());
  }

  override update(): void {
    if (this.keys.takePresses().length > 0) this.leave();
  }

  private leave(): void {
    if (this.ready) this.scene.start('Title');
  }

  /** Test hook only: what the ending shows. */
  shows(): {
    time: string;
    ready: boolean;
    cards: number;
    best: string | null;
    newBest: boolean;
  } {
    return {
      time: this.playTime,
      ready: this.ready,
      cards: this.card,
      best: this.best,
      newBest: this.newBest,
    };
  }
}
