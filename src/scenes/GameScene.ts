import Phaser from 'phaser';
import { OBJECT_FRAMES, animKey } from '../assets/manifest';
import {
  DAGGER,
  DEFAULT_SEED,
  FIREBALL,
  DROPS,
  HEALTH,
  HERO,
  HUD_HEIGHT,
  MANA,
  ROOM_COLS,
  ROOM_ROWS,
  PICKUPS,
  POTIONS,
  ROBOT,
  ROOM_SLIDE_MS,
  SWORD,
  TILE,
} from '../config/tuning';
import { Hud } from '../entities/Hud';
import { SpritePool } from '../entities/SpritePool';
import { KeyInput } from '../input/keyboard';
import { rollDrop, type Drop } from '../logic/drops';
import {
  canThrow,
  projectileBox,
  otherMode,
  launch,
  stepProjectile,
  type Projectile,
  type WeaponMode,
} from '../logic/weapons';
import { fullHealth, heal, isInvulnerable, isOut, takeDamage, type Health } from '../logic/health';
import { awayFrom, facingFor, moveHero, type Facing } from '../logic/hero';
import { boost, canCast, fullMana, isBoosted, refill, spend, type Mana } from '../logic/mana';
import { addPotion, usePotion, type PotionKind, type Potions } from '../logic/potions';
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
  pickups: { kind: PickupKind; x: number; y: number }[];
  /** Robots defeated since the game started. */
  defeated: number;
  /** Which weapon the attack key uses. */
  mode: WeaponMode;
  daggers: { x: number; y: number; dir: Facing }[];
  fireballs: { x: number; y: number; dir: Facing }[];
  mana: { current: number; max: number };
  /** Fireballs cast so far. */
  casts: number;
  potions: Potions;
  /** True while a Mana Brew is speeding up mana. */
  manaBoosted: boolean;
  /** Daggers thrown so far, and whether another may be thrown now. */
  thrown: number;
  throwReady: boolean;
}

type ShotKind = 'dagger' | 'fireball';

/** Something flying: a thrown dagger or a fireball. */
interface Shot {
  kind: ShotKind;
  d: Projectile;
  sprite: Phaser.GameObjects.Sprite;
}

const SHOT_TUNING: Readonly<Record<ShotKind, typeof DAGGER | typeof FIREBALL>> = {
  dagger: DAGGER,
  fireball: FIREBALL,
};

/** Sprite angle for a dagger flying each way (the art points right). */
const DAGGER_ANGLE: Readonly<Record<Facing, number>> = { right: 0, down: 90, left: 180, up: -90 };
/** Projectile hits use ids far above any swing number, so the two never clash. */
const SHOT_HIT_IDS = 1_000_000;

interface LiveRobot {
  r: Robot;
  sprite: Phaser.GameObjects.Sprite;
}

/** Things on the ground: drops, and potions. */
export type PickupKind = Drop | 'health-potion' | 'mana-brew';

interface Pickup {
  kind: PickupKind;
  pos: Point;
  sprite: Phaser.GameObjects.Sprite;
}

/** Jarrett's body, for touching enemies and pickups: 10 px wide, 20 px tall above his feet. */
const BODY = { halfWidth: 5, height: 20 } as const;

/** Depth layers: ground, then props and the hero sorted by their feet, then tree tops, then the HUD. */
const DEPTH = { ground: 0, sorted: 10, over: 1_000_000, hud: 2_000_000 } as const;

const ROOM_W = ROOM_COLS * TILE;
const ROOM_H = ROOM_ROWS * TILE;

/** Keys that attack with the ready weapon, and that switch near and far. */
const ATTACK_KEYS: ReadonlySet<string> = new Set(['Space', 'KeyJ']);
const SWITCH_KEYS: ReadonlySet<string> = new Set(['KeyX', 'KeyK']);
/** Keys that cast the ready spell. */
const SPELL_KEYS: ReadonlySet<string> = new Set(['KeyC', 'KeyL']);
/** Keys that drink a potion. */
const POTION_KEYS: Readonly<Record<string, PotionKind>> = { Digit1: 'health', Digit2: 'mana' };
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
  ...SWITCH_KEYS,
  ...SPELL_KEYS,
  ...Object.keys(POTION_KEYS),
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
  private hud!: Hud;
  /** Test hook only: robots stop wandering (knockback still moves them). */
  private robotsHold = false;
  private mode: WeaponMode = 'near';
  private shots: Shot[] = [];
  private shotPool!: SpritePool;
  private shotIds = 0;
  private thrown = 0;
  private casts = 0;
  private mana: Mana = fullMana(MANA.max);
  private lastCastAt: number | null = null;
  private potions: Potions = { ...POTIONS.start };
  private lastThrowAt: number | null = null;
  /** Jarrett stands still until this time after a throw. */
  private throwUntil = 0;

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
    this.robotsHold = false;
    this.mode = 'near';
    this.shots = [];
    this.shotPool = new SpritePool(this);
    this.shotIds = 0;
    this.thrown = 0;
    this.casts = 0;
    this.mana = fullMana(MANA.max);
    this.lastCastAt = null;
    this.potions = { ...POTIONS.start };
    this.lastThrowAt = null;
    this.throwUntil = 0;
    this.robotPool = new SpritePool(this);
    this.pickupPool = new SpritePool(this);
    this.fxPool = new SpritePool(this);
    this.room = { ...START_ROOM };
    this.sliding = false;
    this.enteredAt = null;
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
    this.cameras.main.setScroll(this.room.col * ROOM_W, this.room.row * ROOM_H);
    this.hud = new Hud(this, DEPTH.hud);

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
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions);
  }

  override update(time: number, deltaMs: number): void {
    this.now = time;
    // Presses made during a slide are dropped, not saved up.
    const presses = this.keys.takePresses();
    if (this.sliding) return;
    for (const code of presses) {
      if (SWITCH_KEYS.has(code)) this.mode = otherMode(this.mode);
      const potion = POTION_KEYS[code];
      if (potion) this.drink(potion, time);
    }
    const attack = presses.some((c) => ATTACK_KEYS.has(c));
    const cast = presses.some((c) => SPELL_KEYS.has(c));
    this.mana = refill(this.mana, time, deltaMs, MANA);
    this.stepRobots(deltaMs);
    this.stepShots(deltaMs);
    if (attack && this.heroKnockMs <= 0) {
      if (this.mode === 'near') this.trySwing(time);
      else this.tryThrow(time);
    } else if (cast && this.heroKnockMs <= 0) {
      this.tryCast(time);
    }
    const swinging = isSwinging(this.swing, time, SWORD.durationMs);
    if (swinging) this.swordHits();
    const busy = swinging || time < this.throwUntil;

    if (this.heroKnockMs > 0) {
      this.knockHero(deltaMs);
    } else if (busy) {
      // Jarrett plants his feet while the blade is out or a dagger leaves his hand.
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
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions);
    if (isOut(this.health)) {
      // M1: start again from the start room; the real death rules come in M2.7.
      this.scene.restart();
      return;
    }
    if (!busy && this.heroKnockMs <= 0) {
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
      if (this.robotsHold && live.r.knockMs <= 0) continue;
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

  private addPickup(kind: PickupKind, pos: Point): void {
    const sprite =
      kind === 'gem'
        ? this.pickupPool.take('gems').play(animKey('gems', 'teal'))
        : kind === 'mana-brew'
          ? this.pickupPool.take('mana-brew')
          : this.pickupPool.take(
              'objects',
              kind === 'heart' ? OBJECT_FRAMES.smallHeart : OBJECT_FRAMES.potion,
            );
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
      else if (p.kind === 'heart') this.health = heal(this.health, PICKUPS.heartHeals);
      else {
        const got = addPotion(
          this.potions,
          p.kind === 'health-potion' ? 'health' : 'mana',
          POTIONS.max,
        );
        // With no room in his bag, he leaves it on the ground.
        if (!got.taken) continue;
        this.potions = got.potions;
      }
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

  /** Throws a dagger the way Jarrett faces, if one is allowed now. */
  private tryThrow(now: number): void {
    if (
      !canThrow(
        this.countShots('dagger'),
        DAGGER.maxInFlight,
        this.lastThrowAt,
        now,
        DAGGER.cooldownMs,
      )
    ) {
      return;
    }
    this.thrown += 1;
    this.lastThrowAt = now;
    this.throwUntil = now + DAGGER.throwPauseMs;
    this.shoot('dagger');
  }

  /** Casts a Fireball, if there's enough mana and none is already flying. */
  private tryCast(now: number): void {
    if (!canCast(this.mana, FIREBALL.cost)) return;
    if (
      !canThrow(
        this.countShots('fireball'),
        FIREBALL.maxInFlight,
        this.lastCastAt,
        now,
        FIREBALL.cooldownMs,
      )
    ) {
      return;
    }
    this.mana = spend(this.mana, FIREBALL.cost, now);
    this.casts += 1;
    this.lastCastAt = now;
    this.throwUntil = now + FIREBALL.castPauseMs;
    this.shoot('fireball');
  }

  private shoot(kind: ShotKind): void {
    this.animate(false);
    this.shotIds += 1;
    const d = launch(SHOT_HIT_IDS + this.shotIds, this.pos, this.facing, SWORD.bodyHeight);
    const sprite = this.shotPool.take(kind === 'dagger' ? 'dagger' : 'fire-ball');
    sprite.setAngle(DAGGER_ANGLE[d.dir]);
    if (kind === 'fireball') sprite.play(animKey('fire-ball', 'fly'));
    const shot = { kind, d, sprite };
    this.shots.push(shot);
    this.drawShot(shot);
  }

  private countShots(kind: ShotKind): number {
    return this.shots.filter((s) => s.kind === kind).length;
  }

  private shotsOf(kind: ShotKind): { x: number; y: number; dir: Facing }[] {
    return this.shots
      .filter((s) => s.kind === kind)
      .map(({ d }) => ({ x: d.pos.x, y: d.pos.y, dir: d.dir }));
  }

  /** Flies every dagger and fireball; one that hits a wall, a robot, or the end of its range is gone. */
  private stepShots(deltaMs: number): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    const solid = (cx: number, cy: number): boolean =>
      this.outsideRoom(cx, cy) || (room ? isSolid(room, cx, cy) : true);
    for (const shot of [...this.shots]) {
      const t = SHOT_TUNING[shot.kind];
      const step = stepProjectile(shot.d, deltaMs, t, solid);
      shot.d = step.projectile;
      const box = projectileBox(shot.d, t);
      const target = this.robots.find((r) => overlaps(box, robotBody(r.r, ROBOT)));
      if (target) {
        target.r = hitRobot(target.r, t.damage, shot.d.id, shot.d.dir, ROBOT);
        this.effect('hit', target.r.pos.x, target.r.pos.y - ROBOT.box.height / 2);
        if (isDefeated(target.r)) this.defeat(target);
      }
      if (target || step.stopped) this.dropShot(shot);
      else this.drawShot(shot);
    }
  }

  private drawShot({ d, sprite }: Shot): void {
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + d.pos.x, o.y + d.pos.y).setDepth(DEPTH.over - 2);
  }

  private dropShot(shot: Shot): void {
    this.shots = this.shots.filter((x) => x !== shot);
    this.shotPool.give(shot.sprite.setAngle(0));
  }

  /**
   * Drinks a potion, if he has one. A Health Potion refills every heart (and
   * isn't wasted when he's already well); a Mana Brew speeds up mana.
   */
  private drink(kind: PotionKind, now: number): void {
    if (kind === 'health' && this.health.points >= this.health.max) return;
    const r = usePotion(this.potions, kind);
    if (!r.used) return;
    this.potions = r.potions;
    if (kind === 'health') this.health = heal(this.health, this.health.max);
    else this.mana = boost(this.mana, now, MANA.boostMs);
  }

  /** Clears the room's robots and pickups (on leaving it). */
  private clearRoom(): void {
    for (const shot of [...this.shots]) this.dropShot(shot);
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
      mode: this.mode,
      daggers: this.shotsOf('dagger'),
      fireballs: this.shotsOf('fireball'),
      mana: { current: this.mana.current, max: this.mana.max },
      casts: this.casts,
      potions: { ...this.potions },
      manaBoosted: isBoosted(this.mana, this.now),
      thrown: this.thrown,
      throwReady: canThrow(
        this.countShots('dagger'),
        DAGGER.maxInFlight,
        this.lastThrowAt,
        this.now,
        DAGGER.cooldownMs,
      ),
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
  testSpawnPickup(kind: PickupKind, x: number, y: number): void {
    this.addPickup(kind, { x, y });
  }

  /** Test hook only: stop (or restart) robots wandering, so a test can aim at one. */
  testHoldRobots(hold: boolean): void {
    this.robotsHold = hold;
  }

  /** Test hook only: set the mana level. */
  testSetMana(current: number): void {
    this.mana = { ...this.mana, current: Math.max(0, Math.min(this.mana.max, current)) };
  }

  /** Test hook only: what the status bar shows. */
  hudShows(): {
    hearts: ('full' | 'half' | 'empty')[];
    gems: string;
    weapon: string;
    manaWidth: number;
    potions: { health: string; mana: string };
  } {
    return this.hud.shows();
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
