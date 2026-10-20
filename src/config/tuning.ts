/** All gameplay numbers live here so they can be tuned in one place. */

/** The screen (ADR-D02): a status bar over one room of 20×10 tiles of 16 px = 320×180. */
export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 10;
export const HUD_HEIGHT = 20;
export const GAME_WIDTH = ROOM_COLS * TILE;
export const GAME_HEIGHT = HUD_HEIGHT + ROOM_ROWS * TILE;
/** How long the view takes to slide to the next room, in ms. */
export const ROOM_SLIDE_MS = 500;

/** Jarrett. */
export const HERO = {
  /** Walking speed, pixels per second (about 3.6 s to cross a room). */
  speed: 88,
  /** Collision box at the feet: 10 px wide, 6 px tall, so his head can overlap walls above. */
  box: { halfWidth: 5, height: 6 },
  /** The walk sheet's 32×32 frames have the feet at y = 30. */
  frameHeight: 32,
  feetY: 30,
  /** First frame of each walk row: what he shows standing still. */
  standFrame: { down: 0, left: 4, up: 8 },
  /** Start position in the start room: feet on the line between columns 9 and 10, in row 5. */
  start: { col: 10, row: 5, lift: 2 },
} as const;

/** The sword: how far it reaches from Jarrett's body, and how long a swing lasts. */
export const SWORD = {
  reach: 16,
  sweep: 20,
  bodyHeight: 20,
  bodyHalfWidth: 4,
  durationMs: 250,
  /** Health a hit takes from an enemy. */
  damage: 1,
} as const;

/** The throwing dagger, Jarrett's first far weapon. */
export const DAGGER = {
  /** Pixels per second, and how far it flies before dropping out of sight. */
  speed: 220,
  range: 150,
  /** Hit box: long along its flight, thin across it. */
  length: 12,
  thickness: 6,
  /** At most this many in the air at once, and this long between throws (ms). */
  maxInFlight: 2,
  cooldownMs: 300,
  /** Jarrett stands still this long after a throw (ms). */
  throwPauseMs: 120,
  /** Health a hit takes from an enemy. */
  damage: 1,
} as const;

/** Mana for spells: refills by itself after a pause; a Mana Brew speeds it up (M2.3). */
export const MANA = {
  max: 100,
  /** Mana per second while refilling (empty to full in about 8 s). */
  perSecond: 12,
  /** Refilling starts this long after the last cast (ms). */
  delayMs: 1200,
  /** A Mana Brew makes refilling this many times faster, for this long (ms). */
  boostFactor: 3,
  boostMs: 30_000,
} as const;

/** The Fireball spell. */
export const FIREBALL = {
  cost: 25,
  speed: 160,
  range: 200,
  length: 16,
  thickness: 10,
  /** Two damage: one fireball defeats a robot. */
  damage: 2,
  /** One in the air at a time. */
  maxInFlight: 1,
  cooldownMs: 0,
  /** Jarrett stands still this long while casting (ms). */
  castPauseMs: 200,
} as const;

/** Jarrett's health, in half hearts (2 per heart). */
export const HEALTH = {
  startHearts: 3,
  /** After a hit, further damage is ignored for this long (ms); he blinks meanwhile. */
  invulnerableMs: 1000,
  /** A hit pushes him away from the enemy. */
  knockback: { speed: 140, ms: 150 },
} as const;

/** The robot, M1's enemy. */
export const ROBOT = {
  /** Pixels per second (Jarrett walks at 88). */
  speed: 30,
  /** Sword hits to defeat. */
  health: 2,
  /** Half hearts it takes from Jarrett on touch. */
  contactDamage: 1,
  /** Collision box at its feet (the sprite is 20×16). */
  box: { halfWidth: 7, height: 10 },
  /** It walks one way for this long (ms, random within) before choosing again. */
  turnMs: { min: 600, max: 1600 },
  /** How far a sword hit pushes it: speed × time. */
  knockback: { speed: 160, ms: 150 },
} as const;

/** What a defeated enemy drops, in whole percent (the rest drops nothing). */
export const DROPS = { gem: 40, heart: 20 } as const;

/** Pickups: what they're worth. A small heart restores this many half hearts. */
export const PICKUPS = { gemValue: 1, heartHeals: 2 } as const;

/** The status bar along the top. */
export const HUD = {
  /** CSS font family; Press Start 2P is drawn at 8 px, its native size. */
  font: '"Press Start 2P"',
  /** First heart's left edge, and the distance between hearts (the heart art is 15 px wide). */
  heartX: 4,
  heartSpacing: 15,
  /** The most gems the bar shows. */
  maxGems: 999,
} as const;

/** Seed for the random number generator; override with ?seed= in the URL. */
export const DEFAULT_SEED = 1;
