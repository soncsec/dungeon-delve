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
