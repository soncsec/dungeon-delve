import { describe, expect, it } from 'vitest';
import { parseRoom } from '../../src/logic/room';
import {
  NO_WARD,
  isBreaking,
  isWarded,
  raiseWard,
  sparksIn,
  sparksLetThrough,
  standsInSparks,
} from '../../src/logic/ward';

const OPEN = '##................##';
const WALL = '####################';
/** A dungeon room with the given rows replaced. */
const room = (rows: Record<number, string>): string[] =>
  Array.from({ length: 10 }, (_, y) => rows[y] ?? (y < 2 || y > 7 ? WALL : OPEN));

describe('the Ward', () => {
  it('is down until cast', () => {
    expect(isWarded(NO_WARD, 0)).toBe(false);
    expect(isWarded(NO_WARD, 5000)).toBe(false);
  });

  it('is up for its time once cast, then drops', () => {
    const w = raiseWard(1000, 3000);
    expect(isWarded(w, 1000)).toBe(true);
    expect(isWarded(w, 3999)).toBe(true);
    expect(isWarded(w, 4000)).toBe(false);
  });

  it('breaks up in its last moments, still protecting him', () => {
    const w = raiseWard(1000, 3000);
    expect(isBreaking(w, 3599, 400)).toBe(false);
    expect(isBreaking(w, 3600, 400)).toBe(true);
    expect(isWarded(w, 3600)).toBe(true);
    expect(isBreaking(w, 4000, 400)).toBe(false);
    expect(isBreaking(NO_WARD, 0, 400)).toBe(false);
  });
});

describe('spark barriers', () => {
  it('let him through inside the Ward, or out again if it drops while he is in one', () => {
    expect(sparksLetThrough(true, false)).toBe(true);
    expect(sparksLetThrough(false, true)).toBe(true);
    expect(sparksLetThrough(true, true)).toBe(true);
    expect(sparksLetThrough(false, false)).toBe(false);
  });

  it('crackle across a gap in a wall that runs across', () => {
    const r = parseRoom(room({ 0: '#########..#########', 1: '#########ee#########' }));
    expect(sparksIn(r)).toEqual([
      { x: 9, y: 1, axis: 'across' },
      { x: 10, y: 1, axis: 'across' },
    ]);
  });

  it('crackle down a gap in an upright wall', () => {
    const r = parseRoom(room({ 4: '.e................##', 5: '.e................##' }));
    expect(sparksIn(r)).toEqual([
      { x: 1, y: 4, axis: 'down' },
      { x: 1, y: 5, axis: 'down' },
    ]);
  });

  it('crackle down a closet mouth in an upright wall, and across one on its own', () => {
    const r = parseRoom(
      room({
        3: '##..........#####.##',
        4: '##..........#...#.##',
        5: '##..........e...#.##',
        6: '##..........#####.##',
        7: '##.......e........##',
      }),
    );
    expect(sparksIn(r)).toEqual([
      { x: 12, y: 5, axis: 'down' },
      { x: 9, y: 7, axis: 'across' },
    ]);
  });

  it('at the edge of the room, the world beyond counts as wall', () => {
    const r = parseRoom(room({ 0: 'e###################', 1: '.###################' }));
    expect(sparksIn(r)).toEqual([{ x: 0, y: 0, axis: 'across' }]);
  });
});

describe('standing in a spark barrier', () => {
  // A barrier at cells (9,5) and (10,5).
  const r = parseRoom(room({ 5: '#########ee#########' }));
  const box = { halfWidth: 5, height: 6 };

  it('is true when any cell under his feet box is a barrier', () => {
    expect(standsInSparks(r, { x: 152, y: 90 }, box)).toBe(true); // feet in (9,5)
    expect(standsInSparks(r, { x: 160, y: 98 }, box)).toBe(true); // box reaches up into row 5
    expect(standsInSparks(r, { x: 140, y: 90 }, box)).toBe(true); // box reaches right into (9,5)
  });

  it('is false when his feet box is flush against it, or clear of it', () => {
    expect(standsInSparks(r, { x: 160, y: 102 }, box)).toBe(false); // box top on the line below
    expect(standsInSparks(r, { x: 139, y: 90 }, box)).toBe(false); // box right edge on the line
    expect(standsInSparks(r, { x: 100, y: 60 }, box)).toBe(false);
  });

  it('off the room, nothing', () => {
    expect(standsInSparks(r, { x: -40, y: -40 }, box)).toBe(false);
  });
});
