import { describe, expect, it } from 'vitest';
import { fireShot, shotBox, stepShot, type ShotTuning } from '../../src/logic/enemyShots';

const t: ShotTuning = { speed: 100, range: 50, size: 6, damage: 1 };
const open = (): boolean => false;

describe('enemy shots', () => {
  it('fly straight in any direction', () => {
    const s = fireShot({ x: 100, y: 100 }, { x: 0.6, y: 0.8 });
    const r = stepShot(s, 100, t, open);
    expect(r.shot.pos.x).toBeCloseTo(106);
    expect(r.shot.pos.y).toBeCloseTo(108);
    expect(r.shot.travelled).toBe(10);
    expect(r.stopped).toBe(false);
  });

  it('stop at the end of their range', () => {
    const r = stepShot(
      { ...fireShot({ x: 0, y: 0 }, { x: 1, y: 0 }), travelled: 45 },
      1000,
      t,
      open,
    );
    expect(r.shot.pos.x).toBe(5);
    expect(r.stopped).toBe(true);
  });

  it('stop at a wall without entering it', () => {
    const wall = (cx: number): boolean => cx === 2; // x 32–47
    const r = stepShot(fireShot({ x: 10, y: 8 }, { x: 1, y: 0 }), 1000, { ...t, range: 500 }, wall);
    expect(r.stopped).toBe(true);
    expect(r.shot.pos.x).toBeLessThan(32);
    expect(r.shot.travelled).toBeCloseTo(r.shot.pos.x - 10);
  });

  it('fired from inside a wall, fly out of it, then stop at the next wall', () => {
    // Walls at x 0–15 (where it starts) and x 64–79.
    const walls = (cx: number): boolean => cx === 0 || cx === 4;
    const r = stepShot(fireShot({ x: 8, y: 8 }, { x: 1, y: 0 }), 1000, { ...t, range: 500 }, walls);
    expect(r.stopped).toBe(true);
    expect(r.shot.clear).toBe(true);
    expect(r.shot.pos.x).toBeGreaterThan(16);
    expect(r.shot.pos.x).toBeLessThan(64);
  });

  it('still inside the wall it started in, it keeps flying', () => {
    const wall = (cx: number): boolean => cx === 0;
    const r = stepShot(fireShot({ x: 2, y: 8 }, { x: 1, y: 0 }), 50, t, wall); // 5 px: still in the wall
    expect(r.stopped).toBe(false);
    expect(r.shot.clear).toBe(false);
    expect(r.shot.pos.x).toBe(7);
  });

  it('have a square hit box round their middle', () => {
    expect(shotBox(fireShot({ x: 20, y: 30 }, { x: 1, y: 0 }), t)).toEqual({
      x: 17,
      y: 27,
      w: 6,
      h: 6,
    });
  });

  it('copy their start and direction', () => {
    const from = { x: 1, y: 2 };
    const dir = { x: 0, y: 1 };
    const s = fireShot(from, dir);
    from.x = 99;
    dir.y = -1;
    expect(s).toEqual({
      kind: 'orb',
      pos: { x: 1, y: 2 },
      dir: { x: 0, y: 1 },
      travelled: 0,
      clear: false,
    });
  });
});

describe('kinds of enemy shot', () => {
  it('an orb unless said otherwise; venom and spores keep their kind', () => {
    expect(fireShot({ x: 0, y: 0 }, { x: 1, y: 0 }).kind).toBe('orb');
    expect(fireShot({ x: 0, y: 0 }, { x: 1, y: 0 }, 'venom').kind).toBe('venom');
    expect(fireShot({ x: 0, y: 0 }, { x: 1, y: 0 }, 'spore').kind).toBe('spore');
  });
});
