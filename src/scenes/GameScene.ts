import Phaser from 'phaser';
import { OBJECT_FRAMES, animKey } from '../assets/manifest';
import {
  DAGGER,
  DEATH,
  DEFAULT_SEED,
  GAME_HEIGHT,
  GAME_WIDTH,
  FIREBALL,
  LIGHTNING,
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
  RESPAWN,
  BOSSES,
  DIALOGUE,
  BOSS_FX,
  BOSS_REWARDS,
  STAR,
  ENEMIES,
  ENEMY_SHOTS,
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
import {
  bossBody,
  bossShotOrigin,
  hitBoss,
  isAirborne,
  isBeaten,
  glancesOff,
  isFierce,
  leapHeight,
  spawnBoss,
  stepBoss,
  stunBoss,
  type Boss,
  type BossKind,
} from '../logic/boss';
import { forDevice, paginate, type Page } from '../logic/dialogue';
import { isTouchDevice } from '../platform/touch';
import { dungeonMap, type DungeonMap } from '../logic/dungeonMap';
import { markTalked, walkerHere, type WalkerVisit } from '../logic/walker';
import { WALKER_VISITS } from '../world/walker';
import { SHOPKEEPER_CELL } from '../world/shop';
import type { Purse } from '../logic/shop';
import { rollDrop, type Drop } from '../logic/drops';
import { NO_CLEARED, defeat as defeatInRoom, enterRoom, type Cleared } from '../logic/respawn';
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
import {
  boost,
  canCast,
  fullMana,
  isBoosted,
  maxMana,
  refill,
  spend,
  type Mana,
} from '../logic/mana';
import { addPotion, usePotion, type PotionKind, type Potions } from '../logic/potions';
import type { Axis, Point } from '../logic/movement';
import {
  EMPTY_INVENTORY,
  give,
  knowsMagic,
  startingKit,
  takeFound,
  type Inventory,
  type ItemId,
} from '../logic/inventory';
import {
  CRYSTAL_MESSAGE,
  NEW_PROGRESS,
  addKey,
  beatBoss,
  bossId,
  canEnter,
  chestHeartId,
  dungeonNumber,
  leftInChest,
  takenId,
  enemyId,
  markDefeated,
  fixtureId,
  heartContainers,
  manaCrystals,
  markSeen,
  seenId,
  rewardId,
  shardMessage,
  shardsHeld,
  takeReward,
  type Reward,
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
  isStunned,
  stunEnemy,
  spawnEnemy,
  stepEnemy,
  type Enemy,
  type EnemyKind,
  type ShotKind as EnemyShotKind,
} from '../logic/enemies';
import { fireShot, shotBox, stepShot, type EnemyShot } from '../logic/enemyShots';
import { PROP_FOOTPRINT, isSolid, sealCells, type Dir } from '../logic/room';
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
import {
  DUNGEON_FRAMES,
  MARSH_TINT,
  VOLCANO_TINT,
  THORN_TINT,
  SWITCH_DIM,
  mixTint,
  dungeonArt,
  propSheet,
  roomArt,
} from '../logic/tiles';
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
import { MAPS, type MapId } from '../world/maps';
import { SAVE_VERSION, type SaveGame } from '../logic/save';
import { writeSave } from '../storage/saveStore';
import type { InventoryHost } from './InventoryScene';
import type { ShopHost } from './ShopScene';

/**
 * How a game starts: from a save, or new on a map (null: the overworld).
 * `cheated` marks a run that used the ?dungeon=n skip.
 */
export interface GameStart {
  save: SaveGame | null;
  map: MapId | null;
  cheated: boolean;
}

/** Read-only view of the game state, used by the e2e test hook. */
export interface GameSnapshot {
  /** The hero's feet, in room pixels (0,0 is the room's top-left corner, below the status bar). */
  player: Point;
  facing: Facing;
  moving: boolean;
  /** Jarrett's sprite: the animation playing (null when standing) and whether it is mirrored. */
  heroSprite: { anim: string | null; flipped: boolean };
  seed: number;
  /** The map he is on, the room in it, and its region (outdoors; dungeons say 'forest'). */
  map: MapId;
  room: { col: number; row: number };
  region: string;
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
    /** Stunned by Lightning: still, and harmless to touch. */
    stunned: boolean;
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
  /** Lightning bolts in the air. */
  bolts: { x: number; y: number; dir: Facing }[];
  mana: { current: number; max: number };
  /** Fireballs cast so far. */
  casts: number;
  potions: Potions;
  /** True while a Mana Brew is speeding up mana. */
  manaBoosted: boolean;
  /** Daggers thrown so far, and whether another may be thrown now. */
  thrown: number;
  throwReady: boolean;
  /** The current room's boss, if one is there and not yet beaten. */
  /** A leaper (the Giant Frog) also crouches before a leap, and is airborne during it. */
  boss: {
    kind: BossKind;
    x: number;
    y: number;
    health: number;
    fierce: boolean;
    crouching: boolean;
    airborne: boolean;
    /** Stunned by Lightning (the Mummy): only then do hits land on it. */
    stunned: boolean;
  } | null;
  /** True while a boss fight has the room's ways out shut. */
  sealed: boolean;
  /** Shards of the Star of Power found, and messages shown (finding a shard). */
  shards: number;
  announced: number;
  /** Time played (ms), saves made since the game scene started, and whether ?dungeon=n was used. */
  playMs: number;
  saves: number;
  cheated: boolean;
  /** The play time written by the latest save this session (null before one). */
  savedPlayMs: number | null;
  /** Walker's feet, if he is in this room; and the talk under way, if any. */
  walker: Point | null;
  talking: { page: number; pages: number; lines: string[] } | null;
}

type ShotKind = 'dagger' | 'fireball' | 'bolt';

/** Something flying: a thrown dagger, a fireball or a Lightning bolt. */
interface Shot {
  kind: ShotKind;
  d: Projectile;
  sprite: Phaser.GameObjects.Sprite;
}

const SHOT_TUNING: Readonly<Record<ShotKind, typeof DAGGER | typeof FIREBALL | typeof LIGHTNING>> =
  {
    dagger: DAGGER,
    fireball: FIREBALL,
    bolt: LIGHTNING,
  };
/** A stunned enemy is drawn pale blue (runtime tint, ADR-D05). */
const STUN_TINT = 0x9fd8ff;

/** Sprite angle for a dagger flying each way (the art points right). */
const DAGGER_ANGLE: Readonly<Record<Facing, number>> = { right: 0, down: 90, left: 180, up: -90 };
/** Projectile hits use ids far above any swing number, so the two never clash. */
const SHOT_HIT_IDS = 1_000_000;

interface LiveEnemy {
  e: Enemy;
  sprite: Phaser.GameObjects.Sprite;
  /** Its place in the room's list (absent for enemies the test hook adds). */
  slot?: number;
}

/** Things on the ground: drops, and potions. */
export type PickupKind =
  | Drop
  | 'health-potion'
  | 'mana-brew'
  | 'key'
  | 'item'
  | 'heart-container'
  | 'shard'
  | 'mana-crystal';

interface LiveBoss {
  b: Boss;
  sprite: Phaser.GameObjects.Sprite;
  /** Its health bar, along the bottom of the room. */
  back: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  /** A leaper's shadow on the ground, under it while it is in the air. */
  shadow: Phaser.GameObjects.Ellipse | null;
}

interface LiveWalker {
  visit: WalkerVisit;
  sprite: Phaser.GameObjects.Sprite;
  feet: Point;
}

/** A talk under way: its pages, the one showing, and the text box. */
interface Talk {
  pages: Page[];
  page: number;
  objects: Phaser.GameObjects.GameObject[];
  text: Phaser.GameObjects.Text;
}

interface LiveEnemyShot {
  s: EnemyShot;
  sprite: Phaser.GameObjects.Sprite;
}

/**
 * How each enemy's art sits on its feet. Side-view kinds face right in the
 * art and are mirrored to face left; the robot has a sheet per facing.
 */
const ENEMY_ART: Readonly<
  Record<
    Exclude<EnemyKind, 'robot'>,
    { sheet: string; anim: string; feetY: number; facesLeft?: boolean }
  >
> = {
  bird: { sheet: 'bird', anim: 'fly', feetY: 30 / 32 },
  eye: { sheet: 'eye', anim: 'fly', feetY: 39 / 48 },
  ghost: { sheet: 'ghost', anim: 'fly', feetY: 52 / 64 },
  wolf: { sheet: 'wolf', anim: 'run', feetY: 1 },
  snake: { sheet: 'snake', anim: 'crawl', feetY: 20 / 20 },
  mushroom: { sheet: 'mushroom', anim: 'walk', feetY: 30 / 30, facesLeft: true },
  toad: { sheet: 'toad', anim: 'hop', feetY: 38 / 38 },
};
/** The mushroom's spores: the enemy orb under a sickly green (runtime tint, ADR-D05). */
const SPORE_TINT = 0x9fe070;

interface Pickup {
  kind: PickupKind;
  pos: Point;
  sprite: Phaser.GameObjects.Sprite;
  /** Gems from a chest count several; a single dropped gem counts one. */
  amount: number;
  /** For an item from a chest: which one. */
  item: ItemId | null;
  /** For a heart container: its progress id, recorded when taken. */
  reward?: string;
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
export class GameScene extends Phaser.Scene implements InventoryHost, ShopHost {
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
  private boss: LiveBoss | null = null;
  private walker: LiveWalker | null = null;
  /** False walls struck once (in this room visit), by id, with the swing that struck them. */
  private struckWalls = new Map<string, number>();
  /** Overworld rooms with enemies defeated lately (they come back after a few rooms). */
  private cleared: Cleared = NO_CLEARED;
  /** The swing that last clinked off rubble or a boulder (one clink a swing). */
  private clinked = -1;
  /** Test hook only: cells changed by testSetCell. */
  private testEdits: {
    map: MapId;
    col: number;
    row: number;
    cx: number;
    cy: number;
    ch: string;
  }[] = [];
  /** The shopkeeper (in the shop), and his feet. */
  private shopkeeper: { sprite: Phaser.GameObjects.Sprite; feet: Point } | null = null;
  private talk: Talk | null = null;
  /** A phone or tablet: Walker names the touch buttons rather than the keys. */
  private readonly touch = isTouchDevice();
  /** The cells shut while a boss fight is on, and the gates drawn over them. */
  private sealed: { x: number; y: number }[] = [];
  /** Messages shown so far (finding a shard). */
  private announced = 0;
  /** Time played (ms), saves made this session, and whether ?dungeon=n was used. */
  private playMs = 0;
  private saves = 0;
  private savedPlayMs: number | null = null;
  private cheated = false;
  private gates: Phaser.GameObjects.Image[] = [];
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

  create(data?: Partial<GameStart>): void {
    const save = data?.save ?? null;
    this.seed = seedFromUrl();
    this.rng = createRng(this.seed);
    this.mapId = save ? (save.map as MapId) : (data?.map ?? 'overworld');
    this.cheated = save ? save.cheated : (data?.cheated ?? false);
    this.playMs = save?.playMs ?? 0;
    this.saves = 0;
    this.savedPlayMs = null;
    this.world = buildWorld(MAPS[this.mapId].rooms);
    this.progress = save?.progress ?? NEW_PROGRESS;
    this.health = fullHealth(HEALTH.startHearts + heartContainers(this.progress));
    this.gems = save?.gems ?? 0;
    this.defeated = 0;
    this.heroKnockMs = 0;
    this.enemies = [];
    this.enemyShots = [];
    this.boss = null;
    this.walker = null;
    this.shopkeeper = null;
    this.struckWalls = new Map();
    this.cleared = NO_CLEARED;
    this.talk = null;
    this.sealed = [];
    this.announced = 0;
    this.gates = [];
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
    this.mana = fullMana(maxMana(MANA.max, MANA.crystalBonus, manaCrystals(this.progress)));
    this.lastCastAt = null;
    this.potions = save ? { ...save.potions } : { ...POTIONS.start };
    this.travelling = false;
    this.falling = false;
    this.falls = 0;
    this.sfx = new Sfx(this);
    // A restart (or a new game) keeps the player's mute choice.
    this.muted = this.sound.mute;
    // A new game starts with nothing: Walker hands over the sword and shield in the
    // village. A ?dungeon=n run skips him, so it starts with them and the earlier
    // dungeons' prizes, and he has already spoken.
    const skip = !save && this.mapId !== 'overworld';
    const kit = startingKit(skip ? dungeonNumber(this.mapId) : null);
    this.inv = save?.inventory ?? kit.reduce(give, EMPTY_INVENTORY);
    if (skip) this.progress = markTalked(this.progress, 'village');
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
    this.refreshHud();
    this.enteredRoom();
  }

  /** On entering a room: a dungeon room goes on the map, and a save point saves. */
  private enteredRoom(): void {
    if (MAPS[this.mapId].theme === 'dungeon') {
      const id = seenId(this.mapId, roomKey(this.room.col, this.room.row));
      this.progress = markSeen(this.progress, id);
    }
    this.saveAtSavePoint();
  }

  /**
   * Each map's start room is a save point (the village, once there is one, and
   * the dungeon entrances): arriving there saves the game.
   */
  private saveAtSavePoint(): void {
    const start = MAPS[this.mapId].start;
    if (this.room.col !== start.col || this.room.row !== start.row) return;
    writeSave({
      version: SAVE_VERSION,
      map: this.mapId,
      inventory: this.inv,
      potions: { ...this.potions },
      gems: this.gems,
      progress: this.progress,
      playMs: Math.round(this.playMs),
      cheated: this.cheated,
    });
    this.saves += 1;
    this.savedPlayMs = Math.round(this.playMs);
  }

  override update(time: number, deltaMs: number): void {
    this.now = time;
    this.playMs += deltaMs;
    // Presses made during a slide are dropped, not saved up.
    const presses = this.keys.takePresses();
    if (this.sliding || this.falling || this.travelling) return;
    if (this.talk) {
      // While talking, the attack key turns the page; nothing else moves.
      if (presses.some((c) => ATTACK_KEYS.has(c))) this.turnPage();
      return;
    }
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
    this.stepBoss(deltaMs);
    this.stepEnemyShots(deltaMs, time);
    this.stepShots(deltaMs);
    if (attack && this.heroKnockMs <= 0 && this.walkerInReach()) {
      this.startTalk();
      return;
    }
    if (attack && this.heroKnockMs <= 0 && this.shopkeeper && this.inReach(this.shopkeeper.feet)) {
      this.openShop();
      return;
    }
    if (attack && this.heroKnockMs <= 0) {
      if (this.mode === 'near') {
        if (this.inv.equipped.near) this.trySwing(time);
      } else if (this.inv.equipped.far === 'daggers') {
        this.tryThrow(time);
      }
    } else if (cast && this.heroKnockMs <= 0) {
      const spell = this.inv.equipped.spell;
      if (spell === 'fireball' || spell === 'lightning') this.tryCast(spell, time);
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
    this.refreshHud();
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
      // A dungeon's doorway only takes him in with enough shards (dungeon n needs n−1).
      if (way && canEnter(this.progress, way.to.map)) {
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
    const here = col === this.room.col && row === this.room.row;
    if (here && this.sealed.some((c) => c.x === cx && c.y === cy)) return true;
    const w = this.walker?.visit.cell;
    if (here && w && w.col === cx && w.row === cy) return true;
    if (here && this.shopkeeper && SHOPKEEPER_CELL.col === cx && SHOPKEEPER_CELL.row === cy) {
      return true;
    }
    return solidInWorld(this.world, col, row, cx, cy, (key, x, y) =>
      isOpened(this.progress, fixtureId(this.mapId, key, x, y)),
    );
  }

  /** Brings the status bar up to date (it redraws only what changed). */
  private refreshHud(): void {
    const weapon = this.inv.equipped[this.mode];
    this.hud.update(
      this.health,
      this.gems,
      weapon,
      knowsMagic(this.inv) ? this.mana : null,
      this.potions,
      this.hudKeys(),
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
    const at = chestDrop(cx, cy);
    this.effect('puff', at.x, at.y - TILE / 2);
    this.redrawRoom();
    this.dropContents(contents, at, id);
  }

  /** What falls out of a chest (`chestId` marks its key as picked up, once it is). */
  private dropContents(c: ChestContents, at: Point, chestId: string): void {
    if (c.kind === 'key') this.addPickup('key', at, 1, null, takenId(chestId));
    else if (c.kind === 'gems') this.addPickup('gem', at, c.amount);
    else if (c.kind === 'item') this.addPickup('item', at, 1, c.item);
    else if (c.kind === 'heart') {
      // Each cave's heart has its own id, so the save keeps every one.
      const key = roomKey(this.room.col, this.room.row);
      this.addPickup('heart-container', at, 1, null, chestHeartId(this.mapId, key));
    } else if (c.kind === 'crystal') {
      this.addPickup('mana-crystal', at, 1, null, rewardId(this.mapId, 'crystal'));
    } else this.addPickup(c.potion === 'health' ? 'health-potion' : 'mana-brew', at);
  }

  /** A prize left in an opened chest (he left the room without it) waits there again. */
  private placeChestLeftovers(): void {
    const key = roomKey(this.room.col, this.room.row);
    for (const c of this.world.chests.get(key) ?? []) {
      const id = fixtureId(this.mapId, key, c.col, c.row);
      const rewards = {
        heart: chestHeartId(this.mapId, key),
        crystal: rewardId(this.mapId, 'crystal'),
      };
      if (leftInChest(c.contents, this.progress, id, rewards, this.inv.owned)) {
        this.dropContents(c.contents, chestDrop(c.col, c.row), id);
      }
    }
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
    const key = roomKey(this.room.col, this.room.row);
    // Overworld enemies defeated lately stay gone; dungeon ones stay gone for good.
    const entered = enterRoom(this.cleared, `${this.mapId}/${key}`, RESPAWN.roomsAway);
    this.cleared = entered.cleared;
    const dungeon = MAPS[this.mapId].theme === 'dungeon';
    (this.world.enemies.get(key) ?? []).forEach((p, i) => {
      const gone = dungeon
        ? isOpened(this.progress, enemyId(this.mapId, key, i))
        : entered.gone.includes(i);
      if (gone) return;
      this.addEnemy(p.kind, { x: p.col * TILE + TILE / 2, y: (p.row + 1) * TILE - 1 }, i);
    });
    const boss = this.world.bosses.get(key);
    if (boss && !isOpened(this.progress, bossId(this.mapId, key))) {
      this.addBoss(boss.kind, { x: boss.col * TILE + TILE / 2, y: (boss.row + 1) * TILE - 1 });
    }
    this.placeRewards();
    this.placeChestLeftovers();
    this.placeWalker();
    this.placeShopkeeper();
  }

  /** In the shop, the shopkeeper stands behind his counter. */
  private placeShopkeeper(): void {
    if (this.mapId !== 'shop') return;
    const feet = {
      x: SHOPKEEPER_CELL.col * TILE + TILE / 2,
      y: (SHOPKEEPER_CELL.row + 1) * TILE - 1,
    };
    const sprite = this.enemyPool
      .take('shopkeeper', HERO.standFrame.down)
      .setOrigin(0.5, HERO.feetY / HERO.frameHeight);
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + feet.x, o.y + feet.y).setDepth(DEPTH.sorted + o.y + feet.y);
    this.shopkeeper = { sprite, feet };
  }

  /** Whether Jarrett is facing someone (Walker, the shopkeeper) close enough to talk. */
  private inReach(feet: Point): boolean {
    const body = {
      x: feet.x - BODY.halfWidth,
      y: feet.y - BODY.height,
      w: BODY.halfWidth * 2,
      h: BODY.height,
    };
    return overlaps(swordBox(this.pos, this.facing, SWORD), body);
  }

  /** Pauses the game and opens the shop over it. */
  private openShop(): void {
    this.moving = false;
    this.animate(false);
    this.sfx.play('menu');
    this.scene.launch('Shop', { host: this });
    this.scene.pause();
  }

  purse(): Purse {
    return { gems: this.gems, potions: { ...this.potions }, inventory: this.inv };
  }

  setPurse(p: Purse): void {
    this.gems = p.gems;
    this.potions = { ...p.potions };
    this.inv = p.inventory;
    this.refreshHud();
  }

  /** Walker, if he is waiting in this room. */
  private placeWalker(): void {
    const visit = walkerHere(WALKER_VISITS, this.mapId, this.room, this.progress);
    if (!visit) return;
    const feet = { x: visit.cell.col * TILE + TILE / 2, y: (visit.cell.row + 1) * TILE - 1 };
    const sprite = this.enemyPool
      .take('walker', HERO.standFrame.down)
      .setOrigin(0.5, HERO.feetY / HERO.frameHeight);
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + feet.x, o.y + feet.y).setDepth(DEPTH.sorted + o.y + feet.y);
    this.walker = { visit, sprite, feet };
  }

  /** Whether Jarrett is facing Walker, close enough to talk. */
  private walkerInReach(): boolean {
    return this.walker !== null && this.inReach(this.walker.feet);
  }

  /** Walker turns to Jarrett and starts talking; the game waits meanwhile. */
  private startTalk(): void {
    const live = this.walker;
    if (!live) return;
    this.moving = false;
    this.animate(false);
    // He faces Jarrett: the opposite way to Jarrett.
    const faces: Facing = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[
      this.facing
    ];
    live.sprite
      .setFrame(HERO.standFrame[faces === 'left' ? 'right' : faces])
      .setFlipX(faces === 'left');
    // The box goes at the bottom of the screen, or at the top when they stand low in the room.
    const top = this.pos.y > ROOM_H / 2 ? HUD_HEIGHT + 8 : GAME_HEIGHT - 56;
    const box = this.add
      .rectangle(8, top, GAME_WIDTH - 16, 48, 0x101018)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffd166)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 3);
    const name = this.add
      .text(16, top - 4, ' WALKER ', {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#ffd166',
        backgroundColor: '#101018',
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 2);
    const text = this.add
      .text(16, top + 8, '', {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#e8f4f0',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 2);
    const more = this.add
      .text(GAME_WIDTH - 20, top + 38, '>', {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#ffd166',
      })
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 2);
    this.tweens.add({ targets: more, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.talk = {
      pages: paginate(forDevice(live.visit.speech, this.touch), DIALOGUE.width, DIALOGUE.lines),
      page: 0,
      objects: [box, name, text, more],
      text,
    };
    this.showPage();
  }

  /** Shows the current page, handing over any items it gives. */
  private showPage(): void {
    const talk = this.talk;
    const page = talk?.pages[talk.page];
    if (!talk || !page) return;
    talk.text.setText(page.lines.join('\n'));
    for (const item of page.give) this.inv = give(this.inv, item);
    this.sfx.play(page.give.length > 0 ? 'chest' : 'menu');
    // The game waits while he talks, so show a gift in the status bar now.
    this.refreshHud();
  }

  /** The next page; after the last, Walker vanishes in a shimmer. */
  private turnPage(): void {
    const talk = this.talk;
    if (!talk) return;
    talk.page += 1;
    if (talk.page < talk.pages.length) {
      this.showPage();
      return;
    }
    for (const o of talk.objects) o.destroy();
    this.talk = null;
    const live = this.walker;
    if (!live) return;
    this.progress = markTalked(this.progress, live.visit.id);
    this.effect('puff', live.feet.x, live.feet.y - BODY.height / 2);
    this.enemyPool.give(live.sprite.setFlipX(false));
    this.walker = null;
    // What he gave is kept: a save point saves now.
    this.saveAtSavePoint();
  }

  /** A boss, with its health bar along the bottom of the room. */
  private addBoss(kind: BossKind, feet: Point): void {
    const sprite = this.enemyPool.take(kind).setOrigin(0.5, 1).play(animKey(kind, 'sway'));
    const o = this.origin(this.room.col, this.room.row);
    const x = o.x + (ROOM_W - BOSS_FX.barWidth) / 2;
    const y = o.y + ROOM_H - TILE / 2;
    const back = this.add
      .rectangle(x - 1, y - 1, BOSS_FX.barWidth + 2, BOSS_FX.barHeight + 2, 0x101018)
      .setOrigin(0)
      .setDepth(DEPTH.over + 1);
    const fill = this.add
      .rectangle(x, y, BOSS_FX.barWidth, BOSS_FX.barHeight, 0xd04040)
      .setOrigin(0)
      .setDepth(DEPTH.over + 2);
    const stats = BOSSES[kind];
    const shadow =
      stats.moves.style === 'hop'
        ? this.add
            .ellipse(0, 0, stats.box.halfWidth * 2, BOSS_FX.shadow.height, 0x000000)
            .setAlpha(BOSS_FX.shadow.alpha)
            .setVisible(false)
        : null;
    this.boss = { b: spawnBoss(kind, feet, stats, this.rng), sprite, back, fill, shadow };
    this.drawBoss(this.boss);
  }

  /** Whether the boss's body overlaps `box`. In the air it is out of reach: nothing hits it, and it hurts no one. */
  private bossAt(box: Rect): boolean {
    const live = this.boss;
    return !!live && !isAirborne(live.b) && overlaps(box, bossBody(live.b, BOSSES[live.b.kind]));
  }

  /**
   * The boss shuffles and shoots. Once Jarrett is all the way into its room,
   * the ways out shut behind him until it is beaten.
   */
  private stepBoss(deltaMs: number): void {
    const live = this.boss;
    if (!live) return;
    const stats = BOSSES[live.b.kind];
    if (!this.enemiesHold) {
      const step = stepBoss(live.b, deltaMs, this.pos, stats, this.rng);
      live.b = step.boss;
      const from = bossShotOrigin(live.b, stats);
      for (const dir of step.shots) this.addEnemyShot(from, dir);
    }
    this.drawBoss(live);
    if (this.sealed.length === 0) {
      const inside = { x: 2 * TILE, y: 2 * TILE, w: ROOM_W - 4 * TILE, h: ROOM_H - 4 * TILE };
      const body = this.heroBody();
      const within =
        body.x >= inside.x &&
        body.y >= inside.y &&
        body.x + body.w <= inside.x + inside.w &&
        body.y + body.h <= inside.y + inside.h;
      if (within) this.seal();
    }
  }

  private drawBoss({ b, sprite, fill, shadow }: LiveBoss): void {
    const o = this.origin(this.room.col, this.room.row);
    // A leaper rises off the ground mid-leap, and squats while it crouches (the warning).
    const lift = leapHeight(b, BOSSES[b.kind]);
    const crouching = b.phase === 'crouch' && !isAirborne(b);
    sprite
      .setPosition(o.x + b.pos.x, o.y + b.pos.y - lift)
      .setDepth(DEPTH.sorted + o.y + b.pos.y)
      .setScale(crouching ? BOSS_FX.crouch.x : 1, crouching ? BOSS_FX.crouch.y : 1);
    shadow
      ?.setPosition(o.x + b.pos.x, o.y + b.pos.y)
      .setDepth(DEPTH.sorted + o.y + b.pos.y - 1)
      .setVisible(lift > 0);
    if (b.flashMs > 0) sprite.setTint(0xff7070);
    else if (b.stunMs > 0 && Math.floor(b.stunMs / LIGHTNING.flickerMs) % 2 === 0) {
      sprite.setTint(STUN_TINT);
    } else sprite.clearTint();
    fill.setSize((BOSS_FX.barWidth * b.health) / BOSSES[b.kind].health, BOSS_FX.barHeight);
  }

  /** Shuts the room's ways out (barred gates). */
  private seal(): void {
    const room = this.world.rooms.get(roomKey(this.room.col, this.room.row));
    if (!room) return;
    this.sealed = sealCells(room);
    const o = this.origin(this.room.col, this.room.row);
    this.gates = this.sealed.map((c) =>
      this.add
        .image(o.x + c.x * TILE, o.y + c.y * TILE, 'dungeon', DUNGEON_FRAMES.gate)
        .setOrigin(0)
        .setDepth(DEPTH.ground + 1),
    );
    if (this.sealed.length > 0) this.sfx.play('unlock');
  }

  private unseal(): void {
    for (const g of this.gates) g.destroy();
    this.gates = [];
    this.sealed = [];
  }

  /** A Lightning bolt on the boss: a wrapped one stands stunned, and can be hurt meanwhile. */
  private stunTheBoss(hitId: number): void {
    const live = this.boss;
    if (!live) return;
    const stats = BOSSES[live.b.kind];
    const before = live.b;
    live.b = stunBoss(live.b, hitId, stats);
    if (live.b === before) return;
    this.effect('hit', live.b.pos.x, live.b.pos.y - stats.box.height / 2);
    this.sfx.play('zap');
  }

  /** One hit (by id, so each lands once) on the boss: a swing of `weapon`, or a shot (null). */
  private strikeBoss(damage: number, hitId: number, weapon: ItemId | null): void {
    const live = this.boss;
    if (!live) return;
    const before = live.b;
    const stats = BOSSES[live.b.kind];
    if (glancesOff(live.b, stats, weapon)) {
      // Wrapped tight, or a hide too thick: the blow glances off (once per hit).
      if (live.b.lastHitBy !== hitId) {
        live.b = { ...live.b, lastHitBy: hitId };
        this.sfx.play('block');
      }
      return;
    }
    live.b = hitBoss(live.b, damage, hitId, BOSS_FX.flashMs, stats, weapon);
    if (live.b === before) return;
    this.effect('hit', live.b.pos.x, live.b.pos.y - stats.box.height / 2);
    if (isBeaten(live.b)) {
      this.beat(live);
      return;
    }
    this.sfx.play('hit');
    this.drawBoss(live);
  }

  /** The boss is beaten: it vanishes in puffs, its shots fizzle, and the gates open for good. */
  private beat(live: LiveBoss): void {
    const stats = BOSSES[live.b.kind];
    const key = roomKey(this.room.col, this.room.row);
    this.progress = beatBoss(this.progress, bossId(this.mapId, key));
    this.sfx.play('defeat');
    const { x, y } = live.b.pos;
    for (const [dx, dy] of [
      [0, stats.box.height / 2],
      [-stats.box.halfWidth, stats.box.height / 4],
      [stats.box.halfWidth, stats.box.height * 0.75],
    ] as const) {
      this.effect('puff', x + dx, y - dy);
    }
    for (const shot of [...this.enemyShots]) this.dropEnemyShot(shot);
    this.dropBoss();
    this.unseal();
    this.placeRewards();
  }

  /**
   * A beaten boss's heart container and shard, where it stood; they wait there
   * until Jarrett picks them up, even if he leaves the room first.
   */
  private placeRewards(): void {
    const key = roomKey(this.room.col, this.room.row);
    const boss = this.world.bosses.get(key);
    if (!boss || !isOpened(this.progress, bossId(this.mapId, key))) return;
    const feet = { x: boss.col * TILE + TILE / 2, y: (boss.row + 1) * TILE - 1 };
    for (const reward of ['heart', 'shard'] as const satisfies readonly Reward[]) {
      if (isOpened(this.progress, rewardId(this.mapId, reward))) continue;
      const at = BOSS_REWARDS[reward];
      this.addPickup(reward === 'heart' ? 'heart-container' : 'shard', {
        x: feet.x + at.dx,
        y: feet.y + at.dy,
      });
    }
  }

  /** A message in the middle of the screen for a moment (finding a shard). */
  private announce(lines: readonly string[]): void {
    const text = this.add
      .text(GAME_WIDTH / 2, HUD_HEIGHT + ROOM_H / 2, lines.join('\n'), {
        fontFamily: HUD.font,
        fontSize: '8px',
        color: '#ffd166',
        align: 'center',
        lineSpacing: 4,
        backgroundColor: '#101018',
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 2);
    this.announced += 1;
    this.time.delayedCall(STAR.messageMs, () => text.destroy());
  }

  private dropBoss(): void {
    if (!this.boss) return;
    this.enemyPool.give(this.boss.sprite.clearTint().setScale(1));
    this.boss.back.destroy();
    this.boss.fill.destroy();
    this.boss.shadow?.destroy();
    this.boss = null;
  }

  private addEnemy(kind: EnemyKind, feet: Point, slot?: number): void {
    const e = spawnEnemy(kind, feet, ENEMIES[kind], this.rng);
    const art = kind === 'robot' ? null : ENEMY_ART[kind];
    const sprite = this.enemyPool
      .take(art ? art.sheet : 'robot-front')
      .setOrigin(0.5, art ? art.feetY : 1);
    const live: LiveEnemy = { e, sprite, ...(slot === undefined ? {} : { slot }) };
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
      const kind = ENEMIES[live.e.kind].shotKind ?? 'orb';
      for (const shot of step.shots) this.addEnemyShot(shot.from, shot.dir, kind);
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
      // Most face right in the art (the mushroom left); facing up or down keeps the last side.
      const mirrored = art.facesLeft ? 'right' : 'left';
      if (e.facing === mirrored) sprite.setFlipX(true);
      if (e.facing === (art.facesLeft ? 'left' : 'right')) sprite.setFlipX(false);
    }
    if (e.knockMs > 0) sprite.setTint(0xff7070);
    else if (isStunned(e) && Math.floor(e.stunMs / LIGHTNING.flickerMs) % 2 === 0) {
      sprite.setTint(STUN_TINT);
    } else sprite.clearTint();
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
    this.refreshHud();
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
    this.refreshHud();
    this.falls += 1;
    this.falling = false;
    this.enteredRoom();
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
    this.refreshHud();
    this.enteredRoom();
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

  /** The map of the dungeon he's in, or null outdoors. */
  dungeonMap(): { name: string; map: DungeonMap } | null {
    const m = MAPS[this.mapId];
    if (m.theme !== 'dungeon') return null;
    const map = dungeonMap(
      m.rooms,
      (col, row) => isOpened(this.progress, seenId(this.mapId, roomKey(col, row))),
      this.room,
      (col, row) => this.world.bosses.has(roomKey(col, row)),
    );
    return { name: m.name, map };
  }

  heldShards(): number {
    return shardsHeld(this.progress);
  }

  /** Small keys for the map he's on. */
  heldKeys(): number {
    return keysIn(this.progress, this.mapId);
  }

  /** Swinging, throwing, casting, or being knocked back: the shield isn't up. */
  private handsBusy(now: number): boolean {
    return (
      isSwinging(this.swing, now, SWORD.durationMs) || now < this.throwUntil || this.heroKnockMs > 0
    );
  }

  private addEnemyShot(
    from: Point,
    dir: { x: number; y: number },
    kind: EnemyShotKind = 'orb',
  ): void {
    const s = fireShot(from, dir, kind);
    this.shotsFired += 1;
    this.sfx.play('enemyShot');
    const sprite =
      kind === 'venom'
        ? this.enemyPool.take('snake-spit').setFlipX(dir.x < 0)
        : this.enemyPool.take('enemy-shot').play(animKey('enemy-shot', 'fly'));
    if (kind === 'spore') sprite.setTint(SPORE_TINT);
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
      const t = ENEMY_SHOTS[live.s.kind];
      const step = stepShot(live.s, deltaMs, t, solid);
      live.s = step.shot;
      const hit = overlaps(shotBox(live.s, t), this.heroBody());
      if (hit) {
        const shieldUp = this.inv.equipped.shield !== null && !this.handsBusy(now);
        if (shieldUp && shieldBlocks(this.facing, live.s.dir, false, SHIELD.coverCos)) {
          this.blocked += 1;
          this.sfx.play('block');
          this.effect('hit', live.s.pos.x, live.s.pos.y);
        } else {
          this.hurtHero(t.damage, live.s.pos, now);
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
    this.enemyPool.give(live.sprite.clearTint().setFlipX(false));
  }

  /** Every enemy under the blade takes one hit per swing; defeated ones vanish in a puff. */
  private swordHits(): void {
    const box = swordBox(this.pos, this.facing, SWORD);
    for (const live of [...this.enemies]) {
      if (!overlaps(box, enemyBody(live.e, ENEMIES[live.e.kind]))) continue;
      this.strike(live, SWORD.damage, this.swings, this.facing);
    }
    if (this.bossAt(box)) this.strikeBoss(SWORD.damage, this.swings, this.inv.equipped.near);
    this.strikeFalseWalls(box);
    this.strikeBreakables(box);
  }

  /**
   * Rubble or a boulder under the blade: the Axe smashes it (a whole boulder
   * at once); the sword only clinks off it.
   */
  private strikeBreakables(box: Rect): void {
    const key = roomKey(this.room.col, this.room.row);
    const room = this.world.rooms.get(key);
    if (!room) return;
    const axe = this.inv.equipped.near === 'axe';
    for (const { x, y } of cellsUnder(box)) {
      const cell = room.cells[y]?.[x];
      if (cell?.fixture !== 'cracked' && cell?.fixture !== 'boulder') continue;
      const id = fixtureId(this.mapId, key, x, y);
      if (isOpened(this.progress, id)) continue;
      if (!axe) {
        if (this.clinked !== this.swings) this.sfx.play('block');
        this.clinked = this.swings;
        continue;
      }
      // A boulder goes all at once: every cell of its footprint.
      const anchor = cell.anchor;
      const cells = anchor
        ? PROP_FOOTPRINT.boulder.map(([dx, dy]) => ({ x: anchor.x + dx, y: anchor.y + dy }))
        : [{ x, y }];
      for (const c of cells)
        this.progress = openChest(this.progress, fixtureId(this.mapId, key, c.x, c.y));
      this.sfx.play('crumble');
      this.effect('puff', x * TILE + TILE / 2, y * TILE + TILE / 2);
      this.redrawRoom();
      return;
    }
  }

  /** A thorn bush in a fireball's path burns away. */
  /** A Lightning bolt in a crystal switch powers it, for good: the room's gates open. */
  private powerSwitches(box: Rect): boolean {
    const key = roomKey(this.room.col, this.room.row);
    const room = this.world.rooms.get(key);
    for (const { x, y } of cellsUnder(box)) {
      if (room?.cells[y]?.[x]?.fixture !== 'switch') continue;
      const id = fixtureId(this.mapId, key, x, y);
      if (!isOpened(this.progress, id)) {
        this.progress = openChest(this.progress, id);
        this.sfx.play('switch');
        this.redrawRoom();
      }
      return true;
    }
    return false;
  }

  private burnThorns(box: Rect): boolean {
    const key = roomKey(this.room.col, this.room.row);
    const room = this.world.rooms.get(key);
    for (const { x, y } of cellsUnder(box)) {
      if (room?.cells[y]?.[x]?.fixture !== 'thorns') continue;
      const id = fixtureId(this.mapId, key, x, y);
      if (isOpened(this.progress, id)) continue;
      this.progress = openChest(this.progress, id);
      this.sfx.play('burn');
      this.effect('puff', x * TILE + TILE / 2, y * TILE + TILE / 2);
      this.redrawRoom();
      return true;
    }
    return false;
  }

  /**
   * A false wall under the blade: the first swing sounds hollow; a second
   * swing crumbles it open, for good.
   */
  private strikeFalseWalls(box: Rect): void {
    const key = roomKey(this.room.col, this.room.row);
    const room = this.world.rooms.get(key);
    if (!room) return;
    for (const { x, y } of cellsUnder(box)) {
      if (room.cells[y]?.[x]?.fixture !== 'hollow') continue;
      const id = fixtureId(this.mapId, key, x, y);
      if (isOpened(this.progress, id)) continue;
      const struck = this.struckWalls.get(id);
      if (struck === this.swings) continue;
      const at = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
      if (struck === undefined) {
        this.struckWalls.set(id, this.swings);
        this.sfx.play('hollow');
        this.effect('hit', at.x, at.y);
      } else {
        this.struckWalls.delete(id);
        this.progress = openChest(this.progress, id);
        this.sfx.play('crumble');
        this.effect('puff', at.x, at.y);
        this.redrawRoom();
      }
    }
  }

  /** One hit (by id, so each lands once) on an enemy, pushing it the way given. */
  /** A Lightning bolt: the enemy stands stunned for a while. */
  private stun(live: LiveEnemy, hitId: number): void {
    const stats = ENEMIES[live.e.kind];
    const before = live.e;
    live.e = stunEnemy(live.e, LIGHTNING.stunMs, hitId);
    if (live.e === before) return;
    this.effect('hit', live.e.pos.x, live.e.pos.y - stats.box.height / 2);
    this.sfx.play('zap');
  }

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
    if (live.slot !== undefined) {
      const key = roomKey(this.room.col, this.room.row);
      if (MAPS[this.mapId].theme === 'dungeon') {
        this.progress = markDefeated(this.progress, enemyId(this.mapId, key, live.slot));
      } else {
        this.cleared = defeatInRoom(this.cleared, `${this.mapId}/${key}`, live.slot);
      }
    }
    this.enemyPool.give(live.sprite);
    this.defeated += 1;
    this.sfx.play('defeat');
    const { x, y } = live.e.pos;
    this.effect('puff', x, y - ENEMIES[live.e.kind].box.height / 2);
    const drop = rollDrop(this.rng, DROPS);
    if (drop) this.addPickup(drop, live.e.pos);
  }

  private addPickup(
    kind: PickupKind,
    pos: Point,
    amount = 1,
    item: ItemId | null = null,
    reward?: string,
  ): void {
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
              : kind === 'shard'
                ? this.pickupPool.take('shard')
                : kind === 'mana-crystal'
                  ? this.pickupPool.take('mana-crystal')
                  : this.pickupPool.take(
                      'objects',
                      kind === 'heart'
                        ? OBJECT_FRAMES.smallHeart
                        : kind === 'heart-container'
                          ? OBJECT_FRAMES.heart
                          : OBJECT_FRAMES.potion,
                    );
    sprite.setOrigin(0.5, 1);
    const o = this.origin(this.room.col, this.room.row);
    sprite.setPosition(o.x + pos.x, o.y + pos.y).setDepth(DEPTH.sorted + o.y + pos.y - 1);
    this.pickups.push({
      kind,
      pos: { ...pos },
      sprite,
      amount,
      item,
      ...(reward ? { reward } : {}),
    });
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
        if (p.reward) this.progress = openChest(this.progress, p.reward);
        sound = 'chest';
      } else if (p.kind === 'heart-container') {
        // One more heart, and every heart filled.
        this.progress = takeReward(this.progress, p.reward ?? rewardId(this.mapId, 'heart'));
        const max = (HEALTH.startHearts + heartContainers(this.progress)) * 2;
        this.health = { ...this.health, max, points: max };
        sound = 'heart';
      } else if (p.kind === 'mana-crystal') {
        // A bigger mana bar, and full.
        this.progress = takeReward(this.progress, p.reward ?? rewardId(this.mapId, 'crystal'));
        const max = maxMana(MANA.max, MANA.crystalBonus, manaCrystals(this.progress));
        this.mana = { ...this.mana, max, current: max };
        this.announce(CRYSTAL_MESSAGE);
        sound = 'shard';
      } else if (p.kind === 'shard') {
        this.progress = takeReward(this.progress, rewardId(this.mapId, 'shard'));
        this.announce(shardMessage(shardsHeld(this.progress), STAR.shards));
        sound = 'shard';
      } else if (p.kind === 'item') {
        if (p.item) this.inv = takeFound(this.inv, p.item);
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
    // A stunned enemy can't hurt by touch.
    const toucher = this.enemies.find(
      (live) => !isStunned(live.e) && overlaps(body, enemyBody(live.e, ENEMIES[live.e.kind])),
    );
    if (toucher) this.hurtHero(ENEMIES[toucher.e.kind].contactDamage, toucher.e.pos, now);
    else if (this.boss && this.bossAt(body)) {
      this.hurtHero(BOSSES[this.boss.b.kind].contactDamage, this.boss.b.pos, now);
    }
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

  /** Casts the equipped spell, if there's enough mana and none of it is already flying. */
  private tryCast(spell: 'fireball' | 'lightning', now: number): void {
    const t = spell === 'lightning' ? LIGHTNING : FIREBALL;
    const kind: ShotKind = spell === 'lightning' ? 'bolt' : 'fireball';
    if (!canCast(this.mana, t.cost)) {
      this.sfx.play('noMana');
      return;
    }
    if (!canThrow(this.countShots(kind), t.maxInFlight, this.lastCastAt, now, t.cooldownMs)) {
      return;
    }
    this.mana = spend(this.mana, t.cost, now);
    this.casts += 1;
    this.sfx.play(spell === 'lightning' ? 'zap' : 'cast');
    this.lastCastAt = now;
    this.throwUntil = now + t.castPauseMs;
    this.shoot(kind);
  }

  private shoot(kind: ShotKind): void {
    this.animate(false);
    this.shotIds += 1;
    const d = launch(SHOT_HIT_IDS + this.shotIds, this.pos, this.facing, SWORD.bodyHeight);
    const sprite = this.shotPool.take(
      kind === 'dagger' ? 'dagger' : kind === 'bolt' ? 'bolt' : 'fire-ball',
    );
    // The bolt's art points left; the others point right.
    sprite.setAngle(DAGGER_ANGLE[d.dir] + (kind === 'bolt' ? 180 : 0));
    if (kind === 'fireball') sprite.play(animKey('fire-ball', 'fly'));
    if (kind === 'bolt') sprite.play(animKey('bolt', 'fly'));
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
    const { col, row } = this.room;
    const room = this.world.rooms.get(roomKey(col, row));
    // Shots stop where Jarrett would: walls, stones, and anything not yet broken open.
    const solid = (cx: number, cy: number): boolean =>
      this.outsideRoom(cx, cy) || this.solidAt(col, row, cx, cy);
    for (const shot of [...this.shots]) {
      const t = SHOT_TUNING[shot.kind];
      // A fireball flies on into a thorn bush, which then burns; a bolt into a crystal switch.
      const fixtureAt = (cx: number, cy: number) => room?.cells[cy]?.[cx]?.fixture;
      const into = (cx: number, cy: number): boolean =>
        solid(cx, cy) &&
        !(shot.kind === 'fireball' && fixtureAt(cx, cy) === 'thorns') &&
        !(shot.kind === 'bolt' && fixtureAt(cx, cy) === 'switch');
      const step = stepProjectile(shot.d, deltaMs, t, into);
      shot.d = step.projectile;
      const box = projectileBox(shot.d, t);
      const target = this.enemies.find((live) =>
        overlaps(box, enemyBody(live.e, ENEMIES[live.e.kind])),
      );
      if (target && shot.kind === 'bolt') this.stun(target, shot.d.id);
      else if (target) this.strike(target, t.damage, shot.d.id, shot.d.dir);
      const boss = !target && this.bossAt(box);
      // A bolt stuns a wrapped boss (the Mummy), and does nothing to the others.
      if (boss && shot.kind === 'bolt') this.stunTheBoss(shot.d.id);
      else if (boss) this.strikeBoss(t.damage, shot.d.id, null);
      const burned = shot.kind === 'fireball' && this.burnThorns(box);
      const powered = shot.kind === 'bolt' && this.powerSwitches(box);
      if (target || boss || burned || powered || step.stopped) this.dropShot(shot);
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
    this.dropBoss();
    this.unseal();
    if (this.walker) this.enemyPool.give(this.walker.sprite.setFlipX(false));
    this.walker = null;
    if (this.shopkeeper) this.enemyPool.give(this.shopkeeper.sprite);
    this.shopkeeper = null;
    this.struckWalls.clear();
  }

  snapshot(): GameSnapshot {
    return {
      player: { ...this.pos },
      facing: this.facing,
      moving: this.moving,
      heroSprite: {
        anim: this.hero.anims.isPlaying ? (this.hero.anims.currentAnim?.key ?? null) : null,
        flipped: this.hero.flipX,
      },
      seed: this.seed,
      map: this.mapId,
      room: { ...this.room },
      region: this.world.regions.get(roomKey(this.room.col, this.room.row)) ?? 'forest',
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
        stunned: isStunned(e),
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
      bolts: this.shotsOf('bolt'),
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
      boss: this.boss
        ? {
            kind: this.boss.b.kind,
            x: this.boss.b.pos.x,
            y: this.boss.b.pos.y,
            health: this.boss.b.health,
            fierce: isFierce(this.boss.b, BOSSES[this.boss.b.kind]),
            crouching: this.boss.b.phase === 'crouch' && !isAirborne(this.boss.b),
            airborne: isAirborne(this.boss.b),
            stunned: this.boss.b.stunMs > 0,
          }
        : null,
      sealed: this.sealed.length > 0,
      shards: shardsHeld(this.progress),
      announced: this.announced,
      playMs: this.playMs,
      saves: this.saves,
      cheated: this.cheated,
      savedPlayMs: this.savedPlayMs,
      walker: this.walker ? { ...this.walker.feet } : null,
      talking: this.talk
        ? {
            page: this.talk.page,
            pages: this.talk.pages.length,
            lines: [...(this.talk.pages[this.talk.page]?.lines ?? [])],
          }
        : null,
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

  /** Test hook only: jump to a room on this map, standing at its start position. */
  testGoToRoom(col: number, row: number): void {
    this.arrive({
      cells: [],
      to: {
        map: this.mapId,
        room: { col, row },
        feet: { x: HERO.start.col * TILE, y: (HERO.start.row + 1) * TILE - HERO.start.lift },
        facing: 'down',
      },
    });
  }

  /** Test hook only: bump into a cell of this room, as walking into it does. */
  testBump(x: number, y: number): void {
    this.bumpInto(x, y);
  }

  /** Test hook only: turn every page of the talk under way, as Space does one at a time. */
  testFinishTalk(): void {
    while (this.talk) this.turnPage();
  }

  /** Test hook only: count dungeon n's shard as found. */
  testTakeShard(n: number): void {
    this.progress = takeReward(this.progress, rewardId(`dungeon${n}`, 'shard'));
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

  /**
   * Test hook only: change one cell of the current room's text (e.g. put a thorn
   * bush there) and redraw it, so tests can try things not yet placed in the world.
   */
  testSetCell(cx: number, cy: number, ch: string): void {
    // Earlier changes on this map are kept: each builds on the last.
    const edits = [
      ...this.testEdits.filter((e) => e.map === this.mapId),
      { map: this.mapId, col: this.room.col, row: this.room.row, cx, cy, ch },
    ];
    this.testEdits = edits;
    const defs = MAPS[this.mapId].rooms.map((d) => {
      const mine = edits.filter((e) => e.col === d.col && e.row === d.row);
      if (mine.length === 0) return d;
      const lines = d.lines.map((line, y) =>
        mine.reduce((l, e) => (e.cy === y ? l.slice(0, e.cx) + e.ch + l.slice(e.cx + 1) : l), line),
      );
      return { ...d, lines };
    });
    this.world = buildWorld(defs);
    this.resetStones();
    this.redrawRoom();
  }

  /** Test hook only: set the boss's health (it still needs a hit to be beaten). */
  testSetBossHealth(health: number): void {
    if (this.boss) this.boss.b = { ...this.boss.b, health: Math.max(1, health) };
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
    /** The mana bar's full width (0 until he knows a spell), and its blue fill's. */
    manaBar: number;
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
        this.enteredRoom();
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
    // The sheets' side row faces right; facing left is that row mirrored.
    const row = this.facing === 'left' ? 'right' : this.facing;
    this.hero.setFlipX(this.facing === 'left');
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
    const key = roomKey(col, row);
    const region = this.world.regions.get(key) ?? 'forest';
    // Dungeons, indoors (the shop), and the vault grounds outdoors are drawn in stone.
    const theme = MAPS[this.mapId].theme;
    const dungeon = theme === 'dungeon' || theme === 'indoors' || region === 'vault';
    const art = dungeon
      ? dungeonArt(room, (x, y) => isOpened(this.progress, fixtureId(this.mapId, key, x, y)))
      : roomArt(room, region, (x, y) => isOpened(this.progress, fixtureId(this.mapId, key, x, y)));
    const sheet = dungeon ? 'dungeon' : 'forest';
    const drawn: Phaser.GameObjects.GameObject[] = [];
    // Each object's own tint, kept under a map or region tint (a thorn bush, a dim switch).
    const ownTint = new Map<Phaser.GameObjects.GameObject, number>();
    for (const t of art.ground) {
      const image = this.add
        .image(o.x + t.x, o.y + t.y, t.sheet ?? sheet, t.frame)
        .setOrigin(0)
        .setDepth(DEPTH.ground);
      if (t.dim) {
        image.setTint(SWITCH_DIM);
        ownTint.set(image, SWITCH_DIM);
      }
      drawn.push(image);
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
      const image = this.add
        .image(o.x + p.x, o.y + p.y, propSheet(p.prop, region), `prop:${p.prop}`)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.sorted + o.y + p.y)
        .setTint(p.prop === 'thorns' ? THORN_TINT : 0xffffff);
      if (p.prop === 'thorns') ownTint.set(image, THORN_TINT);
      drawn.push(image);
    }
    for (const t of art.over) {
      drawn.push(
        this.add
          .image(o.x + t.x, o.y + t.y, t.sheet ?? 'forest', t.frame)
          .setOrigin(0)
          .setDepth(DEPTH.over),
      );
    }
    // The marsh (the forest's art, darkened and greened), the volcano edge (the mountains,
    // reddened), and a map with a tint of its own (Bog Grotto). Thorns and dim switches keep theirs under it.
    const tint =
      MAPS[this.mapId].tint ??
      (region === 'marsh' ? MARSH_TINT : region === 'volcano' ? VOLCANO_TINT : null);
    if (tint !== null) {
      for (const o of drawn) {
        const own = ownTint.get(o);
        (o as Phaser.GameObjects.Image).setTint(own === undefined ? tint : mixTint(own, tint));
      }
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

/** Where a chest's prize lands: its cell's bottom middle (room pixels). */
function chestDrop(col: number, row: number): Point {
  return { x: col * TILE + TILE / 2, y: (row + 1) * TILE - 1 };
}

/** Seed from the URL (?seed=123) for repeatable runs, otherwise the default. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : DEFAULT_SEED;
}

/** The cells a box covers. */
function cellsUnder(box: Rect): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = Math.floor(box.y / TILE); y <= Math.floor((box.y + box.h - 1) / TILE); y++) {
    for (let x = Math.floor(box.x / TILE); x <= Math.floor((box.x + box.w - 1) / TILE); x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}
