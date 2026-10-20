import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import {
  DEFAULT_SEED,
  GAME_WIDTH,
  HERO,
  HUD_HEIGHT,
  ROOM_COLS,
  ROOM_ROWS,
  ROOM_SLIDE_MS,
  SWORD,
  TILE,
} from '../config/tuning';
import { facingFor, moveHero, type Facing } from '../logic/hero';
import type { Axis, Point } from '../logic/movement';
import type { Dir } from '../logic/room';
import { centre, isSwinging, startSwing, swordBox, type Rect, type Swing } from '../logic/sword';
import { roomArt } from '../logic/tiles';
import {
  buildWorld,
  enterFrom,
  exitDirection,
  neighbour,
  roomKey,
  solidInWorld,
  type World,
} from '../logic/world';
import { OVERWORLD, START_ROOM } from '../world/overworld';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  /** The hero's feet, in room pixels (0,0 is the room's top-left corner, below the status bar). */
  player: Point;
  facing: Facing;
  moving: boolean;
  seed: number;
  room: { col: number; row: number };
  /** True while the view slides to the next room. */
  sliding: boolean;
  /** Where Jarrett's feet were when he entered the current room (null in the start room). */
  enteredAt: Point | null;
  /** The area the sword covers, while a swing is under way. */
  sword: Rect | null;
  /** Swings started so far, and the area the latest one covered (kept after it ends). */
  swings: number;
  lastSword: Rect | null;
  /** Where Jarrett stood when the latest swing ended (null until one has ended). */
  stoodAfterSwing: Point | null;
}

/** Depth layers: ground, then props and the hero sorted by their feet, then tree tops, then the HUD. */
const DEPTH = { ground: 0, sorted: 10, over: 1_000_000, hud: 2_000_000 } as const;

const ROOM_W = ROOM_COLS * TILE;
const ROOM_H = ROOM_ROWS * TILE;

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
  Phaser.Input.Keyboard.Key
>;

/**
 * The overworld. Each room is drawn at its own place in world space (column
 * × 320, row × 160, below the status bar). The camera shows one room and
 * slides to the next when Jarrett walks through a gap (ADR-D02).
 */
export class GameScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite;
  private pos: Point = { x: 0, y: 0 };
  private facing: Facing = 'down';
  private moving = false;
  private keys!: Keys;
  private seed = DEFAULT_SEED;
  private world!: World;
  private room: { col: number; row: number } = { ...START_ROOM };
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private sliding = false;
  private enteredAt: Point | null = null;
  private swing: Swing = { startedAt: null };
  /** Game time of the latest frame, in ms. */
  private now = 0;
  private swings = 0;
  /** Set by the attack key's key-down event, so even a tap shorter than a frame swings. */
  private swingQueued = false;
  private lastSword: Rect | null = null;
  private swingFrom: Point | null = null;
  private stoodAfterSwing: Point | null = null;
  private slash!: Phaser.GameObjects.Sprite;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.world = buildWorld(OVERWORLD);
    this.room = { ...START_ROOM };
    this.sliding = false;
    this.enteredAt = null;
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
    this.cameras.main.setScroll(this.room.col * ROOM_W, this.room.row * ROOM_H);
    this.add
      .rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x05070f)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.pos = { x: HERO.start.col * TILE, y: (HERO.start.row + 1) * TILE - HERO.start.lift };
    this.hero = this.add.sprite(0, 0, 'jarrett', 0).setOrigin(0.5, HERO.feetY / HERO.frameHeight);
    this.placeSprite();

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
    // Stop the browser scrolling the page on Space.
    kb.addCapture('SPACE');
    this.swingQueued = false;
    kb.on('keydown-SPACE', () => (this.swingQueued = true));
    kb.on('keydown-J', () => (this.swingQueued = true));
    // One slash effect, reused for every swing.
    this.slash = this.add.sprite(0, 0, 'slash-horizontal', 0).setVisible(false);
    this.slash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.slash.setVisible(false));
    this.swing = { startedAt: null };
  }

  override update(time: number, deltaMs: number): void {
    this.now = time;
    if (this.sliding) return;
    if (this.swingQueued) {
      this.swingQueued = false;
      this.trySwing(time);
    }
    if (isSwinging(this.swing, time, SWORD.durationMs)) {
      // Jarrett plants his feet while the blade is out.
      this.moving = false;
      return;
    }
    if (this.swingFrom) {
      // The swing just ended: record where he stood, before any walking this frame.
      this.stoodAfterSwing = { ...this.pos };
      this.swingFrom = null;
    }
    const axis = this.readAxis();
    this.facing = facingFor(axis, this.facing);
    const before = this.pos;
    const { col, row } = this.room;
    this.pos = moveHero(this.pos, axis, (HERO.speed * deltaMs) / 1000, HERO.box, (cx, cy) =>
      solidInWorld(this.world, col, row, cx, cy),
    );
    this.moving = this.pos.x !== before.x || this.pos.y !== before.y;
    this.animate(axis.x !== 0 || axis.y !== 0);
    this.placeSprite();
    const dir = exitDirection(this.pos, HERO.box.height);
    if (dir) this.slideTo(dir);
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.pos },
      facing: this.facing,
      moving: this.moving,
      seed: this.seed,
      room: { ...this.room },
      sliding: this.sliding,
      enteredAt: this.enteredAt ? { ...this.enteredAt } : null,
      sword: isSwinging(this.swing, this.now, SWORD.durationMs)
        ? swordBox(this.pos, this.facing, SWORD)
        : null,
      swings: this.swings,
      lastSword: this.lastSword ? { ...this.lastSword } : null,
      stoodAfterSwing: this.stoodAfterSwing ? { ...this.stoodAfterSwing } : null,
    };
  }

  /** Test hook only: put the hero's feet at a position in the current room (room pixels). */
  placeHero(x: number, y: number): void {
    this.pos = { x, y };
    this.placeSprite();
  }

  /** Slides the view to the room next door. Jarrett keeps his place on screen and stands still meanwhile. */
  private slideTo(dir: Dir): void {
    const next = neighbour(this.room.col, this.room.row, dir);
    const old = this.roomObjects;
    this.pos = enterFrom(this.pos, dir);
    this.enteredAt = { ...this.pos };
    this.room = next;
    this.roomObjects = this.drawRoom(next.col, next.row);
    this.sliding = true;
    this.moving = false;
    this.animate(false);
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: next.col * ROOM_W,
      scrollY: next.row * ROOM_H,
      duration: ROOM_SLIDE_MS,
      ease: 'Linear',
      onComplete: () => {
        for (const o of old) o.destroy();
        this.sliding = false;
      },
    });
  }

  /** Starts a swing (unless one is under way) and shows the slash in front of Jarrett. */
  private trySwing(now: number): void {
    const next = startSwing(this.swing, now, SWORD.durationMs);
    if (next === this.swing) return;
    this.swing = next;
    this.animate(false);
    const box = swordBox(this.pos, this.facing, SWORD);
    this.swings += 1;
    this.lastSword = box;
    this.swingFrom = { ...this.pos };
    const o = this.origin(this.room.col, this.room.row);
    const at = centre(box);
    const sideways = this.facing === 'left' || this.facing === 'right';
    const key = sideways ? 'slash-horizontal' : 'slash-upward';
    this.slash
      .setTexture(key, 0)
      .setPosition(o.x + at.x, o.y + at.y)
      .setFlip(this.facing === 'left', this.facing === 'down')
      // Behind Jarrett when swinging up (the blade is beyond his head), in front otherwise.
      .setDepth(this.hero.depth + (this.facing === 'up' ? -1 : 1))
      .setVisible(true)
      .play(animKey(key, 'play'));
  }

  /** Walk animation while a direction is held (even against a wall); stand still otherwise. */
  private animate(walking: boolean): void {
    const row = this.facing === 'right' ? 'left' : this.facing;
    this.hero.setFlipX(this.facing === 'right');
    if (walking) {
      this.hero.play(animKey('jarrett', `walk-${row}`), true);
    } else {
      this.hero.stop();
      this.hero.setFrame(HERO.standFrame[row]);
    }
  }

  /** Top-left of a room in world pixels. */
  private origin(col: number, row: number): Point {
    return { x: col * ROOM_W, y: HUD_HEIGHT + row * ROOM_H };
  }

  private placeSprite(): void {
    const o = this.origin(this.room.col, this.room.row);
    this.hero.setPosition(o.x + this.pos.x, o.y + this.pos.y);
    this.hero.setDepth(DEPTH.sorted + o.y + this.pos.y);
  }

  /** Draws a room at its place in the world; returns everything drawn, to remove later. */
  private drawRoom(col: number, row: number): Phaser.GameObjects.GameObject[] {
    const room = this.world.rooms.get(roomKey(col, row));
    if (!room) throw new Error(`no room at ${col},${row}`);
    const o = this.origin(col, row);
    const art = roomArt(room);
    const drawn: Phaser.GameObjects.GameObject[] = [];
    for (const t of art.ground) {
      drawn.push(
        this.add
          .image(o.x + t.x, o.y + t.y, 'forest', t.frame)
          .setOrigin(0)
          .setDepth(DEPTH.ground),
      );
    }
    for (const p of art.props) {
      drawn.push(
        this.add
          .image(o.x + p.x, o.y + p.y, 'forest', `prop:${p.prop}`)
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.sorted + o.y + p.y),
      );
    }
    for (const t of art.over) {
      drawn.push(
        this.add
          .image(o.x + t.x, o.y + t.y, 'forest', t.frame)
          .setOrigin(0)
          .setDepth(DEPTH.over),
      );
    }
    return drawn;
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
