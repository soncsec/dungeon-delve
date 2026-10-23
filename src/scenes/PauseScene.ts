import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD, PAUSE } from '../config/tuning';
import { KeyInput } from '../input/keyboard';
import { controlsLegend, pauseStep, type PauseInput, type PauseScreen } from '../logic/pause';
import { isTouchDevice } from '../platform/touch';

const KEYS: Readonly<Record<string, PauseInput>> = {
  KeyP: 'resume',
  Escape: 'resume',
  KeyQ: 'quit',
  KeyY: 'yes',
  KeyN: 'no',
};

const TEXT = { fontFamily: HUD.font, fontSize: '8px', color: '#e8f4f0' } as const;
const GOLD = '#ffd166';
const DIM = '#7f8ea3';

/**
 * The pause screen (ROADMAP M8.3), over the game, which waits meanwhile (its
 * play time too): the controls, and the way back to the arcade. On a phone
 * its lines are buttons.
 */
export class PauseScene extends Phaser.Scene {
  private keys!: KeyInput;
  private screen: PauseScreen = 'paused';
  private touch = false;
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Pause');
  }

  create(): void {
    this.screen = 'paused';
    this.touch = isTouchDevice();
    this.keys = new KeyInput(new Set(Object.keys(KEYS)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PAUSE.shade, PAUSE.shadeAlpha).setOrigin(0);
    this.add
      .text(GAME_WIDTH / 2, PAUSE.titleY, 'PAUSED', { ...TEXT, fontSize: '16px', color: GOLD })
      .setOrigin(0.5, 0);
    controlsLegend(this.touch).forEach(([a, b], i) => {
      const y = PAUSE.legendY + i * PAUSE.lineGap;
      this.add.text(PAUSE.columns[0], y, a, TEXT);
      this.add.text(PAUSE.columns[1], y, b, TEXT);
    });
    this.draw();
  }

  override update(): void {
    for (const code of this.keys.takePresses()) {
      const input = KEYS[code];
      if (input) this.apply(input);
    }
  }

  private apply(input: PauseInput): void {
    const r = pauseStep(this.screen, input);
    if (r.resume) {
      this.scene.resume('Game');
      this.scene.stop();
      return;
    }
    if (r.quit) {
      window.location.assign(new URL(PAUSE.quitUrl, window.location.href).href);
      return;
    }
    this.screen = r.screen;
    this.draw();
  }

  /** The way on: resume or quit, or the quit question. Each line is a button on a phone. */
  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const confirm = this.screen === 'confirmQuit';
    const y = PAUSE.choicesY;
    if (confirm) {
      this.dynamic.push(
        this.add
          .text(GAME_WIDTH / 2, y, 'QUIT TO ARCADE?\nYOU GO ON FROM YOUR LAST SAVE POINT.', {
            ...TEXT,
            color: GOLD,
            align: 'center',
            lineSpacing: 4,
          })
          .setOrigin(0.5, 0),
      );
    }
    const choices: readonly [string, string, PauseInput][] = confirm
      ? [
          ['Y  YES', 'YES', 'yes'],
          ['N  NO', 'NO', 'no'],
        ]
      : [
          ['P  RESUME', 'RESUME', 'resume'],
          ['Q  QUIT TO ARCADE', 'QUIT TO ARCADE', 'quit'],
        ];
    const rowY = confirm ? y + PAUSE.confirmGap : y;
    choices.forEach(([keys, tap, input], i) => {
      const x = GAME_WIDTH / 2 + (i === 0 ? -1 : 1) * PAUSE.choiceSpread;
      const text = this.add
        .text(x, rowY, this.touch ? tap : keys, { ...TEXT, color: this.touch ? GOLD : DIM })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      text.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.apply(input));
      this.dynamic.push(text);
    });
  }

  /** Test hook only: which screen shows. */
  shows(): { screen: PauseScreen } {
    return { screen: this.screen };
  }
}
