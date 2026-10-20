/**
 * Jarrett's potions (engine-free, unit tested): a Health Potion refills his
 * hearts, a Mana Brew makes mana refill faster for a while. He carries up to
 * a few of each.
 */
export type PotionKind = 'health' | 'mana';

export type Potions = Readonly<Record<PotionKind, number>>;

export const NO_POTIONS: Potions = { health: 0, mana: 0 };

/** Picks one up if there's room; `taken` is false when he already has the most he can carry. */
export function addPotion(
  p: Potions,
  kind: PotionKind,
  max: number,
): { potions: Potions; taken: boolean } {
  if (p[kind] >= max) return { potions: p, taken: false };
  return { potions: { ...p, [kind]: p[kind] + 1 }, taken: true };
}

/** Uses one up, if he has one. */
export function usePotion(p: Potions, kind: PotionKind): { potions: Potions; used: boolean } {
  if (p[kind] <= 0) return { potions: p, used: false };
  return { potions: { ...p, [kind]: p[kind] - 1 }, used: true };
}
