import Phaser from 'phaser';
import { OBJECT_FRAMES, animKey } from '../assets/manifest';
import {
  DEFAULT_SEED,
  DROPS,
  GAME_WIDTH,
  HEALTH,
  HERO,
  HUD_HEIGHT,
  ROOM_COLS,
  ROOM_ROWS,
  PICKUPS,
  ROBOT,
  ROOM_SLIDE_MS,
  SWORD,
  TILE,
} from '../config/tuning';
import { SpritePool } from '../entities/SpritePool';
import { KeyInput } from '../input/keyboard';
import { rollDrop, type Drop } from '../logic/drops';
import { fullHealth, heal, isInvulnerable, isOut, takeDamage, type Health } from '../logic/health';
import { awayFrom, facingFor, moveHero, type Facing } from '../logic/hero';
import type { Axis, Point } from '../logic/movement';
import { createRng, type Rng } from '../logic/rng';
import { hitRobot, isDefeated, robotBody, spawnRobot, stepRobot, type Robot } from '../logic/robot';
import { isSolid, type Dir } from '../logic/room';
import {
  centre,
  facingVector,
  isSwinging,
  overlaps,
  startSwing,
  swordBox,
  type Rect,
  type Swing,
} from '../logic/sword';
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
  /** Half hearts left and the most there can be. */
  health: { points: number; max: number };
  invulnerable: boolean;
  /** True while a hit is pushing Jarrett back. */
  knockedBack: boolean;
  gems: number;
  robots: { x: number; y: number; health: number }[];
  pickups: { kind: Drop; x: number; y: number }[];
  /** Robots defeated since the game started. */
  defeated: number;
}

interface LiveRobot {
  r: Robot;
  sprite: Phaser.GameObjects.Sprite;
}

interface Pickup {
  kind: Drop;
  pos: Point;
  sprite: Phaser.GameObjects.Sprite;
}

/** Jarrett's body, for touching enemies and pickups: 10 px wide, 20 px tall above his feet. */
const BODY = { halfWidth: 5, height: 20 } as const;

/** Depth layers: ground, then props and the hero sorted by their feet, then tree tops, then the HUD. */
const DEPTH = { ground: 0, sorted: 10, over: 1_000_000, hud: 2_000_000 } as const;

const ROOM_W = ROOM_COLS * TILE;
const ROOM_H = ROOM_ROWS * TILE;

/** Keys that swing the sword. */
const ATTACK_KEYS: ReadonlySet<string> = new Set(['Space', 'KeyJ']);
/** Every key the overworld uses (browser key codes). */
const KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  ...ATTACK_KEYS,
]);

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
  private keys!: KeyInput;
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
  private lastSword: Rect | null = null;
  private swingFrom: Point | null = null;
  private stoodAfterSwing: Point | null = null;
  private slash!: Phaser.GameObjects.Sprite;
  private rng!: Rng;
  private health: Health = fullHealth(HEALTH.startHearts);
  private gems = 0;
  private defeated = 0;
  private heroKnockMs = 0;
  private heroKnockDir: Facing = 'down';
  private robots: LiveRobot[] = [];
  private pickups: Pickup[] = [];
  private robotPool!: SpritePool;
  private pickupPool!: SpritePool;
  private fxPool!: SpritePool;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.rng = createRng(this.seed);
    this.world = buildWorld(OVERWORLD);
    this.health = fullHealth(HEALTH.startHearts);
    this.gems = 0;
    this.defeated = 0;
    this.heroKnockMs = 0;
    this.robots = [];
    this.pickups = [];
    this.robotPool = new SpritePool(this);
    this.pickupPool = new SpritePool(this);
    this.fxPool = new SpritePool(this);
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

    this.keys = new KeyInput(KEYS);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    // One slash effect, reused for every swing.
    this.slash = this.add.sprite(0, 0, 'slash-horizontal', 0).setVisible(false);
    this.slash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.slash.setVisible(false));
    this.swing = { startedAt: null };
    this.spawnRobots();
  }

  override update(time: number, deltaMs: number): void {
    this.now = time;
    // Presses made during a slide are dropped, not saved up.
    const attack = this.keys.takePresses().some((c) => ATTACK_KEYS.has(c));
    if (this.sliding) return;
    this.stepRobots(deltaMs);
    if (attack && this.heroKnockMs <= 0) this.trySwing(time);
    const swinging = isSwinging(this.swing, time, SWORD.durationMs);
    if (swinging) this.swordHits();

    if (this.heroKnockMs > 0) {
      this.knockHero(deltaMs);
    } else if (swinging) {
      // Jarrett plants his feet while the blade is out.
      this.moving = false;
    } else {
      if (this.swingFrom) {
        // The swing just ended: record where he stood, before any walking this frame.
        this.stoodAfterSwing = { ...this.pos };
        this.swingFrom = null;
      }
      this.walk(deltaMs);
    }

    this.touchRobots(time);
    this.collectPickups();
    // Blink while invulnerable.
    this.hero.setAlpha(
      isInvulnerable(this.health, time) && Math.floor(time / 80) % 2 === 0 ? 0.3 : 1,
    );
    this.placeSprite();
    if (isOut(this.health)) {
      // M1: start again from the start room; the real death rules come in M2.7.
      this.scene.restart();
      return;
    }
    if (!swinging && this.heroKnockMs <= 0) {
      const dir = exitDirection(this.pos, HERO.box.height);
      if (dir) this.slideTo(dir);
    }
  }

  private walk(deltaMs: number): void {
    const axis = this.readAxis();
    this.facing = facingFor(axis, this.facing);
    const before = this.pos;
    const { col, row } = this.room;
    this.pos = moveHero(this.pos, axis, (HERO.speed * deltaMs) / 1000, HERO.box, (cx, cy) =>
      solidInWorld(this.world, col, row, cx, cy),
    );
    this.moving = this.pos.x !== before.x || this.pos.y !== before.y;
    this.animate(axis.x !== 0 || axis.y !== 0);
  }

  /** Pushed back after a hit; he can't walk or swing meanwhile. */
  private knockHero(deltaMs: number): void {
    const ms = Math.min(deltaMs, this.heroKnockMs);
    this.heroKnockMs -= ms;
    const { col, row } = this.room;
    // Knockback never pushes him out of the room.
    this.pos = moveHero(
      this.pos,
      facingVector(this.heroKnockDir),
      (HEALTH.knockback.speed * ms) / 1000,
      HERO.box,
      (cx, cy) => this.outsideRoom(cx, cy) || solidInWorld(this.world, col, row, cx, cy),
    );
    this.moving = false;
  }

  private heroBody(): Rect {
    return {
      x: this.pos.x - BODY.halfWidth,
      y: this.pos.y - BODY.height,
      w: BODY.halfWidth * 2,
      h: BODY.height,
    };
  }

  private outsideRoom(cx: number, cy: number): boolean {
    return cx < 0 || cy < 0 || cx >= ROOM_COLS || cy >= ROOM_ROWS;
  }

  /** Robots appear at their start cells each time Jarrett enters a room. */
  private spawnRobots(): void {
    for (const cell of this.world.robots.get(roomKey(this.room.col, this.room.row)) ?? []) {
      this.addRobot({ x: cell.col * TILE + TILE / 2, y: (cell.row + 1) * TILE - 1 });
    }
  }

  private addRobot(feet: Point): void {
    const r = spawnRobot(feet, ROBOT, this.rng);
    const sprite = this.robotPool.take('robot-front').setOrigin(0.5, 1);
    this.robots.push({ r, sprite });
    this.drawRobot({ r, sprite });
  }

  private stepRobots(deltaMs: number): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    // Robots stay in their room.
    const solid = (cx: number, cy: number): boolean =>
      this.outsideRoom(cx, cy) || (room ? isSolid(room, cx, cy) : true);
    for (const live of this.robots) {
      live.r = stepRobot(live.r, deltaMs, ROBOT, this.rng, solid);
      this.drawRobot(live);
    }
  }

  private drawRobot({ r, sprite }: LiveRobot): void {
    const sheet =
      r.facing === 'down' ? 'robot-front' : r.facing === 'up' ? 'robot-back' : 'robot-side';
    sprite.play(animKey(sheet, 'walk'), true);
    // The side sheet faces left.
    sprite.setFlipX(r.facing === 'right');
    if (r.knockMs > 0) sprite.setTint(0xff7070);
    else sprite.clearTint();
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + r.pos.x, o.y + r.pos.y).setDepth(DEPTH.sorted + o.y + r.pos.y);
  }

  /** Every robot under the blade takes one hit per swing; defeated ones vanish in a puff. */
  private swordHits(): void {
    const box = swordBox(this.pos, this.facing, SWORD);
    for (const live of [...this.robots]) {
      if (!overlaps(box, robotBody(live.r, ROBOT))) continue;
      const before = live.r;
      live.r = hitRobot(live.r, SWORD.damage, this.swings, this.facing, ROBOT);
      if (live.r === before) continue;
      this.effect('hit', live.r.pos.x, live.r.pos.y - ROBOT.box.height / 2);
      if (isDefeated(live.r)) this.defeat(live);
    }
  }

  private defeat(live: LiveRobot): void {
    this.robots = this.robots.filter((x) => x !== live);
    this.robotPool.give(live.sprite);
    this.defeated += 1;
    const { x, y } = live.r.pos;
    this.effect('puff', x, y - ROBOT.box.height / 2);
    const drop = rollDrop(this.rng, DROPS);
    if (drop) this.addPickup(drop, live.r.pos);
  }

  private addPickup(kind: Drop, pos: Point): void {
    const sprite =
      kind === 'gem'
        ? this.pickupPool.take('gems').play(animKey('gems', 'teal'))
        : this.pickupPool.take('objects', OBJECT_FRAMES.smallHeart);
    sprite.setOrigin(0.5, 1);
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + pos.x, o.y + pos.y).setDepth(DEPTH.sorted + o.y + pos.y - 1);
    this.pickups.push({ kind, pos: { ...pos }, sprite });
  }

  private collectPickups(): void {
    const body = this.heroBody();
    for (const p of [...this.pickups]) {
      if (!overlaps(body, { x: p.pos.x - 6, y: p.pos.y - 12, w: 12, h: 12 })) continue;
      if (p.kind === 'gem') this.gems += PICKUPS.gemValue;
      else this.health = heal(this.health, PICKUPS.heartHeals);
      this.pickups = this.pickups.filter((x) => x !== p);
      this.pickupPool.give(p.sprite);
    }
  }

  /** Touching a robot hurts, pushes Jarrett away, and makes him briefly invulnerable. */
  private touchRobots(now: number): void {
    if (isInvulnerable(this.health, now)) return;
    const body = this.heroBody();
    const toucher = this.robots.find((live) => overlaps(body, robotBody(live.r, ROBOT)));
    if (!toucher) return;
    this.health = takeDamage(this.health, ROBOT.contactDamage, now, HEALTH.invulnerableMs);
    this.heroKnockMs = HEALTH.knockback.ms;
    this.heroKnockDir = awayFrom(toucher.r.pos, this.pos);
  }

  /** Plays a one-shot effect from the pool at a room position. */
  private effect(sheet: 'hit' | 'puff', x: number, y: number): void {
    const s = this.fxPool.take(sheet);
    const o = this.origin(this.room.col, this.room.row);
    s.setPosition(o.x + x, o.y + y).setDepth(DEPTH.over - 1);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.fxPool.give(s));
    s.play(animKey(sheet, 'play'));
  }

  /** Clears the room's robots and pickups (on leaving it). */
  private clearRoom(): void {
    for (const live of this.robots) this.robotPool.give(live.sprite);
    for (const p of this.pickups) this.pickupPool.give(p.sprite);
    this.robots = [];
    this.pickups = [];
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
      health: { points: this.health.points, max: this.health.max },
      invulnerable: isInvulnerable(this.health, this.now),
      knockedBack: this.heroKnockMs > 0,
      gems: this.gems,
      robots: this.robots.map(({ r }) => ({ x: r.pos.x, y: r.pos.y, health: r.health })),
      pickups: this.pickups.map((p) => ({ kind: p.kind, x: p.pos.x, y: p.pos.y })),
      defeated: this.defeated,
    };
  }

  /** Test hook only: put the hero's feet at a position in the current room (room pixels). */
  placeHero(x: number, y: number, facing?: Facing): void {
    this.pos = { x, y };
    if (facing) {
      this.facing = facing;
      this.animate(false);
    }
    this.placeSprite();
  }

  /** Test hook only: a robot with its feet at a room position. */
  testSpawnRobot(x: number, y: number): void {
    this.addRobot({ x, y });
  }

  /** Test hook only: a pickup at a room position. */
  testSpawnPickup(kind: Drop, x: number, y: number): void {
    this.addPickup(kind, { x, y });
  }

  /** Test hook only: remove every robot in the room. */
  testClearRobots(): void {
    for (const live of this.robots) this.robotPool.give(live.sprite);
    this.robots = [];
  }

  /** Slides the view to the room next door. Jarrett keeps his place on screen and stands still meanwhile. */
  private slideTo(dir: Dir): void {
    const next = neighbour(this.room.col, this.room.row, dir);
    const old = this.roomObjects;
    this.pos = enterFrom(this.pos, dir);
    this.enteredAt = { ...this.pos };
    this.clearRoom();
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
        this.spawnRobots();
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
    const left = k.isDown('ArrowLeft', 'KeyA');
    const right = k.isDown('ArrowRight', 'KeyD');
    const up = k.isDown('ArrowUp', 'KeyW');
    const down = k.isDown('ArrowDown', 'KeyS');
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
