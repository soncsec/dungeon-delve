import { describe, expect, it } from 'vitest';
import {
  NEW_PROGRESS,
  addKey,
  fixtureId,
  isOpened,
  keysIn,
  openChest,
  unlockDoor,
  beatBoss,
  bossId,
} from '../../src/logic/progress';

const door = fixtureId('dungeon1', '0,0', 9, 1);
const chest = fixtureId('dungeon1', '1,0', 4, 4);

describe('progress', () => {
  it('names a fixture by map, room and cell', () => {
    expect(door).toBe('dungeon1/0,0/9,1');
  });

  it('counts keys per dungeon', () => {
    const p = addKey(addKey(NEW_PROGRESS, 'dungeon1'), 'dungeon2');
    expect(keysIn(p, 'dungeon1')).toBe(1);
    expect(keysIn(p, 'dungeon2')).toBe(1);
    expect(keysIn(p, 'dungeon3')).toBe(0);
  });

  it('a key opens a locked door for good, and is used up', () => {
    const r = unlockDoor(addKey(NEW_PROGRESS, 'dungeon1'), 'dungeon1', door);
    expect(r.unlocked).toBe(true);
    expect(isOpened(r.progress, door)).toBe(true);
    expect(keysIn(r.progress, 'dungeon1')).toBe(0);
    // An opened door stays open without another key.
    expect(unlockDoor(r.progress, 'dungeon1', door)).toEqual({
      progress: r.progress,
      unlocked: true,
    });
  });

  it('without a key from this dungeon, the door stays locked', () => {
    const p = addKey(NEW_PROGRESS, 'dungeon2');
    expect(unlockDoor(p, 'dungeon1', door)).toEqual({ progress: p, unlocked: false });
  });

  it('a chest opens once', () => {
    const p = openChest(NEW_PROGRESS, chest);
    expect(isOpened(p, chest)).toBe(true);
    expect(openChest(p, chest)).toBe(p);
  });
});

describe('bosses', () => {
  it('records a beaten boss once, by map and room', () => {
    const id = bossId('dungeon1', '1,0');
    expect(id).toBe('dungeon1/1,0/boss');
    const p = beatBoss(NEW_PROGRESS, id);
    expect(isOpened(p, id)).toBe(true);
    expect(beatBoss(p, id)).toBe(p);
  });
});
