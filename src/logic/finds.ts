/**
 * Things on the ground, and holding up a find (owner 2026-10-22): when
 * Jarrett picks up something from a chest, or a boss's heart container or
 * shard, he turns to face you with it over his head while a success tune
 * plays, and the game waits a moment. Engine-free and unit tested.
 */
import type { Drop } from './drops';

/** Things on the ground: drops, and what chests and bosses leave. */
export type PickupKind =
  | Drop
  | 'health-potion'
  | 'mana-brew'
  | 'key'
  | 'item'
  | 'heart-container'
  | 'shard'
  | 'mana-crystal';

/** Finds worth holding up wherever they come from (a boss leaves the first two). */
const BIG_FINDS: ReadonlySet<PickupKind> = new Set(['heart-container', 'shard', 'mana-crystal']);

/** Whether he holds this find up: anything from a chest, and the big finds. An enemy's drop, no. */
export function holdsUp(kind: PickupKind, fromChest: boolean): boolean {
  return fromChest || BIG_FINDS.has(kind);
}

/** The tune for a find held up: a shard's or the Mana Crystal's big fanfare; the success jingle for the rest. */
export function findTune(kind: PickupKind): 'shard' | 'found' {
  return kind === 'shard' || kind === 'mana-crystal' ? 'shard' : 'found';
}

/** When the holding ends (game time, ms); 0 when he isn't holding anything up. */
export type Hold = number;

export const NO_HOLD: Hold = 0;

export function startHold(now: number, ms: number): Hold {
  return now + ms;
}

export function isHolding(hold: Hold, now: number): boolean {
  return now < hold;
}
