import Phaser from 'phaser';
import { OBJECT_FRAMES, animKey } from '../assets/manifest';
import {
  DAGGER,
  DEATH,
  DEFAULT_SEED,
  GAME_HEIGHT,
  GAME_WIDTH,
  FIREBALL,
  DROPS,
  HEALTH,
  HERO,
  HUD,
  HUD_HEIGHT,
  MANA,
  ROOM_COLS,
  ROOM_ROWS,
  PICKUPS,
  POTIONS,
  ENEMIES,
  ENEMY_SHOT,
  ROOM_SLIDE_MS,
  STONE,
  TRAVEL,
  SHIELD,
  SWORD,
  TILE,
} from '../config/tuning';
import { ITEM_ICON } from '../assets/itemIcons';
import { Sfx } from '../audio/Sfx';
import type { SfxName } from '../config/tuning';
import { Hud } from '../entities/Hud';
import { SpritePool } from '../entities/SpritePool';
import { KeyInput } from '../input/keyboard';
import { fallMessage, gemsAfterFalling } from '../logic/death';
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
import { EMPTY_INVENTORY, give, type Inventory, type ItemId } from '../logic/inventory';
import {
  NEW_PROGRESS,
  addKey,
  fixtureId,
  isOpened,
  keysIn,
  openChest,
  unlockDoor,
  type Progress,
} from '../logic/progress';
import { NO_LEAN, lean, stoneAt, type Lean, type Stone } from '../logic/push';
import { createRng, type Rng } from '../logic/rng';
import { shieldBlocks } from '../logic/shield';
import {
  enemyBody,
  hitEnemy,
  isDefeated,
  spawnEnemy,
  stepEnemy,
  type Enemy,
  type EnemyKind,
} from '../logic/enemies';
import { fireShot, shotBox, stepShot, type EnemyShot } from '../logic/enemyShots';
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
import { PROP_SHEET, dungeonArt, roomArt } from '../logic/tiles';
import {
  buildWorld,
  cellsAhead,
  enterFrom,
  exitAt,
  exitDirection,
  neighbour,
  roomKey,
  solidInWorld,
  type ChestContents,
  type MapExit,
  type World,
} from '../logic/world';
import { DUNGEON_MAPS, MAPS, type MapId } from '../world/maps';
import type { InventoryHost } from './InventoryScene';

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  /** The hero's feet, in room pixels (0,0 is the room's top-left corner, below the status bar). */
  player: Point;
  facing: Facing;
  moving: boolean;
  seed: number;
  /** The map he is on, and the room in it. */
  map: MapId;
  room: { col: number; row: number };
  /** True while the view slides to the next room, and while travelling to another map. */
  sliding: boolean;
  travelling: boolean;
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
  /** `knocked`: still being pushed back by a hit. */
  enemies: {
    kind: EnemyKind;
    x: number;
    y: number;
    health: number;
    charging: boolean;
    knocked: boolean;
  }[];
  /** True while he is down after running out of hearts; and how often that has happened. */
  falling: boolean;
  falls: number;
  /** How many times each sound has played, and whether sound is muted. */
  sounds: Record<SfxName, number>;
  muted: boolean;
  /** Enemy shots in the air, how many have been fired, and how many the shield has blocked. */
  enemyShots: { x: number; y: number }[];
  shotsFired: number;
  blocked: number;
  pickups: { kind: PickupKind; x: number; y: number }[];
  /** Small keys held on this map, and the ids of opened doors and chests. */
  keys: number;
  opened: string[];
  /** The current room's pushable stones, by cell. */
  stones: { cx: number; cy: number }[];
  /** Enemies defeated since the game started. */
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

interface LiveEnemy {
  e: Enemy;
  sprite: Phaser.GameObjects.Sprite;
}

/** Things on the ground: drops, and potions. */
export type PickupKind = Drop | 'health-potion' | 'mana-brew' | 'key' | 'item';

interface LiveEnemyShot {
  s: EnemyShot;
  sprite: Phaser.GameObjects.Sprite;
}

/**
 * How each enemy's art sits on its feet. Side-view kinds face right in the
 * art and are mirrored to face left; the robot has a sheet per facing.
 */
const ENEMY_ART: Readonly<
  Record<Exclude<EnemyKind, 'robot'>, { sheet: string; anim: string; feetY: number }>
> = {
  bird: { sheet: 'bird', anim: 'fly', feetY: 30 / 32 },
  eye: { sheet: 'eye', anim: 'fly', feetY: 39 / 48 },
  ghost: { sheet: 'ghost', anim: 'fly', feetY: 52 / 64 },
  wolf: { sheet: 'wolf', anim: 'run', feetY: 1 },
};

interface Pickup {
  kind: PickupKind;
  pos: Point;
  sprite: Phaser.GameObjects.Sprite;
  /** Gems from a chest count several; a single dropped gem counts one. */
  amount: number;
  /** For an item from a chest: which one. */
  item: ItemId | null;
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
/** Mutes and unmutes the sound. */
const MUTE_KEY = 'KeyM';
/** Keys that open the inventory. */
const INVENTORY_KEYS: ReadonlySet<string> = new Set(['KeyI', 'Tab']);
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
  ...INVENTORY_KEYS,
  MUTE_KEY,
]);

/**
 * The overworld. Each room is drawn at its own place in world space (column
 * × 320, row × 160, below the status bar). The camera shows one room and
 * slides to the next when Jarrett walks through a gap (ADR-D02).
 */
export class GameScene extends Phaser.Scene implements InventoryHost {
  private hero!: Phaser.GameObjects.Sprite;
  private pos: Point = { x: 0, y: 0 };
  private facing: Facing = 'down';
  private moving = false;
  private keys!: KeyInput;
  private seed = DEFAULT_SEED;
  private world!: World;
  private mapId: MapId = 'overworld';
  private room: { col: number; row: number } = { ...MAPS.overworld.start };
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
  private enemies: LiveEnemy[] = [];
  private enemyShots: LiveEnemyShot[] = [];
  private blocked = 0;
  private shotsFired = 0;
  private pickups: Pickup[] = [];
  private enemyPool!: SpritePool;
  private pickupPool!: SpritePool;
  private fxPool!: SpritePool;
  private hud!: Hud;
  /** Test hook only: enemies stop moving and shooting (knockback still moves them). */
  private enemiesHold = false;
  private mode: WeaponMode = 'near';
  private shots: Shot[] = [];
  private shotPool!: SpritePool;
  private shotIds = 0;
  private thrown = 0;
  private casts = 0;
  private mana: Mana = fullMana(MANA.max);
  private lastCastAt: number | null = null;
  private potions: Potions = { ...POTIONS.start };
  private inv: Inventory = EMPTY_INVENTORY;
  /** Opened doors and chests, and small keys held. */
  private progress: Progress = NEW_PROGRESS;
  /** The current room's pushable stones (reset on entering a room), and their sprites. */
  private stones: readonly Stone[] = [];
  private stoneSprites: Phaser.GameObjects.Image[] = [];
  private lean: Lean = NO_LEAN;
  /** True while the screen is dark, travelling through a doorway to another map. */
  private travelling = false;
  /** True from the moment he runs out of hearts until he is back on his feet. */
  private falling = false;
  private falls = 0;
  private sfx!: Sfx;
  /**
   * The game's own mute switch. Phaser reports mute from the audio graph,
   * which doesn't update while the browser holds audio back (before the
   * player's first click or key), so the game keeps its own record.
   */
  private muted = false;
  private lastThrowAt: number | null = null;
  /** Jarrett stands still until this time after a throw. */
  private throwUntil = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.seed = seedFromUrl();
    this.rng = createRng(this.seed);
    this.mapId = mapFromUrl();
    this.world = buildWorld(MAPS[this.mapId].rooms);
    this.health = fullHealth(HEALTH.startHearts);
    this.gems = 0;
    this.defeated = 0;
    this.heroKnockMs = 0;
    this.enemies = [];
    this.enemyShots = [];
    this.blocked = 0;
    this.shotsFired = 0;
    this.pickups = [];
    this.enemiesHold = false;
    this.mode = 'near';
    this.shots = [];
    this.shotPool = new SpritePool(this);
    this.shotIds = 0;
    this.thrown = 0;
    this.casts = 0;
    this.mana = fullMana(MANA.max);
    this.lastCastAt = null;
    this.potions = { ...POTIONS.start };
    this.progress = NEW_PROGRESS;
    this.travelling = false;
    this.falling = false;
    this.falls = 0;
    this.sfx = new Sfx(this);
    // A restart (or a new game) keeps the player's mute choice.
    this.muted = this.sound.mute;
    // M2: Jarrett starts with the whole kit so far; later Walker and the dungeons hand items out.
    this.inv = (['wooden-sword', 'daggers', 'fireball', 'wooden-shield'] as const).reduce(
      give,
      EMPTY_INVENTORY,
    );
    this.lastThrowAt = null;
    this.throwUntil = 0;
    this.enemyPool = new SpritePool(this);
    this.pickupPool = new SpritePool(this);
    this.fxPool = new SpritePool(this);
    this.room = { ...MAPS[this.mapId].start };
    this.sliding = false;
    this.enteredAt = null;
    this.resetStones();
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
    this.cameras.main.setScroll(this.room.col * ROOM_W, this.room.row * ROOM_H);
    this.hud = new Hud(this, DEPTH.hud);

    this.pos = { x: HERO.start.col * TILE, y: (HERO.start.row + 1) * TILE - HERO.start.lift };
    this.hero = this.add.sprite(0, 0, 'jarrett', 0).setOrigin(0.5, HERO.feetY / HERO.frameHeight);
    this.placeSprite();

    this.keys = new KeyInput(KEYS);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keys.destroy());
    // Keys pressed while the inventory was open belong to it, not to the game.
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.keys.takePresses());
    // One slash effect, reused for every swing.
    this.slash = this.add.sprite(0, 0, 'slash-horizontal', 0).setVisible(false);
    this.slash.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.slash.setVisible(false));
    this.swing = { startedAt: null };
    this.spawnEnemies();
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions, this.hudKeys());
  }

  override update(time: number, deltaMs: number): void {
    this.now = time;
    // Presses made during a slide are dropped, not saved up.
    const presses = this.keys.takePresses();
    if (this.sliding || this.falling || this.travelling) return;
    if (presses.some((c) => INVENTORY_KEYS.has(c)) && this.heroKnockMs <= 0) {
      this.openInventory();
      return;
    }
    for (const code of presses) {
      if (code === MUTE_KEY) {
        this.muted = !this.muted;
        this.sound.mute = this.muted;
      }
      if (SWITCH_KEYS.has(code)) this.mode = otherMode(this.mode);
      const potion = POTION_KEYS[code];
      if (potion) this.drink(potion, time);
    }
    const attack = presses.some((c) => ATTACK_KEYS.has(c));
    const cast = presses.some((c) => SPELL_KEYS.has(c));
    this.mana = refill(this.mana, time, deltaMs, MANA);
    this.stepEnemies(deltaMs);
    this.stepEnemyShots(deltaMs, time);
    this.stepShots(deltaMs);
    if (attack && this.heroKnockMs <= 0) {
      if (this.mode === 'near') {
        if (this.inv.equipped.near) this.trySwing(time);
      } else if (this.inv.equipped.far === 'daggers') {
        this.tryThrow(time);
      }
    } else if (cast && this.heroKnockMs <= 0 && this.inv.equipped.spell === 'fireball') {
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

    this.touchEnemies(time);
    this.collectPickups();
    // Blink while invulnerable.
    this.hero.setAlpha(
      isInvulnerable(this.health, time) && Math.floor(time / 80) % 2 === 0 ? 0.3 : 1,
    );
    this.placeSprite();
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions, this.hudKeys());
    if (isOut(this.health)) {
      this.fall();
      return;
    }
    if (!busy && this.heroKnockMs <= 0) {
      // A doorway to another map under his feet takes him there.
      const way = exitAt(
        this.world,
        roomKey(this.room.col, this.room.row),
        Math.floor(this.pos.x / TILE),
        Math.floor((this.pos.y - 1) / TILE),
      );
      if (way) {
        this.travel(way);
        return;
      }
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
      this.solidAt(col, row, cx, cy),
    );
    this.moving = this.pos.x !== before.x || this.pos.y !== before.y;
    this.animate(axis.x !== 0 || axis.y !== 0);
    // Walking into a locked door or a chest tries to open it; into a stone, leans on it.
    if ((axis.x !== 0 || axis.y !== 0) && !this.moving) {
      this.bump();
      this.leanOnStone(deltaMs);
    } else {
      this.lean = NO_LEAN;
    }
  }

  /** Leaning on a stone long enough slides it one cell (if the cell beyond is clear). */
  private leanOnStone(deltaMs: number): void {
    const ahead = cellsAhead(this.pos, this.facing, HERO.box)
      .map(({ cx, cy }) => stoneAt(this.stones, cx, cy))
      .find((i) => i >= 0);
    if (ahead === undefined) {
      this.lean = NO_LEAN;
      return;
    }
    const { col, row } = this.room;
    const r = lean(
      this.stones,
      this.lean,
      ahead,
      this.facing,
      deltaMs,
      STONE.pushMs,
      (cx, cy) =>
        !this.outsideRoom(cx, cy) && !this.solidAt(col, row, cx, cy) && !this.enemyIn(cx, cy),
    );
    this.stones = r.stones;
    this.lean = r.lean;
    if (r.moved === null) return;
    const sprite = this.stoneSprites[r.moved];
    const to = this.stones[r.moved];
    if (!sprite || !to) return;
    const o = this.origin(this.room.col, this.room.row);
    this.sfx.play('push');
    this.tweens.add({
      targets: sprite,
      x: o.x + to.cx * TILE,
      y: o.y + to.cy * TILE,
      duration: STONE.slideMs,
      onComplete: () => sprite.setDepth(DEPTH.sorted + o.y + (to.cy + 1) * TILE),
    });
  }

  /** Whether an enemy's feet are in a cell (a stone won't slide onto one). */
  private enemyIn(cx: number, cy: number): boolean {
    return this.enemies.some(
      ({ e }) => Math.floor(e.pos.x / TILE) === cx && Math.floor((e.pos.y - 1) / TILE) === cy,
    );
  }

  /** On entering a room, its stones go back to where they started. */
  private resetStones(): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    this.stones = [...(room?.stones ?? [])];
    this.lean = NO_LEAN;
  }

  /** Walls, props, and doors and chests not yet opened, reaching into the rooms next door. */
  private solidAt(col: number, row: number, cx: number, cy: number): boolean {
    if (stoneAt(this.stones, cx, cy) >= 0) return true;
    return solidInWorld(this.world, col, row, cx, cy, (key, x, y) =>
      isOpened(this.progress, fixtureId(this.mapId, key, x, y)),
    );
  }

  /** The small-key count for the status bar: in a dungeon only. */
  private hudKeys(): number | null {
    return MAPS[this.mapId].theme === 'dungeon' ? keysIn(this.progress, this.mapId) : null;
  }

  /** Jarrett walked into something: if it's a locked door he unlocks it with a key; a chest, he opens it. */
  private bump(): void {
    for (const { cx, cy } of cellsAhead(this.pos, this.facing, HERO.box)) this.bumpInto(cx, cy);
  }

  private bumpInto(cx: number, cy: number): void {
    const key = roomKey(this.room.col, this.room.row);
    const room = this.world.rooms.get(key);
    const fixture = room?.cells[cy]?.[cx]?.fixture;
    if (!fixture) return;
    const id = fixtureId(this.mapId, key, cx, cy);
    if (isOpened(this.progress, id)) return;
    if (fixture === 'door') {
      const r = unlockDoor(this.progress, this.mapId, id);
      if (!r.unlocked) return;
      // A door is two cells wide: the key opens both halves.
      let progress = r.progress;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        if (room?.cells[cy + dy]?.[cx + dx]?.fixture === 'door') {
          const other = fixtureId(this.mapId, key, cx + dx, cy + dy);
          if (!isOpened(progress, other))
            progress = { ...progress, opened: [...progress.opened, other] };
        }
      }
      this.progress = progress;
      this.sfx.play('unlock');
      this.redrawRoom();
      return;
    }
    const contents = this.world.chests
      .get(key)
      ?.find((c) => c.col === cx && c.row === cy)?.contents;
    if (!contents) return;
    this.progress = openChest(this.progress, id);
    this.sfx.play('chest');
    const at = { x: cx * TILE + TILE / 2, y: (cy + 1) * TILE - 1 };
    this.effect('puff', at.x, at.y - TILE / 2);
    this.redrawRoom();
    this.dropContents(contents, at);
  }

  /** What falls out of a chest. */
  private dropContents(c: ChestContents, at: Point): void {
    if (c.kind === 'key') this.addPickup('key', at);
    else if (c.kind === 'gems') this.addPickup('gem', at, c.amount);
    else if (c.kind === 'item') this.addPickup('item', at, 1, c.item);
    else this.addPickup(c.potion === 'health' ? 'health-potion' : 'mana-brew', at);
  }

  /** Draws the current room again (after a door or chest opens). */
  private redrawRoom(): void {
    for (const o of this.roomObjects) o.destroy();
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
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
      (cx, cy) => this.outsideRoom(cx, cy) || this.solidAt(col, row, cx, cy),
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

  /** Enemies appear at their start cells each time Jarrett enters a room. */
  private spawnEnemies(): void {
    for (const p of this.world.enemies.get(roomKey(this.room.col, this.room.row)) ?? []) {
      this.addEnemy(p.kind, { x: p.col * TILE + TILE / 2, y: (p.row + 1) * TILE - 1 });
    }
  }

  private addEnemy(kind: EnemyKind, feet: Point): void {
    const e = spawnEnemy(kind, feet, ENEMIES[kind], this.rng);
    const art = kind === 'robot' ? null : ENEMY_ART[kind];
    const sprite = this.enemyPool
      .take(art ? art.sheet : 'robot-front')
      .setOrigin(0.5, art ? art.feetY : 1);
    const live = { e, sprite };
    this.enemies.push(live);
    this.drawEnemy(live);
  }

  private stepEnemies(deltaMs: number): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    // Everyone stays in the room; walkers are also stopped by walls and trees.
    const flySolid = (cx: number, cy: number): boolean => this.outsideRoom(cx, cy);
    const walkSolid = (cx: number, cy: number): boolean =>
      flySolid(cx, cy) || (room ? isSolid(room, cx, cy) : true);
    for (const live of this.enemies) {
      if (this.enemiesHold && live.e.knockMs <= 0) continue;
      const step = stepEnemy(live.e, deltaMs, ENEMIES[live.e.kind], {
        hero: this.pos,
        rng: this.rng,
        walkSolid,
        flySolid,
      });
      live.e = step.enemy;
      if (step.shot) this.addEnemyShot(step.shot.from, step.shot.dir);
      this.drawEnemy(live);
    }
  }

  private drawEnemy({ e, sprite }: LiveEnemy): void {
    if (e.kind === 'robot') {
      const sheet =
        e.facing === 'down' ? 'robot-front' : e.facing === 'up' ? 'robot-back' : 'robot-side';
      sprite.play(animKey(sheet, 'walk'), true);
      // The robot's side sheet faces left.
      sprite.setFlipX(e.facing === 'right');
    } else {
      const art = ENEMY_ART[e.kind];
      sprite.play(animKey(art.sheet, art.anim), true);
      // These face right in the art; facing up or down keeps the last side.
      if (e.facing === 'left') sprite.setFlipX(true);
      if (e.facing === 'right') sprite.setFlipX(false);
    }
    if (e.knockMs > 0) sprite.setTint(0xff7070);
    else sprite.clearTint();
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + e.pos.x, o.y + e.pos.y).setDepth(DEPTH.sorted + o.y + e.pos.y);
  }

  /**
   * Out of hearts: the screen goes dark with a message, and Jarrett is back on
   * his feet in the start room (the village, once there is one) with full
   * hearts and mana. He keeps his items and potions, and drops a share of his gems.
   */
  private fall(): void {
    this.falling = true;
    this.moving = false;
    this.heroKnockMs = 0;
    this.animate(false);
    this.sfx.play('fall');
    const kept = gemsAfterFalling(this.gems, DEATH.gemLossPercent);
    const lost = this.gems - kept;
    this.gems = kept;
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions, this.hudKeys());
    const veil = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 10)
      .setAlpha(0);
    this.tweens.add({
      targets: veil,
      alpha: 1,
      duration: DEATH.fadeOutMs,
      onComplete: () => {
        const lines = fallMessage(lost);
        const text = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, lines.join('\n'), {
            fontFamily: HUD.font,
            fontSize: '8px',
            color: '#e8f4f0',
            align: 'center',
            lineSpacing: 6,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(DEPTH.hud + 11);
        this.time.delayedCall(DEATH.darkMs, () => {
          text.destroy();
          this.respawn();
          this.tweens.add({
            targets: veil,
            alpha: 0,
            duration: DEATH.fadeInMs,
            onComplete: () => veil.destroy(),
          });
        });
      },
    });
  }

  /** Back on his feet at the start of the map he fell in (a dungeon's entrance; the start room outdoors). */
  private respawn(): void {
    this.clearRoom();
    for (const o of this.roomObjects) o.destroy();
    this.room = { ...MAPS[this.mapId].start };
    this.resetStones();
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
    this.cameras.main.setScroll(this.room.col * ROOM_W, this.room.row * ROOM_H);
    this.pos = { x: HERO.start.col * TILE, y: (HERO.start.row + 1) * TILE - HERO.start.lift };
    this.facing = 'down';
    this.enteredAt = null;
    this.swing = { startedAt: null };
    this.throwUntil = 0;
    this.health = { ...this.health, points: this.health.max, invulnerableUntil: 0 };
    this.mana = fullMana(this.mana.max);
    this.animate(false);
    this.placeSprite();
    this.hero.setAlpha(1);
    this.spawnEnemies();
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions, this.hudKeys());
    this.falls += 1;
    this.falling = false;
  }

  /** Through a doorway: the screen goes dark, and he is on the other map. */
  private travel(way: MapExit): void {
    this.travelling = true;
    this.moving = false;
    this.animate(false);
    const veil = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1)
      .setAlpha(0);
    this.tweens.add({
      targets: veil,
      alpha: 1,
      duration: TRAVEL.fadeMs,
      onComplete: () => {
        this.arrive(way);
        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: TRAVEL.fadeMs,
          onComplete: () => {
            veil.destroy();
            this.travelling = false;
          },
        });
      },
    });
  }

  /** Puts Jarrett on the far side of a doorway, on its map. */
  private arrive(way: MapExit): void {
    this.clearRoom();
    for (const o of this.roomObjects) o.destroy();
    this.mapId = way.to.map as MapId;
    this.world = buildWorld(MAPS[this.mapId].rooms);
    this.room = { ...way.to.room };
    this.resetStones();
    this.roomObjects = this.drawRoom(this.room.col, this.room.row);
    this.cameras.main.setScroll(this.room.col * ROOM_W, this.room.row * ROOM_H);
    this.pos = { ...way.to.feet };
    this.facing = way.to.facing;
    this.enteredAt = { ...this.pos };
    this.animate(false);
    this.placeSprite();
    this.spawnEnemies();
    this.hud.update(this.health, this.gems, this.mode, this.mana, this.potions, this.hudKeys());
  }

  /** Pauses the game and shows the inventory over it. */
  private openInventory(): void {
    this.moving = false;
    this.animate(false);
    this.sfx.play('menu');
    this.scene.launch('Inventory', { host: this });
    this.scene.pause();
  }

  inventory(): Inventory {
    return this.inv;
  }

  setInventory(inv: Inventory): void {
    this.inv = inv;
  }

  heldPotions(): Potions {
    return this.potions;
  }

  heldGems(): number {
    return this.gems;
  }

  /** Shards and keys arrive with the dungeons (M3); none yet. */
  heldShards(): number {
    return 0;
  }

  heldKeys(): number {
    return 0;
  }

  /** Swinging, throwing, casting, or being knocked back: the shield isn't up. */
  private handsBusy(now: number): boolean {
    return (
      isSwinging(this.swing, now, SWORD.durationMs) || now < this.throwUntil || this.heroKnockMs > 0
    );
  }

  private addEnemyShot(from: Point, dir: { x: number; y: number }): void {
    const s = fireShot(from, dir);
    this.shotsFired += 1;
    this.sfx.play('enemyShot');
    const sprite = this.enemyPool.take('enemy-shot').play(animKey('enemy-shot', 'fly'));
    const live = { s, sprite };
    this.enemyShots.push(live);
    this.drawEnemyShot(live);
  }

  /** Flies enemy shots; one that reaches a wall or tree, or the end of its range, is gone. One that hits Jarrett hurts him. */
  private stepEnemyShots(deltaMs: number, now: number): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    const solid = (cx: number, cy: number): boolean =>
      this.outsideRoom(cx, cy) || (room ? isSolid(room, cx, cy) : true);
    for (const live of [...this.enemyShots]) {
      if (this.enemiesHold) continue;
      const step = stepShot(live.s, deltaMs, ENEMY_SHOT, solid);
      live.s = step.shot;
      const hit = overlaps(shotBox(live.s, ENEMY_SHOT), this.heroBody());
      if (hit) {
        const shieldUp = this.inv.equipped.shield !== null && !this.handsBusy(now);
        if (shieldUp && shieldBlocks(this.facing, live.s.dir, false, SHIELD.coverCos)) {
          this.blocked += 1;
          this.sfx.play('block');
          this.effect('hit', live.s.pos.x, live.s.pos.y);
        } else {
          this.hurtHero(ENEMY_SHOT.damage, live.s.pos, now);
        }
      }
      if (hit || step.stopped) this.dropEnemyShot(live);
      else this.drawEnemyShot(live);
    }
  }

  private drawEnemyShot({ s, sprite }: LiveEnemyShot): void {
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + s.pos.x, o.y + s.pos.y).setDepth(DEPTH.over - 3);
  }

  private dropEnemyShot(live: LiveEnemyShot): void {
    this.enemyShots = this.enemyShots.filter((x) => x !== live);
    this.enemyPool.give(live.sprite);
  }

  /** Every enemy under the blade takes one hit per swing; defeated ones vanish in a puff. */
  private swordHits(): void {
    const box = swordBox(this.pos, this.facing, SWORD);
    for (const live of [...this.enemies]) {
      if (!overlaps(box, enemyBody(live.e, ENEMIES[live.e.kind]))) continue;
      this.strike(live, SWORD.damage, this.swings, this.facing);
    }
  }

  /** One hit (by id, so each lands once) on an enemy, pushing it the way given. */
  private strike(live: LiveEnemy, damage: number, hitId: number, from: Facing): void {
    const stats = ENEMIES[live.e.kind];
    const before = live.e;
    live.e = hitEnemy(live.e, damage, hitId, from, stats);
    if (live.e === before) return;
    this.effect('hit', live.e.pos.x, live.e.pos.y - stats.box.height / 2);
    if (isDefeated(live.e)) this.defeat(live);
    else this.sfx.play('hit');
  }

  private defeat(live: LiveEnemy): void {
    this.enemies = this.enemies.filter((x) => x !== live);
    this.enemyPool.give(live.sprite);
    this.defeated += 1;
    this.sfx.play('defeat');
    const { x, y } = live.e.pos;
    this.effect('puff', x, y - ENEMIES[live.e.kind].box.height / 2);
    const drop = rollDrop(this.rng, DROPS);
    if (drop) this.addPickup(drop, live.e.pos);
  }

  private addPickup(kind: PickupKind, pos: Point, amount = 1, item: ItemId | null = null): void {
    const icon = item ? ITEM_ICON[item] : undefined;
    const sprite =
      kind === 'gem'
        ? this.pickupPool.take('gems').play(animKey('gems', 'teal'))
        : kind === 'mana-brew'
          ? this.pickupPool.take('mana-brew')
          : kind === 'key'
            ? this.pickupPool.take('key')
            : kind === 'item'
              ? this.pickupPool.take(icon?.texture ?? 'sword-icon', icon?.frame ?? 0)
              : this.pickupPool.take(
                  'objects',
                  kind === 'heart' ? OBJECT_FRAMES.smallHeart : OBJECT_FRAMES.potion,
                );
    sprite.setOrigin(0.5, 1);
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + pos.x, o.y + pos.y).setDepth(DEPTH.sorted + o.y + pos.y - 1);
    this.pickups.push({ kind, pos: { ...pos }, sprite, amount, item });
  }

  private collectPickups(): void {
    const body = this.heroBody();
    for (const p of [...this.pickups]) {
      if (!overlaps(body, { x: p.pos.x - 6, y: p.pos.y - 12, w: 12, h: 12 })) continue;
      let sound: SfxName = 'potion';
      if (p.kind === 'gem') {
        this.gems += PICKUPS.gemValue * p.amount;
        sound = 'gem';
      } else if (p.kind === 'key') {
        this.progress = addKey(this.progress, this.mapId);
        sound = 'chest';
      } else if (p.kind === 'item') {
        if (p.item) this.inv = give(this.inv, p.item);
        sound = 'chest';
      } else if (p.kind === 'heart') {
        this.health = heal(this.health, PICKUPS.heartHeals);
        sound = 'heart';
      } else {
        const got = addPotion(
          this.potions,
          p.kind === 'health-potion' ? 'health' : 'mana',
          POTIONS.max,
        );
        // With no room in his bag, he leaves it on the ground.
        if (!got.taken) continue;
        this.potions = got.potions;
      }
      this.sfx.play(sound);
      this.pickups = this.pickups.filter((x) => x !== p);
      this.pickupPool.give(p.sprite);
    }
  }

  /** Touching an enemy hurts. */
  private touchEnemies(now: number): void {
    if (isInvulnerable(this.health, now)) return;
    const body = this.heroBody();
    const toucher = this.enemies.find((live) =>
      overlaps(body, enemyBody(live.e, ENEMIES[live.e.kind])),
    );
    if (toucher) this.hurtHero(ENEMIES[toucher.e.kind].contactDamage, toucher.e.pos, now);
  }

  /** Damage, a push away from `source`, and a moment of invulnerability (ignored while invulnerable). */
  private hurtHero(halfHearts: number, source: Point, now: number): void {
    if (isInvulnerable(this.health, now)) return;
    this.health = takeDamage(this.health, halfHearts, now, HEALTH.invulnerableMs);
    this.sfx.play('hurt');
    this.heroKnockMs = HEALTH.knockback.ms;
    this.heroKnockDir = awayFrom(source, this.pos);
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
    this.sfx.play('throw');
    this.lastThrowAt = now;
    this.throwUntil = now + DAGGER.throwPauseMs;
    this.shoot('dagger');
  }

  /** Casts a Fireball, if there's enough mana and none is already flying. */
  private tryCast(now: number): void {
    if (!canCast(this.mana, FIREBALL.cost)) {
      this.sfx.play('noMana');
      return;
    }
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
    this.sfx.play('cast');
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

  /** Flies every dagger and fireball; one that hits a wall, an enemy, or the end of its range is gone. */
  private stepShots(deltaMs: number): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    const solid = (cx: number, cy: number): boolean =>
      this.outsideRoom(cx, cy) || (room ? isSolid(room, cx, cy) : true);
    for (const shot of [...this.shots]) {
      const t = SHOT_TUNING[shot.kind];
      const step = stepProjectile(shot.d, deltaMs, t, solid);
      shot.d = step.projectile;
      const box = projectileBox(shot.d, t);
      const target = this.enemies.find((live) =>
        overlaps(box, enemyBody(live.e, ENEMIES[live.e.kind])),
      );
      if (target) this.strike(target, t.damage, shot.d.id, shot.d.dir);
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
    this.sfx.play('potion');
    if (kind === 'health') this.health = heal(this.health, this.health.max);
    else this.mana = boost(this.mana, now, MANA.boostMs);
  }

  /** Clears the room's enemies, shots and pickups (on leaving it). */
  private clearRoom(): void {
    for (const shot of [...this.shots]) this.dropShot(shot);
    for (const live of this.enemies) this.enemyPool.give(live.sprite);
    for (const live of [...this.enemyShots]) this.dropEnemyShot(live);
    for (const p of this.pickups) this.pickupPool.give(p.sprite);
    this.enemies = [];
    this.pickups = [];
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.pos },
      facing: this.facing,
      moving: this.moving,
      seed: this.seed,
      map: this.mapId,
      room: { ...this.room },
      sliding: this.sliding,
      travelling: this.travelling,
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
      enemies: this.enemies.map(({ e }) => ({
        kind: e.kind,
        x: e.pos.x,
        y: e.pos.y,
        health: e.health,
        charging: e.chargeMs > 0,
        knocked: e.knockMs > 0,
      })),
      enemyShots: this.enemyShots.map(({ s: shot }) => ({ x: shot.pos.x, y: shot.pos.y })),
      blocked: this.blocked,
      shotsFired: this.shotsFired,
      falling: this.falling,
      falls: this.falls,
      sounds: this.sfx.counts(),
      muted: this.muted,
      pickups: this.pickups.map((p) => ({ kind: p.kind, x: p.pos.x, y: p.pos.y })),
      keys: keysIn(this.progress, this.mapId),
      stones: this.stones.map((st) => ({ ...st })),
      opened: [...this.progress.opened],
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

  /** Test hook only: an enemy with its feet at a room position. */
  testSpawnEnemy(kind: EnemyKind, x: number, y: number): void {
    this.addEnemy(kind, { x, y });
  }

  /** Test hook only: a pickup at a room position. */
  testSpawnPickup(kind: PickupKind, x: number, y: number): void {
    this.addPickup(kind, { x, y });
  }

  /** Test hook only: give Jarrett a small key for this map. */
  testGiveKey(): void {
    this.progress = addKey(this.progress, this.mapId);
  }

  /** Test hook only: an enemy shot from a room position, flying along (dx, dy) (normalised). */
  testFireEnemyShot(x: number, y: number, dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    this.addEnemyShot({ x, y }, { x: dx / len, y: dy / len });
  }

  /** Test hook only: stop (or restart) enemies moving and shooting, so a test can aim at one. */
  testHoldEnemies(hold: boolean): void {
    this.enemiesHold = hold;
  }

  /** Test hook only: give Jarrett an item. */
  testGiveItem(item: ItemId): void {
    this.inv = give(this.inv, item);
  }

  /** Test hook only: set his hearts (in half hearts) and gems. */
  testSetHealth(points: number): void {
    this.health = { ...this.health, points: Math.max(0, Math.min(this.health.max, points)) };
  }

  testSetGems(gems: number): void {
    this.gems = Math.max(0, gems);
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
    keys: string | null;
  } {
    return this.hud.shows();
  }

  /** Test hook only: remove every enemy and enemy shot in the room. */
  testClearEnemies(): void {
    for (const live of this.enemies) this.enemyPool.give(live.sprite);
    for (const live of [...this.enemyShots]) this.dropEnemyShot(live);
    this.enemies = [];
  }

  /** Slides the view to the room next door. Jarrett keeps his place on screen and stands still meanwhile. */
  private slideTo(dir: Dir): void {
    const next = neighbour(this.room.col, this.room.row, dir);
    const old = this.roomObjects;
    this.pos = enterFrom(this.pos, dir);
    this.enteredAt = { ...this.pos };
    this.clearRoom();
    this.room = next;
    this.resetStones();
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
        this.spawnEnemies();
      },
    });
  }

  /** Starts a swing (unless one is under way) and shows the slash in front of Jarrett. */
  private trySwing(now: number): void {
    const next = startSwing(this.swing, now, SWORD.durationMs);
    if (next === this.swing) return;
    this.swing = next;
    this.sfx.play('swing');
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
    const dungeon = MAPS[this.mapId].theme === 'dungeon';
    const key = roomKey(col, row);
    const art = dungeon
      ? dungeonArt(room, (x, y) => isOpened(this.progress, fixtureId(this.mapId, key, x, y)))
      : roomArt(room);
    const sheet = dungeon ? 'dungeon' : 'forest';
    const drawn: Phaser.GameObjects.GameObject[] = [];
    for (const t of art.ground) {
      drawn.push(
        this.add
          .image(o.x + t.x, o.y + t.y, sheet, t.frame)
          .setOrigin(0)
          .setDepth(DEPTH.ground),
      );
    }
    if (col === this.room.col && row === this.room.row) {
      this.stoneSprites = this.stones.map((st) =>
        this.add
          .image(o.x + st.cx * TILE, o.y + st.cy * TILE, 'objects', OBJECT_FRAMES.stone)
          .setOrigin(0)
          .setDepth(DEPTH.sorted + o.y + (st.cy + 1) * TILE),
      );
      drawn.push(...this.stoneSprites);
    }
    for (const c of art.chests) {
      drawn.push(
        this.add
          .image(o.x + c.x, o.y + c.y, 'objects', OBJECT_FRAMES.chest)
          .setOrigin(0)
          .setDepth(DEPTH.sorted + o.y + c.y + TILE),
      );
    }
    for (const p of art.props) {
      drawn.push(
        this.add
          .image(o.x + p.x, o.y + p.y, PROP_SHEET[p.prop], `prop:${p.prop}`)
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

/**
 * The map to start on: ?dungeon=n starts at dungeon n's entrance (a play-test
 * skip, ROADMAP M3.5), otherwise the overworld.
 */
function mapFromUrl(): MapId {
  const raw = new URLSearchParams(window.location.search).get('dungeon');
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return DUNGEON_MAPS[n] ?? 'overworld';
}

/** Seed from the URL (?seed=123) for repeatable runs, otherwise the default. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_SEED;
}
