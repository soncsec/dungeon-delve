import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HERO, HUD, PAUSE, STAR, TITLE } from '../config/tuning';
import { KeyInput } from '../input/keyboard';
import { controlsLegend } from '../logic/pause';
import { shardsHeld } from '../logic/progress';
import { isTouchDevice } from '../platform/touch';
import type { SaveGame } from '../logic/save';
import {
  CONFIRM_OPTIONS,
  TITLE_START,
  formatPlayTime,
  titleOptions,
  titleStep,
  type TitleInput,
  type TitleOption,
  type TitleState,
} from '../logic/title';
import { readFastest } from '../storage/fastestStore';
import { clearSave, readSave } from '../storage/saveStore';
import type { GameStart } from './GameScene';

const KEYS: Readonly<Record<string, TitleInput>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Enter: 'choose',
  Space: 'choose',
  KeyJ: 'choose',
  Escape: 'back',
};

/** Goes back to the arcade (nothing to lose here, so it doesn't ask). */
const ARCADE_KEY = 'KeyQ';

/** The story so far, a card at a time under the title (the intro). */
const STORY: readonly string[] = [
  'A SORCERER HAS SHATTERED\nTHE STAR OF POWER,',
  'HIDDEN ITS EIGHT SHARDS\nIN EIGHT DUNGEONS,',
  'AND LOCKED PRINCESS KIRA\nIN THE SHADOW VAULT.',
  'ONLY YOU, JARRETT,\nCAN PUT THINGS RIGHT.',
];

const LABELS: Readonly<Record<string, string>> = {
  continue: 'CONTINUE',
  new: 'NEW GAME',
  controls: 'CONTROLS',
  no: 'NO',
  yes: 'YES',
};

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const GOLD = '#ffd166';
const DIM = '#7f8ea3';

/**
 * The title screen (M3.5, M8.3): the story so far, a card at a time; Jarrett
 * and Kira either side of the menu: CONTINUE from the save, NEW GAME (which
 * asks before wiping a save) and CONTROLS; the fastest finish; and Q (a tap on
 * a phone) back to the arcade. Keys or a tap choose.
 */
export class TitleScene extends Phaser.Scene {
  private keys!: KeyInput;
  private save: SaveGame | null = null;
  private fastest: number | null = null;
  private touch = false;
  private storyCard = 0;
  private cast: Phaser.GameObjects.Sprite[] = [];
  private state: TitleState = TITLE_START;
  private items: Phaser.GameObjects.Text[] = [];
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    this.save = readSave();
    this.fastest = readFastest();
    this.state = TITLE_START;
    this.touch = isTouchDevice();
    this.keys = new KeyInput(new Set([...Object.keys(KEYS), ARCADE_KEY]));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    const mid = GAME_WIDTH / 2;
    this.add
      .text(mid, TITLE.titleY, 'DUNGEON DELVE', { ...TEXT, fontSize: '16px', color: GOLD })
      .setOrigin(0.5);
    this.add
      .text(mid, TITLE.subtitleY, 'THE STAR OF POWER', { ...TEXT, color: DIM })
      .setOrigin(0.5);
    // The intro: the story so far, a card at a time.
    const story = this.add
      .text(mid, TITLE.storyY, '', { ...TEXT, align: 'center', lineSpacing: 4 })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.storyCard = 0;
    const tell = () => {
      story.setText(STORY[this.storyCard % STORY.length] ?? '');
      this.tweens.add({
        targets: story,
        alpha: { from: 0, to: 1 },
        duration: TITLE.fadeMs,
        yoyo: true,
        hold: TITLE.cardMs - 2 * TITLE.fadeMs,
      });
      this.storyCard += 1;
    };
    tell();
    this.time.addEvent({ delay: TITLE.cardMs, loop: true, callback: tell });
    // Jarrett and Kira, either side of the menu, at twice their size.
    this.cast = TITLE.cast.map(({ key, x }) =>
      this.add
        .sprite(x, TITLE.castFeetY, key, HERO.standFrame.down)
        .setOrigin(0.5, HERO.feetY / HERO.frameHeight)
        .setScale(2),
    );
    this.draw();
  }

  override update(): void {
    for (const code of this.keys.takePresses()) {
      if (code === ARCADE_KEY) this.toArcade();
      const input = KEYS[code];
      if (input) this.apply(input);
    }
  }

  /** Back to the arcade, up one folder. */
  private toArcade(): void {
    window.location.assign(new URL(PAUSE.quitUrl, window.location.href).href);
  }

  private apply(input: TitleInput): void {
    const r = titleStep(this.state, input, this.save !== null);
    this.state = r.state;
    if (r.start) this.begin(r.start);
    else this.draw();
  }

  private begin(option: TitleOption): void {
    let start: GameStart;
    if (option === 'continue' && this.save) {
      start = { save: this.save, map: null, cheated: this.save.cheated };
    } else {
      clearSave();
      start = { save: null, map: null, cheated: false };
    }
    this.scene.start('Game', start);
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const mid = GAME_WIDTH / 2;
    const hasSave = this.save !== null;
    const screen = this.state.screen;
    // The controls need the whole width: Jarrett and Kira step aside meanwhile.
    for (const sprite of this.cast) sprite.setVisible(screen !== 'controls');
    if (screen === 'controls') {
      this.items = [];
      controlsLegend(this.touch).forEach(([a, b], i) => {
        const y = TITLE.legendY + i * TITLE.legendGap;
        this.dynamic.push(this.add.text(TITLE.legendX[0], y, a, TEXT));
        this.dynamic.push(this.add.text(TITLE.legendX[1], y, b, TEXT));
      });
      const back = this.add
        .text(mid, TITLE.backY, this.touch ? 'BACK' : 'ENTER OR ESC: BACK', {
          ...TEXT,
          color: GOLD,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      back.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.apply('back'));
      this.dynamic.push(back);
      return;
    }
    const confirm = screen === 'confirm';
    const options: readonly string[] = confirm ? CONFIRM_OPTIONS : titleOptions(hasSave);
    let y = TITLE.menuY;
    if (confirm) {
      this.dynamic.push(
        this.add
          .text(mid, TITLE.menuY, 'START OVER? YOUR SAVE\nWILL BE LOST.', {
            ...TEXT,
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5),
      );
      y = TITLE.menuY + TITLE.confirmGap;
    }
    this.items = options.map((option, i) => {
      const chosen = i === this.state.cursor;
      const text = this.add
        .text(mid, y + i * TITLE.menuGap, `${chosen ? '> ' : '  '}${LABELS[option] ?? option}`, {
          ...TEXT,
          color: chosen ? GOLD : TEXT.color,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      // A tap moves the cursor there and chooses it.
      text.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.state = { ...this.state, cursor: i };
        this.apply('choose');
      });
      return text;
    });
    this.dynamic.push(...this.items);
    if (!confirm && this.save) {
      const shards = shardsHeld(this.save.progress);
      this.dynamic.push(
        this.add
          .text(
            mid,
            TITLE.saveY,
            `${shards}/${STAR.shards} SHARDS  ${formatPlayTime(this.save.playMs)}`,
            {
              ...TEXT,
              color: DIM,
            },
          )
          .setOrigin(0.5),
      );
    }
    // The fastest finish so far (owner 2026-10-20: instead of a high score).
    if (this.fastest !== null) {
      this.dynamic.push(
        this.add
          .text(mid, TITLE.fastestY, `FASTEST  ${formatPlayTime(this.fastest)}`, {
            ...TEXT,
            color: GOLD,
          })
          .setOrigin(0.5),
      );
    }
    // The keys, or on a phone a button back to the arcade.
    const foot = this.add
      .text(
        mid,
        GAME_HEIGHT - TITLE.footFromBottom,
        this.touch ? 'BACK TO ARCADE' : 'ARROWS CHOOSE  ENTER START  Q ARCADE',
        { ...TEXT, color: DIM },
      )
      .setOrigin(0.5);
    if (this.touch) {
      foot.setInteractive({ useHandCursor: true });
      foot.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.toArcade());
    }
    this.dynamic.push(foot);
  }

  /** Test hook only: what the menu shows. */
  shows(): {
    screen: TitleState['screen'];
    options: string[];
    cursor: number;
    fastest: string | null;
  } {
    return {
      screen: this.state.screen,
      options: this.items.map((t) => t.text.replace(/^(> | {2})/, '')),
      cursor: this.state.cursor,
      fastest: this.fastest === null ? null : formatPlayTime(this.fastest),
    };
  }
}
