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
  TILE,
} from '../config/tuning';
import { facingFor, moveHero, type Facing } from '../logic/hero';
import type { Axis, Point } from '../logic/movement';
import type { Dir } from '../logic/room';
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

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.world = buildWorld(OVERWORLD);
    this.room = { ...START_ROOM };
    this.sliding = false;
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
  }

  override update(_time: number, deltaMs: number): void {
    if (this.sliding) return;
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
