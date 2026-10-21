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
  heartContainers,
  markSeen,
  seenId,
  rewardId,
  shardMessage,
  shardsHeld,
  takeReward,
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

describe('rewards', () => {
  it('counts shards and heart containers taken, each once per map', () => {
    let p = takeReward(NEW_PROGRESS, rewardId('dungeon1', 'shard'));
    p = takeReward(p, rewardId('dungeon1', 'heart'));
    p = takeReward(p, rewardId('dungeon2', 'shard'));
    expect(takeReward(p, rewardId('dungeon2', 'shard'))).toBe(p);
    expect(rewardId('dungeon1', 'shard')).toBe('dungeon1/shard');
    expect(shardsHeld(p)).toBe(2);
    expect(heartContainers(p)).toBe(1);
    // Doors, chests and bosses don't count.
    p = openChest(p, fixtureId('dungeon1', '1,0', 3, 4));
    p = beatBoss(p, bossId('dungeon1', '1,0'));
    expect(shardsHeld(p)).toBe(2);
    expect(heartContainers(p)).toBe(1);
  });

  it('says how many shards are left to find', () => {
    expect(shardMessage(1, 8)).toEqual(['A SHARD OF THE', 'STAR OF POWER!', '', '7 MORE TO FIND.']);
    expect(shardMessage(7, 8).at(-1)).toBe('1 MORE TO FIND.');
    expect(shardMessage(8, 8)).toEqual(['THE STAR OF POWER', 'IS WHOLE!']);
  });
});

describe('seen rooms', () => {
  it('records a room once, and it is not a shard or heart', () => {
    const id = seenId('dungeon1', '1,2');
    expect(id).toBe('dungeon1/1,2/seen');
    const p = markSeen(NEW_PROGRESS, id);
    expect(isOpened(p, id)).toBe(true);
    expect(markSeen(p, id)).toBe(p);
    expect(shardsHeld(p)).toBe(0);
    expect(heartContainers(p)).toBe(0);
  });
});
