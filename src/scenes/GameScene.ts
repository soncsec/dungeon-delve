import Phaser from 'phaser';
import { animKey } from '../assets/manifest';
import {
  DEFAULT_SEED,
  GAME_WIDTH,
  HERO,
  HUD_HEIGHT,
  ROOM_COLS,
  ROOM_ROWS,
  TILE,
} from '../config/tuning';
import { facingFor, moveHero, type Facing } from '../logic/hero';
import type { Axis, Point } from '../logic/movement';
import { isSolid, type Room } from '../logic/room';
import { roomArt } from '../logic/tiles';
import { buildWorld, roomKey, type World } from '../logic/world';
import { OVERWORLD, START_ROOM } from '../world/overworld';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  /** The hero's feet, in room pixels (0,0 is the room's top-left corner, below the status bar). */
  player: Point;
  facing: Facing;
  moving: boolean;
  seed: number;
  room: { col: number; row: number };
}

/** Depth layers: ground, then props and the hero sorted by their feet, then tree tops, then the HUD. */
const DEPTH = { ground: 0, sorted: 10, over: 10_000, hud: 20_000 } as const;

type Keys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd',
  Phaser.Input.Keyboard.Key
>;

/** The overworld: Jarrett walks around the current room. */
export class GameScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite;
  private pos: Point = { x: 0, y: 0 };
  private facing: Facing = 'down';
  private moving = false;
  private keys!: Keys;
  private seed = DEFAULT_SEED;
  private world!: World;
  private room: { col: number; row: number } = { ...START_ROOM };
  private current!: Room;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.world = buildWorld(OVERWORLD);
    this.current = this.roomAt(this.room.col, this.room.row);
    this.drawRoom();
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x05070f).setOrigin(0).setDepth(DEPTH.hud);

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
    const axis = this.readAxis();
    this.facing = facingFor(axis, this.facing);
    const before = this.pos;
    this.pos = moveHero(this.pos, axis, (HERO.speed * deltaMs) / 1000, HERO.box, (cx, cy) =>
      this.solidAt(cx, cy),
    );
    this.moving = this.pos.x !== before.x || this.pos.y !== before.y;
    this.animate(axis.x !== 0 || axis.y !== 0);
    this.placeSprite();
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.pos },
      facing: this.facing,
      moving: this.moving,
      seed: this.seed,
      room: { ...this.room },
    };
  }

  /** Test hook only: put the hero's feet at a room position. */
  placeHero(x: number, y: number): void {
    this.pos = { x, y };
    this.placeSprite();
  }

  /** Walls, props, and (until rooms connect in M1.4) everything outside the room. */
  private solidAt(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= ROOM_COLS || cy >= ROOM_ROWS) return true;
    return isSolid(this.current, cx, cy);
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

  private placeSprite(): void {
    this.hero.setPosition(this.pos.x, HUD_HEIGHT + this.pos.y);
    this.hero.setDepth(DEPTH.sorted + HUD_HEIGHT + this.pos.y);
  }

  private roomAt(col: number, row: number): Room {
    const room = this.world.rooms.get(roomKey(col, row));
    if (!room) throw new Error(`no room at ${col},${row}`);
    return room;
  }

  private drawRoom(): void {
    const art = roomArt(this.current);
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
