/**
 * The on-screen pad for phones and tablets (engine-free, unit tested; owner
 * 2026-10-20, brought forward 2026-10-21). A finger on the pad holds the
 * arrows its direction points to, as the keyboard's arrow keys would: eight
 * ways, with a small dead zone in the middle where nothing is held.
 */

/** The arrow keys a pad direction holds. */
export interface PadKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export const NO_KEYS: PadKeys = { left: false, right: false, up: false, down: false };

/**
 * The arrows held by a finger at (`dx`, `dy`) from the pad's middle (screen
 * pixels, y down). Within `deadZone` of the middle, none. Otherwise the
 * direction is rounded to the nearest of eight: a diagonal holds two arrows.
 */
export function padKeys(dx: number, dy: number, deadZone: number): PadKeys {
  if (Math.hypot(dx, dy) < deadZone) return NO_KEYS;
  // Eight 45° sectors, centred on the four arrows and the four diagonals, from right
  // going clockwise (y is down); straight left is sector 4 or -4.
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return EIGHT_WAYS[(sector + 8) % 8] as PadKeys;
}

const EIGHT_WAYS: readonly PadKeys[] = [
  { ...NO_KEYS, right: true },
  { ...NO_KEYS, right: true, down: true },
  { ...NO_KEYS, down: true },
  { ...NO_KEYS, left: true, down: true },
  { ...NO_KEYS, left: true },
  { ...NO_KEYS, left: true, up: true },
  { ...NO_KEYS, up: true },
  { ...NO_KEYS, right: true, up: true },
];

/** The key codes behind each arrow (what the keyboard sends). */
export const PAD_CODES: Readonly<Record<keyof PadKeys, string>> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

/** Which arrows to press and to let go, going from `was` to `now`. */
export function padChanges(was: PadKeys, now: PadKeys): { press: string[]; release: string[] } {
  const keys = Object.keys(PAD_CODES) as (keyof PadKeys)[];
  return {
    press: keys.filter((k) => now[k] && !was[k]).map((k) => PAD_CODES[k]),
    release: keys.filter((k) => was[k] && !now[k]).map((k) => PAD_CODES[k]),
  };
}
