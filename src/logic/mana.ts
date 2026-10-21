/**
 * Mana for spells (engine-free, unit tested). Casting spends it; it refills
 * by itself once Jarrett hasn't cast for a moment, and a Mana Brew makes it
 * refill several times faster for a while.
 */
export interface Mana {
  current: number;
  max: number;
  /** Game time of the last cast (ms), or null before any. */
  lastSpentAt: number | null;
  /** Refilling is faster until this game time (ms). */
  boostUntil: number;
}

export interface ManaTuning {
  /** Mana per second while refilling. */
  perSecond: number;
  /** Refilling starts this long after the last cast (ms). */
  delayMs: number;
  /** How much faster it refills during a Mana Brew. */
  boostFactor: number;
}

/** The most mana Jarrett can hold: the base, and more for each Mana Crystal found. */
export function maxMana(base: number, perCrystal: number, crystals: number): number {
  return base + perCrystal * crystals;
}

export function fullMana(max: number): Mana {
  return { current: max, max, lastSpentAt: null, boostUntil: 0 };
}

export function canCast(m: Mana, cost: number): boolean {
  return m.current >= cost;
}

/** Spends `cost` mana, or returns the mana unchanged if there isn't enough. */
export function spend(m: Mana, cost: number, now: number): Mana {
  if (!canCast(m, cost)) return m;
  return { ...m, current: m.current - cost, lastSpentAt: now };
}

/** Refills for `dtMs` of game time ending at `now`. */
export function refill(m: Mana, now: number, dtMs: number, t: ManaTuning): Mana {
  if (m.current >= m.max) return m;
  if (m.lastSpentAt !== null && now - m.lastSpentAt < t.delayMs) return m;
  const rate = t.perSecond * (now < m.boostUntil ? t.boostFactor : 1);
  return { ...m, current: Math.min(m.max, m.current + (rate * dtMs) / 1000) };
}

/** A Mana Brew: faster refilling from now for `durationMs` (drinking another extends it). */
export function boost(m: Mana, now: number, durationMs: number): Mana {
  return { ...m, boostUntil: Math.max(m.boostUntil, now) + durationMs };
}

/** Whether a Mana Brew is working now. */
export function isBoosted(m: Mana, now: number): boolean {
  return now < m.boostUntil;
}
