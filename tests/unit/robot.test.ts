import { describe, expect, it } from 'vitest';
import type { Rng } from '../../src/logic/rng';
import { createRng } from '../../src/logic/rng';
import {
  hitRobot,
  isDefeated,
  robotBody,
  spawnRobot,
  stepRobot,
  type Robot,
  type RobotTuning,
} from '../../src/logic/robot';

const t: RobotTuning = {
  speed: 30,
  health: 2,
  box: { halfWidth: 7, height: 10 },
  turnMs: { min: 600, max: 1600 },
  knockback: { speed: 160, ms: 150 },
};
const open = (): boolean => false;
/** An Rng whose pick() returns the first item and int() the minimum: predictable. */
const firstRng: Rng = {
  next: () => 0,
  int: (min) => min,
  range: (min) => min,
  pick: (items) => items[0] as (typeof items)[number],
};
const robot = (over: Partial<Robot> = {}): Robot => ({
  pos: { x: 100, y: 100 },
  facing: 'right',
  health: 2,
  turnInMs: 1000,
  knockMs: 0,
  knockDir: 'down',
  lastHitBySwing: null,
  ...over,
});

describe('spawnRobot', () => {
  it('starts at full health facing a random way, with a random walk time', () => {
    const r = spawnRobot({ x: 50, y: 60 }, t, createRng(3));
    expect(r.pos).toEqual({ x: 50, y: 60 });
    expect(r.health).toBe(2);
    expect(['down', 'up', 'left', 'right']).toContain(r.facing);
    expect(r.turnInMs).toBeGreaterThanOrEqual(600);
    expect(r.turnInMs).toBeLessThanOrEqual(1600);
    expect(r.knockMs).toBe(0);
  });

  it('is the same for the same seed', () => {
    expect(spawnRobot({ x: 0, y: 0 }, t, createRng(9))).toEqual(
      spawnRobot({ x: 0, y: 0 }, t, createRng(9)),
    );
  });
});

describe('stepRobot', () => {
  it('walks the way it faces at its speed', () => {
    const r = stepRobot(robot(), 500, t, firstRng, open);
    expect(r.pos).toEqual({ x: 115, y: 100 });
    expect(r.turnInMs).toBe(500);
  });

  it('chooses a new way when its walk time runs out', () => {
    const r = stepRobot(robot({ turnInMs: 100 }), 200, t, firstRng, open);
    expect(r.facing).toBe('down');
    expect(r.turnInMs).toBe(600);
    expect(r.pos).toEqual({ x: 100, y: 106 });
  });

  it('turns to a different way when blocked', () => {
    const wall = (cx: number): boolean => cx >= 7; // cells from x 112 are solid
    const r = stepRobot(robot({ pos: { x: 105, y: 100 } }), 500, t, firstRng, wall);
    expect(r.pos.x).toBe(105); // flush already
    expect(r.facing).toBe('down'); // first of the other three ways
    expect(r.turnInMs).toBe(600);
  });

  it('is knocked back instead of walking, for the knockback time only', () => {
    let r = robot({ knockMs: 150, knockDir: 'left' });
    r = stepRobot(r, 100, t, firstRng, open);
    expect(r.pos).toEqual({ x: 84, y: 100 });
    expect(r.knockMs).toBe(50);
    r = stepRobot(r, 100, t, firstRng, open); // only 50 ms of knockback left
    expect(r.pos).toEqual({ x: 76, y: 100 });
    expect(r.knockMs).toBe(0);
    expect(r.turnInMs).toBe(1000); // its walk timer waited
  });

  it('does not count standing still for no time as blocked', () => {
    expect(stepRobot(robot(), 0, t, firstRng, open)).toEqual(robot());
  });
});

describe('hits', () => {
  it('a hit costs health and knocks the robot the way the hero faces', () => {
    const r = hitRobot(robot(), 1, 7, 'up', t);
    expect(r.health).toBe(1);
    expect(r.knockMs).toBe(150);
    expect(r.knockDir).toBe('up');
    expect(r.lastHitBySwing).toBe(7);
    expect(isDefeated(r)).toBe(false);
  });

  it('one swing hits only once', () => {
    const once = hitRobot(robot(), 1, 7, 'up', t);
    expect(hitRobot(once, 1, 7, 'up', t)).toBe(once);
    expect(hitRobot(once, 1, 8, 'up', t).health).toBe(0);
  });

  it('is defeated at zero health, never below', () => {
    const r = hitRobot(robot({ health: 1 }), 5, 1, 'left', t);
    expect(r.health).toBe(0);
    expect(isDefeated(r)).toBe(true);
  });

  it('its body is its collision box', () => {
    expect(robotBody(robot(), t)).toEqual({ x: 93, y: 90, w: 14, h: 10 });
  });
});
