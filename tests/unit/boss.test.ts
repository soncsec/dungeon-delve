import { describe, expect, it } from 'vitest';
import {
  bossBody,
  blinkSpots,
  bossShotOrigin,
  drainHeal,
  gallopWay,
  hitBoss,
  isGalloping,
  isGone,
  isBreathing,
  isLashing,
  lashHurts,
  nearBody,
  popDecoy,
  isAirborne,
  isBeaten,
  isFierce,
  glancesOff,
  leapHeight,
  leapTarget,
  aimAt,
  spawnBoss,
  spread,
  stepBoss,
  stunBoss,
  type Boss,
  type BossStats,
} from '../../src/logic/boss';
import { createRng, type Rng } from '../../src/logic/rng';

const s: BossStats = {
  health: 10,
  contactDamage: 2,
  box: { halfWidth: 14, height: 30 },
  moves: { style: 'shuffle', speed: 20, range: 40 },
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
  phase: 'sit',
  leap: null,
  stunMs: 0,
  dash: null,
  restMs: 0,
  stayMs: 0,
  goneMs: 0,
  decoys: [],
  breath: null,
  lash: null,
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
    const b = hitBoss(boss(), 2, 7, 200, s);
    expect(b).toMatchObject({ health: 8, lastHitBy: 7, flashMs: 200 });
    expect(hitBoss(b, 2, 7, 200, s)).toBe(b);
    const beaten = hitBoss(boss({ health: 1 }), 5, 8, 200, s);
    expect(beaten.health).toBe(0);
    expect(isBeaten(beaten)).toBe(true);
    expect(isBeaten(b)).toBe(false);
    expect(hitBoss(beaten, 1, 9, 200, s)).toBe(beaten);
  });

  it('has a body box and fires from its middle', () => {
    expect(bossBody(boss(), s)).toEqual({ x: 146, y: 30, w: 28, h: 30 });
    expect(bossShotOrigin(boss(), s)).toEqual({ x: 160, y: 45 });
  });
});

describe('the Giant Frog: a leaper', () => {
  const hop = {
    style: 'hop',
    crouchMs: 500,
    leapMs: 1000,
    reach: 100,
    peak: 20,
    arena: { x: 40, y: 60, w: 240, h: 60 },
  } as const;
  const f: BossStats = {
    ...s,
    moves: hop,
    calm: { shots: 4, spreadDeg: 90, everyMs: { min: 1500, max: 1500 } },
    fierce: { shots: 8, spreadDeg: 45, everyMs: { min: 900, max: 900 } },
  };
  const frog = (over: Partial<Boss> = {}): Boss =>
    boss({
      kind: 'frog',
      pos: { x: 160, y: 80 },
      home: { x: 160, y: 80 },
      shootInMs: 1000,
      ...over,
    });
  const near = { x: 160, y: 110 };

  it('sits out its timer, then crouches for a while (the warning), without moving', () => {
    let r = stepBoss(frog(), 400, near, f, firstRng);
    expect(r.boss).toMatchObject({ phase: 'sit', shootInMs: 600, pos: { x: 160, y: 80 } });
    r = stepBoss(r.boss, 600, near, f, firstRng);
    expect(r.boss).toMatchObject({ phase: 'crouch', shootInMs: 500, leap: null });
    expect(isAirborne(r.boss)).toBe(false);
    expect(r.shots).toEqual([]);
  });

  it('then leaps at where Jarrett is, rising and falling; in the air no hit lands', () => {
    const crouched = frog({ phase: 'crouch', shootInMs: 100 });
    let r = stepBoss(crouched, 100, near, f, firstRng);
    expect(r.boss.leap).toEqual({ from: { x: 160, y: 80 }, to: near, ms: 0 });
    expect(isAirborne(r.boss)).toBe(true);
    expect(leapHeight(r.boss, f)).toBe(0);
    r = stepBoss(r.boss, 500, near, f, firstRng);
    expect(r.boss.pos).toEqual({ x: 160, y: 95 }); // halfway
    expect(leapHeight(r.boss, f)).toBe(20); // at its peak
    expect(hitBoss(r.boss, 1, 7, 100, f)).toBe(r.boss);
    expect(r.shots).toEqual([]);
  });

  it('lands where it aimed, throwing a ring of four shots (one at Jarrett), and sits again', () => {
    const flying = frog({ leap: { from: { x: 160, y: 80 }, to: { x: 160, y: 100 }, ms: 900 } });
    const r = stepBoss(flying, 200, { x: 160, y: 200 }, f, firstRng);
    expect(r.boss).toMatchObject({ pos: { x: 160, y: 100 }, leap: null, phase: 'sit' });
    expect(r.boss.shootInMs).toBe(1500);
    expect(isAirborne(r.boss)).toBe(false);
    expect(r.shots).toHaveLength(4);
    // The first straight at him (below), the rest round the compass.
    expect(r.shots.map((v) => [Math.round(v.x) + 0, Math.round(v.y) + 0])).toEqual([
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ]);
  });

  it('fiercer below half health: eight shots a landing, and shorter sits', () => {
    const flying = frog({ health: 5, leap: { from: { x: 160, y: 80 }, to: near, ms: 999 } });
    const r = stepBoss(flying, 10, { x: 160, y: 200 }, f, firstRng);
    expect(r.shots).toHaveLength(8);
    expect(r.boss.shootInMs).toBe(900);
  });

  it('leaps at most its reach, and lands inside the arena', () => {
    expect(leapTarget({ x: 160, y: 80 }, { x: 160, y: 300 }, hop)).toEqual({ x: 160, y: 120 });
    expect(leapTarget({ x: 160, y: 80 }, { x: 460, y: 80 }, hop)).toEqual({ x: 260, y: 80 });
    expect(leapTarget({ x: 60, y: 80 }, { x: 0, y: 80 }, hop)).toEqual({ x: 40, y: 80 });
    expect(leapTarget({ x: 160, y: 70 }, { x: 160, y: 0 }, hop)).toEqual({ x: 160, y: 60 });
  });

  it('a shuffler never leaps, and has no height', () => {
    expect(leapHeight(boss({ leap: { from: hero, to: hero, ms: 10 } }), s)).toBe(0);
    expect(leapHeight(frog(), f)).toBe(0);
  });
});

describe('the Mummy: shambling, and wrapped tight', () => {
  const shamble = {
    style: 'shamble',
    speed: 20,
    arena: { x: 40, y: 60, w: 240, h: 60 },
  } as const;
  const m: BossStats = { ...s, moves: shamble, wrapped: { stunMs: 3000 } };
  const mummy = (over: Partial<Boss> = {}): Boss =>
    boss({ kind: 'mummy', pos: { x: 160, y: 80 }, home: { x: 160, y: 80 }, ...over });

  it('shambles straight at Jarrett, no further than he is, and keeps inside the arena', () => {
    let r = stepBoss(mummy(), 1000, { x: 160, y: 200 }, m, firstRng);
    expect(r.boss.pos).toEqual({ x: 160, y: 100 });
    r = stepBoss(mummy(), 1000, { x: 165, y: 80 }, m, firstRng);
    expect(r.boss.pos).toEqual({ x: 165, y: 80 }); // there already
    r = stepBoss(mummy({ pos: { x: 160, y: 115 } }), 1000, { x: 160, y: 300 }, m, firstRng);
    expect(r.boss.pos.y).toBe(120); // the arena's bottom
    r = stepBoss(mummy(), 1000, { x: 160, y: 80 }, m, firstRng);
    expect(r.boss.pos).toEqual({ x: 160, y: 80 }); // right on him: stays
  });

  it('fires its spread from where it has shambled to', () => {
    const r = stepBoss(mummy({ shootInMs: 10 }), 500, { x: 160, y: 200 }, m, firstRng);
    expect(r.shots).toHaveLength(3);
    expect(r.boss.pos).toEqual({ x: 160, y: 90 });
  });

  it('hits glance off until a Lightning bolt stuns it; then they land', () => {
    expect(glancesOff(mummy(), m, 'wooden-sword')).toBe(true);
    expect(hitBoss(mummy(), 1, 7, 100, m)).toEqual(mummy());
    const stunned = stunBoss(mummy(), 40, m);
    expect(stunned).toMatchObject({ stunMs: 3000, lastHitBy: 40 });
    expect(glancesOff(stunned, m, 'wooden-sword')).toBe(false);
    expect(hitBoss(stunned, 1, 41, 100, m).health).toBe(9);
    expect(stunBoss(stunned, 40, m)).toBe(stunned); // the same bolt counts once
  });

  it('stunned, it stands still and fires nothing, then shambles on', () => {
    let r = stepBoss(mummy({ stunMs: 500, shootInMs: 0 }), 300, { x: 160, y: 200 }, m, firstRng);
    expect(r.boss).toMatchObject({ pos: { x: 160, y: 80 }, stunMs: 200 });
    expect(r.shots).toEqual([]);
    r = stepBoss(r.boss, 300, { x: 160, y: 200 }, m, firstRng);
    expect(r.boss.stunMs).toBe(0);
    r = stepBoss(r.boss, 500, { x: 160, y: 200 }, m, firstRng);
    expect(r.boss.pos.y).toBe(90);
  });

  it('a boss not wrapped shrugs a bolt off', () => {
    expect(stunBoss(boss(), 40, s)).toEqual(boss());
    expect(glancesOff(boss(), s, 'wooden-sword')).toBe(false);
  });
});

describe('the Ogre: a wind-up, a ring of shockwaves, and a hide only the Axe gets through', () => {
  const o: BossStats = {
    ...s,
    moves: { style: 'shuffle', speed: 20, range: 40 },
    windUpMs: 700,
    ring: true,
    calm: { shots: 8, spreadDeg: 45, everyMs: { min: 2400, max: 2400 } },
    fierce: { shots: 12, spreadDeg: 30, everyMs: { min: 1600, max: 1600 } },
    hide: 'axe',
  };
  const ogre = (over: Partial<Boss> = {}): Boss => boss({ kind: 'ogre', ...over });

  it('when its timer runs out it winds up first, standing still, and fires nothing yet', () => {
    const r = stepBoss(ogre({ shootInMs: 10 }), 20, hero, o, firstRng);
    expect(r.boss).toMatchObject({ phase: 'crouch', shootInMs: 700 });
    expect(r.shots).toEqual([]);
    const still = stepBoss(r.boss, 300, hero, o, firstRng);
    expect(still.boss.pos).toEqual(r.boss.pos);
    expect(still.boss.shootInMs).toBe(400);
  });

  it('then slams: a ring of eight, the first straight at Jarrett; it moves on after', () => {
    const r = stepBoss(ogre({ phase: 'crouch', shootInMs: 10 }), 20, hero, o, firstRng);
    expect(r.shots).toHaveLength(8);
    expect(r.shots[0]?.y).toBeCloseTo(1);
    expect(r.boss).toMatchObject({ phase: 'sit', shootInMs: 2400 });
    expect(stepBoss(r.boss, 1000, hero, o, firstRng).boss.pos.x).toBe(180);
  });

  it('fiercer below half health: twelve in the ring', () => {
    const r = stepBoss(ogre({ health: 5, phase: 'crouch', shootInMs: 0 }), 10, hero, o, firstRng);
    expect(r.shots).toHaveLength(12);
  });

  it('only the Axe’s blows land; the sword and every shot glance off', () => {
    expect(glancesOff(ogre(), o, 'wooden-sword')).toBe(true);
    expect(glancesOff(ogre(), o, null)).toBe(true);
    expect(glancesOff(ogre(), o, 'axe')).toBe(false);
    expect(hitBoss(ogre(), 1, 5, 100, o, 'wooden-sword')).toEqual(ogre());
    expect(hitBoss(ogre(), 1, 5, 100, o, 'axe').health).toBe(9);
  });

  it('a boss without a wind-up fires its spread at once, as before', () => {
    const r = stepBoss(boss({ shootInMs: 10 }), 20, hero, s, firstRng);
    expect(r.shots).toHaveLength(3);
    expect(r.boss.phase).toBe('sit');
  });
});

describe('the Centaur: pacing, galloping when level with Jarrett, and a storm for an attack', () => {
  const m = {
    style: 'gallop' as const,
    speed: 20,
    dashSpeed: 100,
    dashMs: 1000,
    sight: 200,
    inLine: 12,
    restMs: 900,
    arena: { x: 50, y: 70, w: 220, h: 50 },
  };
  const c: BossStats = {
    health: 12,
    contactDamage: 2,
    box: { halfWidth: 22, height: 64 },
    moves: m,
    windUpMs: 900,
    storm: true,
    calm: { shots: 0, spreadDeg: 0, everyMs: { min: 2600, max: 2600 } },
    fierce: { shots: 0, spreadDeg: 0, everyMs: { min: 1800, max: 1800 } },
  };
  const centaur = (over: Partial<Boss> = {}): Boss =>
    boss({
      kind: 'centaur',
      pos: { x: 160, y: 100 },
      home: { x: 160, y: 100 },
      health: 12,
      ...over,
    });

  it('sees him level with it along a row or a column, within sight', () => {
    const at = { x: 160, y: 100 };
    expect(gallopWay(at, { x: 260, y: 108 }, m)).toEqual({ x: 1, y: 0 });
    expect(gallopWay(at, { x: 60, y: 92 }, m)).toEqual({ x: -1, y: 0 });
    expect(gallopWay(at, { x: 150, y: 20 }, m)).toEqual({ x: 0, y: -1 });
    expect(gallopWay(at, { x: 170, y: 180 }, m)).toEqual({ x: 0, y: 1 });
    expect(gallopWay(at, { x: 400, y: 100 }, m)).toBeNull(); // too far
    expect(gallopWay(at, { x: 160, y: 400 }, m)).toBeNull();
    expect(gallopWay(at, { x: 200, y: 140 }, m)).toBeNull(); // not level
    expect(gallopWay(at, at, m)).toBeNull(); // on top of it
  });

  it('paces towards him, inside its arena, when he is not level with it', () => {
    const r = stepBoss(centaur(), 1000, { x: 100, y: 160 }, c, firstRng);
    expect(r.boss.pos.x).toBeLessThan(160);
    expect(r.boss.pos.y).toBeGreaterThan(100);
    expect(r.boss.pos.y).toBeLessThanOrEqual(120);
    expect(r.boss.heading).toBe(-1);
    expect(r.storm).toBe(false);
    expect(
      stepBoss(centaur({ heading: -1 }), 1000, { x: 260, y: 20 }, c, firstRng).boss.heading,
    ).toBe(1);
    // Straight below, beyond sight: it paces down, still facing the same way.
    expect(stepBoss(centaur(), 100, { x: 160, y: 400 }, c, firstRng).boss.heading).toBe(1);
    // On top of it: nowhere to go.
    expect(stepBoss(centaur(), 100, { x: 160, y: 100 }, c, firstRng).boss.pos).toEqual({
      x: 160,
      y: 100,
    });
  });

  it('level with him, it gallops along the line, fast, then rests at the edge of its arena', () => {
    let b = stepBoss(centaur(), 16, { x: 260, y: 100 }, c, firstRng).boss;
    expect(isGalloping(b)).toBe(true);
    expect(b.dash).toEqual({ dir: { x: 1, y: 0 }, ms: 1000 });
    b = stepBoss(b, 500, { x: 260, y: 100 }, c, firstRng).boss;
    expect(b.pos.x).toBe(210); // 100 px a second
    expect(b.heading).toBe(1);
    b = stepBoss(b, 500, { x: 260, y: 100 }, c, firstRng).boss;
    expect(b.pos.x).toBe(260);
    // Its time is up: it rests, standing still.
    expect(isGalloping(b)).toBe(false);
    expect(b.restMs).toBe(900);
    const resting = stepBoss(b, 400, { x: 60, y: 100 }, c, firstRng).boss;
    expect(resting.pos).toEqual(b.pos);
    expect(resting.restMs).toBe(500);
    // At the arena's edge a dash ends early.
    const left = stepBoss(
      centaur({ pos: { x: 100, y: 100 }, dash: { dir: { x: -1, y: 0 }, ms: 1000 } }),
      1500,
      { x: 0, y: 0 },
      c,
      firstRng,
    );
    expect(left.boss.pos.x).toBe(50);
    expect(left.boss.heading).toBe(-1);
    expect(left.boss.dash).toBeNull();
    // Up and down, it keeps facing the way it did.
    const up = stepBoss(
      centaur({ dash: { dir: { x: 0, y: -1 }, ms: 1000 } }),
      100,
      { x: 0, y: 0 },
      c,
      firstRng,
    );
    expect(up.boss.heading).toBe(1);
    expect(up.boss.pos.y).toBe(90);
  });

  it('when its timer runs out, it rears (standing still), then calls the storm', () => {
    const rears = stepBoss(centaur({ shootInMs: 10 }), 20, { x: 100, y: 160 }, c, firstRng);
    expect(rears.boss).toMatchObject({ phase: 'crouch', shootInMs: 900 });
    expect(rears.storm).toBe(false);
    const still = stepBoss(rears.boss, 400, { x: 260, y: 100 }, c, firstRng);
    expect(still.boss.pos).toEqual(rears.boss.pos);
    expect(still.boss.dash).toBeNull(); // rearing, it won't gallop
    expect(still.boss.shootInMs).toBe(500);
    const storm = stepBoss(still.boss, 500, { x: 100, y: 160 }, c, firstRng);
    expect(storm.storm).toBe(true);
    expect(storm.shots).toEqual([]);
    expect(storm.boss).toMatchObject({ phase: 'sit', shootInMs: 2600 });
    // Fiercer below half health: storms come sooner.
    const fierce = stepBoss(
      centaur({ health: 6, phase: 'crouch', shootInMs: 0 }),
      10,
      hero,
      c,
      firstRng,
    );
    expect(fierce.boss.shootInMs).toBe(1800);
  });

  it('with no wind-up, it calls the storm on the next step', () => {
    const quick: BossStats = { ...c, moves: m };
    delete (quick as { windUpMs?: number }).windUpMs;
    const r = stepBoss(centaur({ shootInMs: 10 }), 20, { x: 100, y: 160 }, quick, firstRng);
    expect(r.boss).toMatchObject({ phase: 'crouch', shootInMs: 0 });
    expect(stepBoss(r.boss, 16, { x: 100, y: 160 }, quick, firstRng).storm).toBe(true);
  });

  it('any weapon hurts it', () => {
    expect(glancesOff(centaur(), c, 'wooden-sword')).toBe(false);
    expect(glancesOff(centaur(), c, null)).toBe(false);
    expect(hitBoss(centaur(), 1, 7, 100, c, 'wooden-sword').health).toBe(11);
  });
});

describe('the Witch: blinking from spot to spot, with decoys when fierce', () => {
  const spots = [
    { x: 60, y: 80 },
    { x: 160, y: 80 },
    { x: 260, y: 80 },
    { x: 60, y: 120 },
  ];
  const m = {
    style: 'blink' as const,
    stayMs: { min: 2000, max: 2000 },
    goneMs: 500,
    spots,
    decoys: 2,
  };
  const w: BossStats = {
    health: 10,
    contactDamage: 2,
    box: { halfWidth: 14, height: 60 },
    moves: m,
    shotKind: 'fire',
    calm: { shots: 3, spreadDeg: 20, everyMs: { min: 1500, max: 1500 } },
    fierce: { shots: 3, spreadDeg: 25, everyMs: { min: 1000, max: 1000 } },
  };
  const witch = (over: Partial<Boss> = {}): Boss =>
    boss({ kind: 'witch', pos: { x: 60, y: 80 }, home: { x: 60, y: 80 }, stayMs: 2000, ...over });

  it('starts with a stay at its spot', () => {
    expect(spawnBoss('witch', { x: 60, y: 80 }, w, firstRng).stayMs).toBe(2000);
    expect(spawnBoss('treant', { x: 60, y: 80 }, s, firstRng).stayMs).toBe(0);
  });

  it('picks spots to appear at: all different, never where it was, no more than there are', () => {
    expect(blinkSpots({ x: 60, y: 80 }, m, 3, firstRng)).toEqual([
      { x: 160, y: 80 },
      { x: 260, y: 80 },
      { x: 60, y: 120 },
    ]);
    expect(blinkSpots({ x: 60, y: 80 }, m, 9, firstRng)).toHaveLength(3);
  });

  it('throws its spread when its timer runs out, standing at its spot', () => {
    const r = stepBoss(witch({ shootInMs: 10 }), 20, hero, w, firstRng);
    expect(r.shots).toHaveLength(3);
    expect(r.boss.pos).toEqual({ x: 60, y: 80 });
    expect(r.boss.shootInMs).toBe(1500);
    expect(stepBoss(witch(), 20, hero, w, firstRng).shots).toEqual([]);
  });

  it('vanishes when its stay is up (nothing lands on it then), and appears elsewhere', () => {
    const gone = stepBoss(witch({ stayMs: 10 }), 20, hero, w, firstRng).boss;
    expect(isGone(gone)).toBe(true);
    expect(hitBoss(gone, 1, 9, 100, w, 'wooden-sword')).toEqual(gone);
    const still = stepBoss(gone, 200, hero, w, firstRng).boss;
    expect(isGone(still)).toBe(true);
    const back = stepBoss(still, 300, hero, w, firstRng).boss;
    expect(isGone(back)).toBe(false);
    expect(back.pos).toEqual({ x: 160, y: 80 });
    expect(back.stayMs).toBe(2000);
    expect(back.decoys).toEqual([]); // calm: no decoys
  });

  it('fierce, it appears with two look-alike decoys at other spots', () => {
    const back = stepBoss(witch({ health: 5, goneMs: 10 }), 20, hero, w, firstRng).boss;
    expect(back.pos).toEqual({ x: 160, y: 80 });
    expect(back.decoys).toEqual([
      { x: 260, y: 80 },
      { x: 60, y: 120 },
    ]);
    // When it vanishes again, so do they.
    expect(stepBoss({ ...back, stayMs: 5 }, 10, hero, w, firstRng).boss.decoys).toEqual([]);
  });

  it('with nowhere else to go, it comes back where it was', () => {
    const lone = { ...m, spots: [{ x: 60, y: 80 }] };
    const back = stepBoss(witch({ goneMs: 10 }), 20, hero, { ...w, moves: lone }, firstRng).boss;
    expect(back.pos).toEqual({ x: 60, y: 80 });
  });

  it('a blow pops a decoy, and the Witch is none the worse; any weapon hurts the real one', () => {
    const b = witch({
      decoys: [
        { x: 160, y: 80 },
        { x: 260, y: 80 },
      ],
    });
    const popped = popDecoy(b, 0);
    expect(popped.decoys).toEqual([{ x: 260, y: 80 }]);
    expect(popped.health).toBe(10);
    expect(hitBoss(b, 2, 4, 100, w, 'steel-sword').health).toBe(8);
    expect(hitBoss(b, 1, 5, 100, w, null).health).toBe(9);
  });
});

describe('the Vampire: gliding after Jarrett, draining him, and bursting into a ring', () => {
  const spots = [
    { x: 60, y: 90 },
    { x: 160, y: 80 },
  ];
  const m = {
    style: 'swarm' as const,
    speed: 20,
    goneMs: 500,
    spots,
    arena: { x: 50, y: 70, w: 220, h: 50 },
  };
  const v: BossStats = {
    health: 12,
    contactDamage: 1,
    drain: 1,
    box: { halfWidth: 20, height: 56 },
    moves: m,
    shotKind: 'dark',
    calm: { shots: 8, spreadDeg: 45, everyMs: { min: 4000, max: 4000 } },
    fierce: { shots: 12, spreadDeg: 30, everyMs: { min: 2500, max: 2500 } },
  };
  const vampire = (over: Partial<Boss> = {}): Boss =>
    boss({
      kind: 'vampire',
      pos: { x: 60, y: 90 },
      home: { x: 60, y: 90 },
      health: 12,
      stayMs: 4000,
      ...over,
    });

  it('starts with its stay at its spot', () => {
    expect(spawnBoss('vampire', { x: 60, y: 90 }, v, firstRng).stayMs).toBe(4000);
  });

  it('glides after him, inside its arena, turning his way', () => {
    const r = stepBoss(vampire(), 1000, { x: 160, y: 90 }, v, firstRng);
    expect(r.boss.pos).toEqual({ x: 80, y: 90 });
    expect(r.boss.heading).toBe(1);
    expect(r.shots).toEqual([]);
    expect(
      stepBoss(vampire({ heading: 1 }), 1000, { x: 0, y: 90 }, v, firstRng).boss,
    ).toMatchObject({
      pos: { x: 50, y: 90 },
      heading: -1,
    });
    // Right under it: it stays put, facing as it was.
    expect(stepBoss(vampire(), 100, { x: 60, y: 90 }, v, firstRng).boss.pos).toEqual({
      x: 60,
      y: 90,
    });
    expect(
      stepBoss(vampire({ heading: -1 }), 100, { x: 60, y: 200 }, v, firstRng).boss.heading,
    ).toBe(-1);
  });

  it('when its time is up, it bursts into a ring of shots (the first at him) and vanishes', () => {
    const r = stepBoss(vampire({ stayMs: 10 }), 20, { x: 160, y: 90 }, v, firstRng);
    expect(r.shots).toHaveLength(8);
    expect(r.shots[0]?.x).toBeGreaterThan(0.9);
    expect(isGone(r.boss)).toBe(true);
    // Twelve when fierce.
    expect(stepBoss(vampire({ health: 6, stayMs: 10 }), 20, hero, v, firstRng).shots).toHaveLength(
      12,
    );
  });

  it('then re-forms at another spot, staying a shorter time when fierce', () => {
    const still = stepBoss(vampire({ goneMs: 400 }), 100, hero, v, firstRng).boss;
    expect(isGone(still)).toBe(true);
    const back = stepBoss(still, 300, hero, v, firstRng).boss;
    expect(isGone(back)).toBe(false);
    expect(back.pos).toEqual({ x: 160, y: 80 });
    expect(back.stayMs).toBe(4000);
    expect(stepBoss(vampire({ health: 6, goneMs: 10 }), 20, hero, v, firstRng).boss.stayMs).toBe(
      2500,
    );
    // With nowhere else to go, it re-forms where it was.
    const lone = { ...v, moves: { ...m, spots: [{ x: 60, y: 90 }] } };
    expect(stepBoss(vampire({ goneMs: 10 }), 20, hero, lone, firstRng).boss.pos).toEqual({
      x: 60,
      y: 90,
    });
  });

  it('a touch heals it a little, never past full; a boss that does not drain is unchanged', () => {
    expect(drainHeal(vampire({ health: 5 }), v).health).toBe(6);
    expect(drainHeal(vampire({ health: 12 }), v).health).toBe(12);
    expect(drainHeal(boss({ health: 5 }), s)).toEqual(boss({ health: 5 }));
  });
});

describe('the Dragon: prowling its lair, sweeping fire breath, and lashing its tail', () => {
  const m = {
    style: 'prowl' as const,
    speed: 20,
    gapMs: 100,
    tail: { reach: 16, ms: 600, hurtFromMs: 300, restMs: 1000, damage: 2 },
    arena: { x: 70, y: 72, w: 180, h: 0 },
  };
  const d: BossStats = {
    health: 18,
    contactDamage: 2,
    box: { halfWidth: 30, height: 34 },
    moves: m,
    shotKind: 'fire',
    mouth: { ahead: 32, up: 26 },
    windUpMs: 500,
    calm: { shots: 5, spreadDeg: 15, everyMs: { min: 3000, max: 3000 } },
    fierce: { shots: 7, spreadDeg: 12, everyMs: { min: 2000, max: 2000 } },
  };
  const dragon = (over: Partial<Boss> = {}): Boss =>
    boss({
      kind: 'dragon',
      pos: { x: 160, y: 72 },
      home: { x: 160, y: 72 },
      health: 18,
      heading: -1,
      ...over,
    });
  const below = { x: 160, y: 130 };
  const close = { x: 160, y: 80 };
  const lastRng: Rng = { ...firstRng, pick: (i) => i[i.length - 1] as (typeof i)[number] };

  it('starts with no breath and no lash', () => {
    expect(spawnBoss('dragon', { x: 160, y: 72 }, d, firstRng)).toMatchObject({
      breath: null,
      lash: null,
    });
  });

  it('paces along the top of its lair towards his side, facing him', () => {
    const r = stepBoss(dragon(), 1000, { x: 260, y: 130 }, d, firstRng);
    expect(r.boss.pos).toEqual({ x: 180, y: 72 });
    expect(r.boss.heading).toBe(1);
    expect(r.shots).toEqual([]);
    // No further than the arena's edge.
    expect(
      stepBoss(dragon({ pos: { x: 80, y: 72 } }), 1000, { x: 0, y: 130 }, d, firstRng).boss,
    ).toMatchObject({ pos: { x: 70, y: 72 }, heading: -1 });
    // Right above him: it stays put, facing as it was.
    expect(stepBoss(dragon({ heading: 1 }), 100, below, d, firstRng).boss).toMatchObject({
      pos: { x: 160, y: 72 },
      heading: 1,
    });
  });

  it('breathes from its mouth, on the side it faces', () => {
    expect(bossShotOrigin(dragon({ heading: -1 }), d)).toEqual({ x: 128, y: 46 });
    expect(bossShotOrigin(dragon({ heading: 1 }), d)).toEqual({ x: 192, y: 46 });
  });

  it('rears when its timer is up, standing still, then sweeps its breath across him one shot at a time', () => {
    const rear = stepBoss(dragon({ shootInMs: 10 }), 20, below, d, firstRng).boss;
    expect(rear).toMatchObject({ phase: 'crouch', shootInMs: 500 });
    const rearing = stepBoss(rear, 499, { x: 260, y: 130 }, d, firstRng).boss;
    expect(rearing).toMatchObject({ phase: 'crouch', pos: { x: 160, y: 72 } });
    // Done rearing: the breath, aimed where he is now.
    const start = stepBoss(rearing, 10, below, d, firstRng).boss;
    expect(isBreathing(start)).toBe(true);
    const aim = aimAt(bossShotOrigin(start, d), below);
    expect(start.breath).toEqual({ aim, sent: 0, inMs: 0, side: 1 });
    // One shot at once, then one every 100 ms, from one side of the spread to the other.
    const a = stepBoss(start, 1, { x: 260, y: 130 }, d, firstRng);
    expect(a.shots).toHaveLength(1);
    expect(a.boss.pos).toEqual({ x: 160, y: 72 });
    const b = stepBoss(a.boss, 250, below, d, firstRng);
    expect(b.shots).toHaveLength(2);
    const c = stepBoss(b.boss, 400, below, d, firstRng);
    expect(c.shots).toHaveLength(2);
    expect([...a.shots, ...b.shots, ...c.shots]).toEqual(spread(aim, 5, 15));
    expect(isBreathing(c.boss)).toBe(false);
    expect(c.boss.shootInMs).toBe(3000);
  });

  it('sweeps from either side', () => {
    const start = stepBoss(dragon({ phase: 'crouch', shootInMs: 1 }), 10, below, d, lastRng).boss;
    expect(start.breath?.side).toBe(-1);
    const r = stepBoss(start, 1000, below, d, lastRng);
    expect(r.shots).toEqual([...spread(start.breath?.aim ?? { x: 0, y: 1 }, 5, 15)].reverse());
  });

  it('fierce, it breathes more shots, more often', () => {
    const start = stepBoss(
      dragon({ health: 9, phase: 'crouch', shootInMs: 1 }),
      10,
      below,
      d,
      firstRng,
    );
    const r = stepBoss(start.boss, 1000, below, d, firstRng);
    expect(r.shots).toHaveLength(7);
    expect(r.boss.shootInMs).toBe(2000);
  });

  it('with no wind-up, it breathes at once', () => {
    const quick: BossStats = { ...d };
    delete quick.windUpMs;
    const rear = stepBoss(dragon({ shootInMs: 10 }), 20, below, quick, firstRng).boss;
    expect(rear).toMatchObject({ phase: 'crouch', shootInMs: 0 });
    expect(isBreathing(stepBoss(rear, 1, below, quick, firstRng).boss)).toBe(true);
  });

  it('knows when he is close to its body', () => {
    const b = dragon(); // its body: x 130 to 190, y 38 to 72
    expect(nearBody(b, d, { x: 160, y: 80 }, 16)).toBe(true);
    expect(nearBody(b, d, { x: 160, y: 50 }, 0)).toBe(true);
    expect(nearBody(b, d, { x: 200, y: 80 }, 16)).toBe(true);
    expect(nearBody(b, d, { x: 160, y: 90 }, 16)).toBe(false);
    expect(nearBody(b, d, { x: 110, y: 50 }, 16)).toBe(false);
  });

  it('lashes its tail when he comes close: from partway in it hurts him if he is still in reach, then the tail rests', () => {
    const lash = stepBoss(dragon(), 10, close, d, firstRng).boss;
    expect(isLashing(lash)).toBe(true);
    expect(lashHurts(lash, d, close)).toBe(0);
    const swinging = stepBoss(lash, 300, close, d, firstRng).boss;
    expect(swinging.pos).toEqual({ x: 160, y: 72 });
    expect(lashHurts(swinging, d, close)).toBe(2);
    // Stepped back out of reach in time: it misses.
    expect(lashHurts(swinging, d, below)).toBe(0);
    const done = stepBoss(swinging, 300, close, d, firstRng).boss;
    expect(isLashing(done)).toBe(false);
    expect(lashHurts(done, d, close)).toBe(0);
    expect(done.restMs).toBe(1000);
    // Rested no longer than that: close again, it lashes again.
    const resting = stepBoss(done, 500, close, d, firstRng).boss;
    expect(isLashing(resting)).toBe(false);
    expect(isLashing(stepBoss(resting, 500, close, d, firstRng).boss)).toBe(true);
  });

  it('rearing or breathing, it does not lash', () => {
    const rearing = stepBoss(dragon({ phase: 'crouch', shootInMs: 100 }), 10, close, d, firstRng);
    expect(isLashing(rearing.boss)).toBe(false);
    const breath = { aim: { x: 0, y: 1 }, sent: 0, inMs: 50, side: 1 as const };
    expect(isLashing(stepBoss(dragon({ breath }), 10, close, d, firstRng).boss)).toBe(false);
  });

  it('only a prowler has a tail to lash', () => {
    expect(lashHurts(dragon({ lash: { ms: 400 } }), s, close)).toBe(0);
  });
});
