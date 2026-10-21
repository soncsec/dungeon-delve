import { describe, expect, it } from 'vitest';
import {
  bossBody,
  bossShotOrigin,
  hitBoss,
  isBeaten,
  isFierce,
  spawnBoss,
  spread,
  stepBoss,
  type Boss,
  type BossStats,
} from '../../src/logic/boss';
import { createRng, type Rng } from '../../src/logic/rng';

const s: BossStats = {
  health: 10,
  contactDamage: 2,
  box: { halfWidth: 14, height: 30 },
  shuffle: { speed: 20, range: 40 },
  calm: { shots: 3, spreadDeg: 20, everyMs: { min: 2000, max: 2000 } },
  fierce: { shots: 5, spreadDeg: 18, everyMs: { min: 1500, max: 1500 } },
};
const firstRng: Rng = {
  next: () => 0,
  int: (min) => min,
  range: (min) => min,
  pick: (i) => i[0] as (typeof i)[number],
};
const boss = (over: Partial<Boss> = {}): Boss => ({
  kind: 'treant',
  pos: { x: 160, y: 60 },
  home: { x: 160, y: 60 },
  health: 10,
  heading: 1,
  shootInMs: 5000,
  lastHitBy: null,
  flashMs: 0,
  ...over,
});
const hero = { x: 160, y: 140 };

describe('spawnBoss', () => {
  it('starts at full health, at home, with a shot timer; the same seed gives the same boss', () => {
    const b = spawnBoss('treant', { x: 160, y: 60 }, s, createRng(4));
    expect(b).toMatchObject({ health: 10, home: { x: 160, y: 60 }, shootInMs: 2000, flashMs: 0 });
    expect(spawnBoss('treant', { x: 1, y: 2 }, s, createRng(4))).toEqual(
      spawnBoss('treant', { x: 1, y: 2 }, s, createRng(4)),
    );
  });
});

describe('spread', () => {
  it('fans shots evenly round the aim', () => {
    const d = spread({ x: 0, y: 1 }, 3, 90);
    expect(d[0]?.x).toBeCloseTo(1);
    expect(d[1]?.y).toBeCloseTo(1);
    expect(d[2]?.x).toBeCloseTo(-1);
    expect(spread({ x: 1, y: 0 }, 1, 30)).toEqual([{ x: 1, y: 0 }]);
  });
});

describe('stepBoss', () => {
  it('shuffles, turning at the edge of its range', () => {
    let r = stepBoss(boss(), 1000, hero, s, firstRng);
    expect(r.boss.pos.x).toBe(180);
    r = stepBoss(boss({ pos: { x: 195, y: 60 } }), 1000, hero, s, firstRng);
    expect(r.boss.pos.x).toBe(200);
    expect(r.boss.heading).toBe(-1);
    r = stepBoss(boss({ pos: { x: 125, y: 60 }, heading: -1 }), 1000, hero, s, firstRng);
    expect(r.boss.pos.x).toBe(120);
    expect(r.boss.heading).toBe(1);
  });

  it('fires a calm spread of 3 at Jarrett when its timer runs out', () => {
    const r = stepBoss(boss({ shootInMs: 10 }), 20, hero, s, firstRng);
    expect(r.shots).toHaveLength(3);
    expect(r.shots[1]?.y).toBeGreaterThan(0.99); // the middle one straight at him (below)
    expect(r.boss.shootInMs).toBe(2000);
    expect(stepBoss(r.boss, 20, hero, s, firstRng).shots).toEqual([]);
  });

  it('turns fierce at half health: a spread of 5, more often', () => {
    const b = boss({ health: 5, shootInMs: 0 });
    expect(isFierce(b, s)).toBe(true);
    expect(isFierce(boss({ health: 6 }), s)).toBe(false);
    const r = stepBoss(b, 10, hero, s, firstRng);
    expect(r.shots).toHaveLength(5);
    expect(r.boss.shootInMs).toBe(1500);
  });

  it('aims straight down when Jarrett is right on top of its shot point', () => {
    const one = { ...s, calm: { ...s.calm, shots: 1 } };
    const r = stepBoss(boss({ shootInMs: 0, heading: 1 }), 0, { x: 160, y: 45 }, one, firstRng);
    expect(r.shots).toHaveLength(1);
    expect(r.shots[0]?.x).toBeCloseTo(0);
    expect(r.shots[0]?.y).toBeCloseTo(1);
  });

  it('stops flashing after a while', () => {
    expect(stepBoss(boss({ flashMs: 100 }), 60, hero, s, firstRng).boss.flashMs).toBe(40);
    expect(stepBoss(boss({ flashMs: 50 }), 60, hero, s, firstRng).boss.flashMs).toBe(0);
  });
});

describe('hits', () => {
  it('cost health and flash it; each hit lands once; beaten at zero', () => {
    const b = hitBoss(boss(), 2, 7, 200);
    expect(b).toMatchObject({ health: 8, lastHitBy: 7, flashMs: 200 });
    expect(hitBoss(b, 2, 7, 200)).toBe(b);
    const beaten = hitBoss(boss({ health: 1 }), 5, 8, 200);
    expect(beaten.health).toBe(0);
    expect(isBeaten(beaten)).toBe(true);
    expect(isBeaten(b)).toBe(false);
    expect(hitBoss(beaten, 1, 9, 200)).toBe(beaten);
  });

  it('has a body box and fires from its middle', () => {
    expect(bossBody(boss(), s)).toEqual({ x: 146, y: 30, w: 28, h: 30 });
    expect(bossShotOrigin(boss(), s)).toEqual({ x: 160, y: 45 });
  });
});
