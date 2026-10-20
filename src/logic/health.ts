/**
 * Jarrett's health in half hearts (engine-free, unit tested). Damage is
 * ignored while he is invulnerable just after a hit.
 */
export interface Health {
  /** Half hearts left. */
  points: number;
  /** Half hearts when full (2 per heart). */
  max: number;
  /** Game time until which damage is ignored, in ms. */
  invulnerableUntil: number;
}

export function fullHealth(hearts: number): Health {
  return { points: hearts * 2, max: hearts * 2, invulnerableUntil: 0 };
}

export function isInvulnerable(h: Health, now: number): boolean {
  return now < h.invulnerableUntil;
}

/** Takes `amount` half hearts unless invulnerable; then invulnerable for `invulnerableMs`. */
export function takeDamage(h: Health, amount: number, now: number, invulnerableMs: number): Health {
  if (isInvulnerable(h, now) || amount <= 0) return h;
  return {
    ...h,
    points: Math.max(0, h.points - amount),
    invulnerableUntil: now + invulnerableMs,
  };
}

export function heal(h: Health, amount: number): Health {
  return { ...h, points: Math.min(h.max, h.points + Math.max(0, amount)) };
}

export function isOut(h: Health): boolean {
  return h.points <= 0;
}

/** For the HUD: each heart as 'full', 'half' or 'empty', left to right. */
export function heartStates(h: Health): ('full' | 'half' | 'empty')[] {
  return Array.from({ length: h.max / 2 }, (_, i) => {
    const left = h.points - i * 2;
    return left >= 2 ? 'full' : left === 1 ? 'half' : 'empty';
  });
}
