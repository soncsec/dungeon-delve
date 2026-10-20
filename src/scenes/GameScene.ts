import Phaser from 'phaser';
import { DEFAULT_SEED, GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, PLAYER } from '../config/tuning';
import { roomArt } from '../logic/tiles';
import { buildWorld, roomKey, type World } from '../logic/world';
import { OVERWORLD, START_ROOM } from '../world/overworld';
import { screenBounds, step, type Axis, type Point } from '../logic/movement';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  player: Point;
  seed: number;
  room: { col: number; row: number };
}

/** Depth layers: ground, then props and the player sorted by their feet, then tree tops, then the HUD. */
const DEPTH = { ground: 0, sorted: 10, over: 10_000, hud: 20_000 } as const;

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
  Phaser.Input.Keyboard.Key
>;

/** The overworld. M1.2: draws the start room; the player is still a placeholder box. */
export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private pos: Point = { x: 0, y: 0 };
  private keys!: Keys;
  private seed = DEFAULT_SEED;
  private readonly bounds = {
    ...screenBounds(GAME_WIDTH, GAME_HEIGHT, PLAYER.size),
    minY: HUD_HEIGHT + PLAYER.size / 2,
  };
  private world!: World;
  private room: { col: number; row: number } = { ...START_ROOM };

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.world = buildWorld(OVERWORLD);
    this.drawRoom();
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x05070f).setOrigin(0).setDepth(DEPTH.hud);
    this.pos = { x: GAME_WIDTH / 2, y: HUD_HEIGHT + PLAYER.startRow * 16 + 8 };
    this.player = this.add
      .rectangle(this.pos.x, this.pos.y, PLAYER.size, PLAYER.size, PLAYER.color)
      .setDepth(DEPTH.sorted + this.pos.y);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input is not available');
    this.keys = kb.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
    }) as Keys;
  }

  override update(_time: number, deltaMs: number): void {
    this.pos = step(this.pos, this.readAxis(), deltaMs / 1000, PLAYER.speed, this.bounds);
    this.player.setPosition(this.pos.x, this.pos.y).setDepth(DEPTH.sorted + this.pos.y);
  }

  private drawRoom(): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    if (!room) throw new Error(`no room at ${this.room.col},${this.room.row}`);
    const art = roomArt(room);
    for (const t of art.ground) {
      this.add
        .image(t.x, HUD_HEIGHT + t.y, 'forest', t.frame)
        .setOrigin(0)
        .setDepth(DEPTH.ground);
    }
    for (const p of art.props) {
      this.add
        .image(p.x, HUD_HEIGHT + p.y, 'forest', `prop:${p.prop}`)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.sorted + HUD_HEIGHT + p.y);
    }
    for (const t of art.over) {
      this.add
        .image(t.x, HUD_HEIGHT + t.y, 'forest', t.frame)
        .setOrigin(0)
        .setDepth(DEPTH.over);
    }
  }

  snapshot(): GameSnapshot {
    return { player: { ...this.pos }, seed: this.seed, room: { ...this.room } };
  }

  private readAxis(): Axis {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const up = k.up.isDown || k.w.isDown;
    const down = k.down.isDown || k.s.isDown;
    return {
      x: left === right ? 0 : left ? -1 : 1,
      y: up === down ? 0 : up ? -1 : 1,
    };
  }
}

/** Seed from the URL (?seed=123) for repeatable runs, otherwise the default. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_SEED;
}
