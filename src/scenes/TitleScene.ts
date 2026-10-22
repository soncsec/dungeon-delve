import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD, STAR } from '../config/tuning';
import { KeyInput } from '../input/keyboard';
import { shardsHeld } from '../logic/progress';
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

const LABELS: Readonly<Record<string, string>> = {
  continue: 'CONTINUE',
  new: 'NEW GAME',
  no: 'NO',
  yes: 'YES',
};

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const GOLD = '#ffd166';
const DIM = '#7f8ea3';

/**
 * The title screen (M3.5; the rest of it is M8.3): CONTINUE from the save,
 * or NEW GAME, which asks before wiping a save. Keys or a tap choose.
 */
export class TitleScene extends Phaser.Scene {
  private keys!: KeyInput;
  private save: SaveGame | null = null;
  private fastest: number | null = null;
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
    this.keys = new KeyInput(new Set(Object.keys(KEYS)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    this.add
      .text(GAME_WIDTH / 2, 44, 'DUNGEON DELVE', { ...TEXT, fontSize: '16px', color: GOLD })
      .setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 66, 'THE STAR OF POWER', { ...TEXT, color: DIM }).setOrigin(0.5);
    this.draw();
  }

  override update(): void {
    for (const code of this.keys.takePresses()) {
      const input = KEYS[code];
      if (input) this.apply(input);
    }
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
    const hasSave = this.save !== null;
    const confirm = this.state.screen === 'confirm';
    const options: readonly string[] = confirm ? CONFIRM_OPTIONS : titleOptions(hasSave);
    let y = 104;
    if (confirm) {
      this.dynamic.push(
        this.add
          .text(GAME_WIDTH / 2, 92, 'START OVER? YOUR SAVE\nWILL BE LOST.', {
            ...TEXT,
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5),
      );
      y = 122;
    }
    this.items = options.map((option, i) => {
      const chosen = i === this.state.cursor;
      const text = this.add
        .text(GAME_WIDTH / 2, y + i * 16, `${chosen ? '> ' : '  '}${LABELS[option] ?? option}`, {
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
            GAME_WIDTH / 2,
            y + options.length * 16 + 6,
            `${shards}/${STAR.shards} SHARDS  ${formatPlayTime(this.save.playMs)}`,
            { ...TEXT, color: DIM },
          )
          .setOrigin(0.5),
      );
    }
    // The fastest finish so far (owner 2026-10-20: instead of a high score).
    if (this.fastest !== null) {
      this.dynamic.push(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, `FASTEST  ${formatPlayTime(this.fastest)}`, {
            ...TEXT,
            color: GOLD,
          })
          .setOrigin(0.5),
      );
    }
    this.dynamic.push(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 14, 'ARROWS CHOOSE   ENTER START', {
          ...TEXT,
          color: DIM,
        })
        .setOrigin(0.5),
    );
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
