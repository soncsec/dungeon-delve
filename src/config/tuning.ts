/** All gameplay numbers live here so they can be tuned in one place. */

/** The screen (ADR-D02): a status bar over one room of 20×10 tiles of 16 px = 320×180. */
export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 10;
export const HUD_HEIGHT = 20;
export const GAME_WIDTH = ROOM_COLS * TILE;
export const GAME_HEIGHT = HUD_HEIGHT + ROOM_ROWS * TILE;

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

/** Seed for the random number generator; override with ?seed= in the URL. */
export const DEFAULT_SEED = 1;
