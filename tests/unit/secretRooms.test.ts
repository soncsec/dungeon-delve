import { describe, expect, it } from 'vitest';
import { parseRoom, edgeOpenings } from '../../src/logic/room';
import { secretRoom, withSecretDoor } from '../../src/world/secretRooms';

const openOn = (lines: readonly string[], side: 'north' | 'south' | 'east' | 'west') =>
  edgeOpenings(parseRoom(lines), side)
    .map((open, i) => (open ? i : null))
    .filter((i) => i !== null);

describe('secretRoom', () => {
  it('is walled all round but for a two-cell doorway on the side asked', () => {
    const west = secretRoom(2, 1, 'west', []);
    expect(west).toMatchObject({ col: 2, row: 1, chests: [] });
    expect(openOn(west.lines, 'west')).toEqual([4, 5]);
    expect(openOn(west.lines, 'east')).toEqual([]);
    expect(openOn(west.lines, 'north')).toEqual([]);
    expect(openOn(secretRoom(0, 0, 'east', []).lines, 'east')).toEqual([4, 5]);
    expect(openOn(secretRoom(0, 0, 'north', []).lines, 'north')).toEqual([9, 10]);
    expect(openOn(secretRoom(0, 0, 'south', []).lines, 'south')).toEqual([9, 10]);
  });

  it('puts its chests where asked', () => {
    const chests = [{ col: 13, row: 4, contents: { kind: 'heart' as const } }];
    const r = secretRoom(2, 1, 'west', chests);
    expect(r.chests).toEqual(chests);
    expect(r.lines[4]?.[13]).toBe('C');
  });
});

describe('withSecretDoor', () => {
  const plain = Array.from({ length: 10 }, () => '##................##');

  it('cuts the secret doorway in rows 4 and 5 of the side wall, both cells', () => {
    const east = withSecretDoor(plain, 'east');
    expect(east[4]).toBe('##................uu');
    expect(east[5]).toBe('##................uu');
    expect(east[3]).toBe(plain[3]);
    expect(withSecretDoor(plain, 'west')[5]).toBe('uu................##');
  });

  it('refuses where there is no solid wall to hide it in', () => {
    const gap = plain.map((l, y) => (y === 4 ? '##..................' : l));
    expect(() => withSecretDoor(gap, 'east')).toThrow(/needs solid wall/);
  });
});
