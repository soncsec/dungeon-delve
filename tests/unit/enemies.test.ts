import { describe, expect, it } from 'vitest';
import {
  enemyBody,
  facingOf,
  hitEnemy,
  isDefeated,
  isStunned,
  spawnEnemy,
  stunEnemy,
  stepEnemy,
  towards,
  type Enemy,
  type EnemyStats,
  type StepContext,
} from '../../src/logic/enemies';
import { createRng, type Rng } from '../../src/logic/rng';

/** pick() returns the first item and int() the minimum: predictable. */
const firstRng: Rng = {
  next: () => 0,
  int: (min) => min,
  range: (min) => min,
  pick: (items) => items[0] as (typeof items)[number],
};
const base: EnemyStats = {
  behaviour: 'wander',
  health: 2,
  contactDamage: 1,
  speed: 30,
  box: { halfWidth: 7, height: 10 },
  flies: false,
  turnMs: { min: 600, max: 1600 },
  knockback: { speed: 160, ms: 150 },
};
const open = (): boolean => false;
const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  hero: { x: 300, y: 300 },
  rng: firstRng,
  walkSolid: open,
  flySolid: open,
  ...over,
});
const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  kind: 'robot',
  pos: { x: 100, y: 100 },
  dir: { x: 1, y: 0 },
  facing: 'right',
  health: 2,
  turnInMs: 1000,
  knockMs: 0,
  knockDir: 'down',
  lastHitBy: null,
  chargeMs: 0,
  restMs: 0,
  circle: 1,
  shootInMs: 0,
  stunMs: 0,
  ...over,
});

describe('helpers', () => {
  it('facingOf uses the stronger axis, sideways on ties, and keeps facing when still', () => {
    expect(facingOf({ x: -1, y: 0.5 }, 'up')).toBe('left');
    expect(facingOf({ x: 0.2, y: -1 }, 'down')).toBe('up');
    expect(facingOf({ x: 0, y: 1 }, 'up')).toBe('down');
    expect(facingOf({ x: 0.5, y: 0.5 }, 'up')).toBe('right');
    expect(facingOf({ x: 0, y: 0 }, 'left')).toBe('left');
  });

  it('towards gives a unit vector, or zero for the same place', () => {
    expect(towards({ x: 0, y: 0 }, { x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(towards({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });
});

describe('spawnEnemy', () => {
  it('starts at full health with a random way and walk time; the same seed gives the same enemy', () => {
    const e = spawnEnemy('robot', { x: 50, y: 60 }, base, createRng(3));
    expect(e.pos).toEqual({ x: 50, y: 60 });
    expect(e.health).toBe(2);
    expect(e.turnInMs).toBeGreaterThanOrEqual(600);
    expect(e.shootInMs).toBe(0);
    expect(spawnEnemy('robot', { x: 0, y: 0 }, base, createRng(9))).toEqual(
      spawnEnemy('robot', { x: 0, y: 0 }, base, createRng(9)),
    );
  });

  it('gives shooters a first shot time, and flutterers eight possible ways', () => {
    const eye = spawnEnemy(
      'eye',
      { x: 0, y: 0 },
      { ...base, behaviour: 'hover', shootMs: { min: 900, max: 900 } },
      firstRng,
    );
    expect(eye.shootInMs).toBe(900);
    const dirs = new Set<string>();
    const rng = createRng(1);
    for (let i = 0; i < 60; i++) {
      const b = spawnEnemy('bird', { x: 0, y: 0 }, { ...base, behaviour: 'flutter' }, rng);
      dirs.add(`${b.dir.x.toFixed(2)},${b.dir.y.toFixed(2)}`);
    }
    expect(dirs.size).toBe(8);
  });
});

describe('knockback', () => {
  it('pushes the enemy the way it was hit, for the knockback time, before anything else', () => {
    const r = stepEnemy(enemy({ knockMs: 150, knockDir: 'left' }), 100, base, ctx());
    expect(r.enemy.pos).toEqual({ x: 84, y: 100 });
    expect(r.enemy.knockMs).toBe(50);
    expect(r.shots).toEqual([]);
  });

  it('uses the fliers’ rules for fliers', () => {
    const wall = (): boolean => true;
    const r = stepEnemy(
      enemy({ knockMs: 150, knockDir: 'left' }),
      100,
      { ...base, flies: true },
      ctx({ walkSolid: wall }),
    );
    expect(r.enemy.pos.x).toBe(84);
  });
});

describe('wander (robot)', () => {
  it('walks the way it faces', () => {
    const r = stepEnemy(enemy(), 500, base, ctx());
    expect(r.enemy.pos).toEqual({ x: 115, y: 100 });
    expect(r.enemy.turnInMs).toBe(500);
  });

  it('chooses a new way when its time runs out', () => {
    const r = stepEnemy(enemy({ turnInMs: 100 }), 200, base, ctx());
    expect(r.enemy.dir).toEqual({ x: 0, y: 1 });
    expect(r.enemy.facing).toBe('down');
    expect(r.enemy.turnInMs).toBe(600);
  });

  it('turns to a different way when blocked', () => {
    const wall = (cx: number): boolean => cx >= 7;
    const r = stepEnemy(enemy({ pos: { x: 105, y: 100 } }), 500, base, ctx({ walkSolid: wall }));
    expect(r.enemy.pos.x).toBe(105);
    expect(r.enemy.dir).toEqual({ x: 0, y: 1 });
    expect(r.enemy.turnInMs).toBe(600);
  });

  it('standing still for no time is not being blocked', () => {
    expect(stepEnemy(enemy(), 0, base, ctx()).enemy.dir).toEqual({ x: 1, y: 0 });
  });
});

describe('flutter (bird)', () => {
  it('flies over walls, in eight directions', () => {
    const stats: EnemyStats = { ...base, behaviour: 'flutter', flies: true };
    const r = stepEnemy(
      enemy({ dir: { x: Math.SQRT1_2, y: Math.SQRT1_2 } }),
      500,
      stats,
      ctx({ walkSolid: () => true }),
    );
    expect(r.enemy.pos.x).toBeCloseTo(100 + 15 * Math.SQRT1_2);
    expect(r.enemy.pos.y).toBeCloseTo(100 + 15 * Math.SQRT1_2);
  });
});

describe('drift (ghost)', () => {
  it('floats straight at Jarrett, through walls', () => {
    const stats: EnemyStats = { ...base, behaviour: 'drift', flies: true, speed: 20 };
    const r = stepEnemy(
      enemy(),
      1000,
      stats,
      ctx({ hero: { x: 100, y: 200 }, walkSolid: () => true }),
    );
    expect(r.enemy.pos).toEqual({ x: 100, y: 120 });
    expect(r.enemy.facing).toBe('down');
  });
});

describe('hover (flying eye)', () => {
  const stats: EnemyStats = {
    ...base,
    behaviour: 'hover',
    flies: true,
    speed: 10,
    keep: { near: 50, far: 100 },
    shootMs: { min: 2000, max: 3000 },
  };
  it('backs off when too close, and faces him', () => {
    const r = stepEnemy(enemy({ shootInMs: 5000 }), 1000, stats, ctx({ hero: { x: 130, y: 100 } }));
    expect(r.enemy.pos).toEqual({ x: 90, y: 100 });
    expect(r.enemy.facing).toBe('right');
  });

  it('comes closer when too far', () => {
    const r = stepEnemy(enemy({ shootInMs: 5000 }), 1000, stats, ctx({ hero: { x: 300, y: 100 } }));
    expect(r.enemy.pos).toEqual({ x: 110, y: 100 });
  });

  it('circles at a middle distance, either way round', () => {
    const hero = { x: 175, y: 100 };
    const a = stepEnemy(enemy({ shootInMs: 5000, circle: 1 }), 1000, stats, ctx({ hero }));
    expect(a.enemy.pos.x).toBeCloseTo(100);
    expect(a.enemy.pos.y).toBeCloseTo(110);
    const b = stepEnemy(enemy({ shootInMs: 5000, circle: -1 }), 1000, stats, ctx({ hero }));
    expect(b.enemy.pos.y).toBeCloseTo(90);
  });

  it('shoots at him when its timer runs out, then waits again', () => {
    const r = stepEnemy(enemy({ shootInMs: 100 }), 200, stats, ctx({ hero: { x: 100, y: 180 } }));
    // From the middle of its body (box height 10), straight at him.
    expect(r.shots[0]?.dir).toEqual({ x: 0, y: 1 });
    expect(r.shots[0]?.from.x).toBeCloseTo(r.enemy.pos.x);
    expect(r.shots[0]?.from.y).toBeCloseTo(r.enemy.pos.y - 5);
    expect(r.enemy.shootInMs).toBe(2000);
    expect(stepEnemy(r.enemy, 100, stats, ctx()).shots).toEqual([]);
  });

  it('shoots straight down if he is right on top of it', () => {
    const r = stepEnemy(enemy({ shootInMs: 0 }), 10, stats, ctx({ hero: { x: 100, y: 100 } }));
    expect(r.shots[0]?.dir).toEqual({ x: 0, y: 1 });
  });

  it('without distances or a gun it just comes closer and never shoots', () => {
    const plain: EnemyStats = { ...base, behaviour: 'hover', flies: true, speed: 10 };
    const r = stepEnemy(enemy(), 1000, plain, ctx({ hero: { x: 130, y: 100 } }));
    expect(r.enemy.pos.x).toBe(110);
    expect(r.shots).toEqual([]);
  });
});

describe('charge (wolf)', () => {
  const stats: EnemyStats = {
    ...base,
    behaviour: 'charge',
    health: 3,
    charge: { speed: 120, ms: 1000, sight: 120, inLine: 6, restMs: 600 },
  };
  it('charges when Jarrett is in line on its row', () => {
    const r = stepEnemy(enemy(), 16, stats, ctx({ hero: { x: 40, y: 103 } }));
    expect(r.enemy.dir).toEqual({ x: -1, y: 0 });
    expect(r.enemy.facing).toBe('left');
    expect(r.enemy.chargeMs).toBe(1000);
  });

  it('charges when he is in line on its column', () => {
    const r = stepEnemy(enemy(), 16, stats, ctx({ hero: { x: 98, y: 200 } }));
    expect(r.enemy.dir).toEqual({ x: 0, y: 1 });
  });

  it('wanders when he is out of line, too far, or right on top of it', () => {
    expect(stepEnemy(enemy(), 100, stats, ctx({ hero: { x: 140, y: 140 } })).enemy.chargeMs).toBe(
      0,
    );
    expect(stepEnemy(enemy(), 100, stats, ctx({ hero: { x: 300, y: 100 } })).enemy.chargeMs).toBe(
      0,
    );
    expect(stepEnemy(enemy(), 100, stats, ctx({ hero: { x: 100, y: 100 } })).enemy.chargeMs).toBe(
      0,
    );
  });

  it('rushes along its charge, then rests when the charge ends', () => {
    let e = enemy({ dir: { x: 1, y: 0 }, chargeMs: 1000 });
    e = stepEnemy(e, 500, stats, ctx()).enemy;
    expect(e.pos.x).toBe(160);
    expect(e.chargeMs).toBe(500);
    e = stepEnemy(e, 600, stats, ctx()).enemy;
    expect(e.chargeMs).toBe(0);
    expect(e.restMs).toBe(600);
  });

  it('stops its charge at a wall and rests', () => {
    const wall = (cx: number): boolean => cx >= 7;
    const e = stepEnemy(
      enemy({ pos: { x: 105, y: 100 }, chargeMs: 1000 }),
      100,
      stats,
      ctx({ walkSolid: wall }),
    ).enemy;
    expect(e.chargeMs).toBe(0);
    expect(e.restMs).toBe(600);
  });

  it('does not charge again while resting, but wanders', () => {
    const e = stepEnemy(enemy({ restMs: 600 }), 100, stats, ctx({ hero: { x: 40, y: 100 } })).enemy;
    expect(e.chargeMs).toBe(0);
    expect(e.restMs).toBe(500);
    expect(e.pos.x).toBe(103);
  });

  it('without charge numbers it only wanders', () => {
    const e = stepEnemy(
      enemy(),
      100,
      { ...base, behaviour: 'charge' },
      ctx({ hero: { x: 40, y: 100 } }),
    ).enemy;
    expect(e.chargeMs).toBe(0);
  });
});

describe('hits', () => {
  it('cost health, knock back, stop a charge, and count once per hit id', () => {
    const e = hitEnemy(enemy({ chargeMs: 500 }), 1, 7, 'up', base);
    expect(e).toMatchObject({ health: 1, knockMs: 150, knockDir: 'up', lastHitBy: 7, chargeMs: 0 });
    expect(hitEnemy(e, 1, 7, 'up', base)).toBe(e);
    expect(isDefeated(e)).toBe(false);
    expect(isDefeated(hitEnemy(e, 5, 8, 'up', base))).toBe(true);
    expect(hitEnemy(e, 5, 8, 'up', base).health).toBe(0);
  });

  it('its body is its collision box', () => {
    expect(enemyBody(enemy(), base)).toEqual({ x: 93, y: 90, w: 14, h: 10 });
  });
});

describe('stunned by Lightning', () => {
  it('a bolt stuns it for a while, once per bolt, and stops a charge', () => {
    const e = stunEnemy(enemy({ chargeMs: 400 }), 3000, 9);
    expect(e).toMatchObject({ stunMs: 3000, lastHitBy: 9, chargeMs: 0, health: 2 });
    expect(isStunned(e)).toBe(true);
    expect(stunEnemy(e, 3000, 9)).toBe(e);
    expect(isStunned(enemy())).toBe(false);
  });

  it('stands still and shoots nothing while stunned, then goes its way again', () => {
    const e = enemy({ stunMs: 500, shootInMs: 0 });
    let r = stepEnemy(e, 300, base, ctx());
    expect(r.enemy.pos).toEqual(e.pos);
    expect(r.enemy.stunMs).toBe(200);
    expect(r.shots).toEqual([]);
    r = stepEnemy(r.enemy, 300, base, ctx());
    expect(r.enemy.stunMs).toBe(0);
    expect(r.enemy.pos).toEqual(e.pos); // the last of the stun used this step up
    r = stepEnemy(r.enemy, 100, base, ctx());
    expect(r.enemy.pos).not.toEqual(e.pos);
  });

  it('knockback still moves a stunned enemy', () => {
    const r = stepEnemy(enemy({ stunMs: 500, knockMs: 100, knockDir: 'left' }), 50, base, ctx());
    expect(r.enemy.pos.x).toBeLessThan(100);
    expect(r.enemy.stunMs).toBe(500);
  });
});

describe('the snake: spits along a line', () => {
  const snake: EnemyStats = {
    ...base,
    behaviour: 'spit',
    speed: 20,
    spit: { sight: 100, inLine: 8, restMs: 1000 },
    shotKind: 'venom',
  };

  it('in line with Jarrett, it faces him and spits along the line, then coils', () => {
    const r = stepEnemy(enemy({ restMs: 0 }), 100, snake, ctx({ hero: { x: 160, y: 104 } }));
    expect(r.shots).toEqual([{ from: { x: 100, y: 95 }, dir: { x: 1, y: 0 } }]);
    expect(r.enemy).toMatchObject({ facing: 'right', restMs: 1000, pos: { x: 100, y: 100 } });
    // Coiled: still, and no more spit until it has rested.
    const coiled = stepEnemy(r.enemy, 400, snake, ctx({ hero: { x: 160, y: 104 } }));
    expect(coiled.shots).toEqual([]);
    expect(coiled.enemy).toMatchObject({ restMs: 600, pos: { x: 100, y: 100 } });
  });

  it('spits up or down a column too, and not beyond its sight', () => {
    const up = stepEnemy(enemy(), 10, snake, ctx({ hero: { x: 96, y: 40 } }));
    expect(up.shots[0]?.dir).toEqual({ x: 0, y: -1 });
    const far = stepEnemy(enemy(), 10, snake, ctx({ hero: { x: 300, y: 100 } }));
    expect(far.shots).toEqual([]);
  });

  it('out of line, it just slithers about', () => {
    const r = stepEnemy(
      enemy({ dir: { x: 1, y: 0 } }),
      500,
      snake,
      ctx({ hero: { x: 160, y: 160 } }),
    );
    expect(r.shots).toEqual([]);
    expect(r.enemy.pos.x).toBe(110);
  });

  it('with no spit settings it never sees him', () => {
    const blind: EnemyStats = { ...base, behaviour: 'spit' };
    const r = stepEnemy(enemy(), 10, blind, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.shots).toEqual([]);
  });
});

describe('the mushroom: puffs spores all round', () => {
  const mushroom: EnemyStats = {
    ...base,
    behaviour: 'puff',
    speed: 10,
    shootMs: { min: 3000, max: 3000 },
    puff: { shots: 4 },
    shotKind: 'spore',
  };

  it('plods about, and when its timer runs out puffs spores out evenly round it', () => {
    const r = stepEnemy(enemy({ shootInMs: 50 }), 100, mushroom, ctx());
    expect(r.shots).toHaveLength(4);
    expect(r.shots.map((p) => [Math.round(p.dir.x) + 0, Math.round(p.dir.y) + 0])).toEqual([
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]);
    expect(r.enemy.shootInMs).toBe(3000);
    expect(r.enemy.pos.x).toBe(101);
  });

  it('between puffs, nothing; without a timer, never', () => {
    expect(stepEnemy(enemy({ shootInMs: 500 }), 100, mushroom, ctx()).shots).toEqual([]);
    const shy: EnemyStats = { ...base, behaviour: 'puff' };
    expect(stepEnemy(enemy({ shootInMs: 0 }), 100, shy, ctx()).shots).toEqual([]);
  });

  it('puffs four spores if it doesn’t say how many', () => {
    const plain: EnemyStats = {
      ...base,
      behaviour: 'puff',
      shootMs: { min: 3000, max: 3000 },
    };
    expect(stepEnemy(enemy({ shootInMs: 0 }), 10, plain, ctx()).shots).toHaveLength(4);
  });
});

describe('the toad: sits, then hops at Jarrett', () => {
  const toad: EnemyStats = {
    ...base,
    behaviour: 'leap',
    leap: { speed: 100, ms: 300, restMs: { min: 800, max: 800 } },
  };

  it('sits out its rest without moving', () => {
    const r = stepEnemy(enemy({ restMs: 500 }), 200, toad, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.enemy).toMatchObject({ restMs: 300, pos: { x: 100, y: 100 }, chargeMs: 0 });
  });

  it('then hops at where he is, and sits again when the hop ends', () => {
    let r = stepEnemy(enemy({ restMs: 0 }), 10, toad, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.enemy).toMatchObject({ chargeMs: 300, dir: { x: 1, y: 0 }, facing: 'right' });
    r = stepEnemy(r.enemy, 200, toad, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.enemy.pos.x).toBe(120);
    expect(r.enemy.chargeMs).toBe(100);
    r = stepEnemy(r.enemy, 200, toad, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.enemy.pos.x).toBe(130); // only the last 100 ms of the hop
    expect(r.enemy).toMatchObject({ chargeMs: 0, restMs: 800 });
  });

  it('right on top of him, it waits; with no hop settings, it never moves', () => {
    const on = stepEnemy(enemy({ restMs: 0 }), 10, toad, ctx({ hero: { x: 100, y: 100 } }));
    expect(on.enemy).toMatchObject({ chargeMs: 0, restMs: 0 });
    const lazy: EnemyStats = { ...base, behaviour: 'leap' };
    const r = stepEnemy(enemy({ restMs: 0 }), 100, lazy, ctx({ hero: { x: 160, y: 100 } }));
    expect(r.enemy.pos).toEqual({ x: 100, y: 100 });
  });
});
