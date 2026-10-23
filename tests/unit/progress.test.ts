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
  canEnter,
  chestHeartId,
  dungeonNumber,
  leftInChest,
  takenId,
  enemyId,
  markDefeated,
  shardsToEnter,
  VAULT_NUMBER,
  heartContainers,
  manaCrystals,
  CRYSTAL_MESSAGE,
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

describe('shards as keys', () => {
  it('dungeon n needs n−1 shards; other maps none', () => {
    expect(shardsToEnter('dungeon1')).toBe(0);
    expect(shardsToEnter('dungeon2')).toBe(1);
    expect(shardsToEnter('dungeon8')).toBe(7);
    expect(shardsToEnter('overworld')).toBe(0);
    expect(shardsToEnter('caves')).toBe(0);
    expect(shardsToEnter('dungeon0')).toBe(0);
    // The Shadow Vault, the ninth: every shard.
    expect(shardsToEnter('vault')).toBe(8);
  });

  it('reads a dungeon map’s number', () => {
    expect(dungeonNumber('dungeon2')).toBe(2);
    expect(dungeonNumber('dungeon12')).toBe(12);
    expect(dungeonNumber('overworld')).toBeNull();
    expect(dungeonNumber('caves')).toBeNull();
    expect(dungeonNumber('vault')).toBe(VAULT_NUMBER);
    expect(VAULT_NUMBER).toBe(9);
  });

  it('lets Jarrett in with enough shards', () => {
    const one = takeReward(NEW_PROGRESS, rewardId('dungeon1', 'shard'));
    expect(canEnter(NEW_PROGRESS, 'dungeon1')).toBe(true);
    expect(canEnter(NEW_PROGRESS, 'dungeon2')).toBe(false);
    expect(canEnter(one, 'dungeon2')).toBe(true);
    expect(canEnter(one, 'dungeon3')).toBe(false);
  });
});

describe('defeated dungeon enemies', () => {
  it('are recorded by map, room and place, once, and count as nothing else', () => {
    const id = enemyId('dungeon1', '1,2', 1);
    expect(id).toBe('dungeon1/1,2/enemy1');
    const p = markDefeated(NEW_PROGRESS, id);
    expect(isOpened(p, id)).toBe(true);
    expect(markDefeated(p, id)).toBe(p);
    expect(shardsHeld(p) + heartContainers(p)).toBe(0);
  });
});

describe('a prize left in an opened chest', () => {
  const id = fixtureId('dungeon1', '0,2', 3, 3);
  const heart = chestHeartId('caves', '4,0');
  const crystal = rewardId('dungeon2', 'crystal');
  const rewards = { heart, crystal };
  const opened = openChest(NEW_PROGRESS, id);

  it('nothing waits in a chest not yet opened', () => {
    expect(leftInChest({ kind: 'key' }, NEW_PROGRESS, id, rewards, [])).toBe(false);
  });

  it('an item waits until he owns it', () => {
    const daggers = { kind: 'item', item: 'daggers' } as const;
    expect(leftInChest(daggers, opened, id, rewards, [])).toBe(true);
    expect(leftInChest(daggers, opened, id, rewards, ['daggers'])).toBe(false);
  });

  it('a key waits until it has been picked up', () => {
    expect(takenId(id)).toBe('dungeon1/0,2/3,3/taken');
    expect(leftInChest({ kind: 'key' }, opened, id, rewards, [])).toBe(true);
    expect(leftInChest({ kind: 'key' }, openChest(opened, takenId(id)), id, rewards, [])).toBe(
      false,
    );
  });

  it('a heart container waits until taken', () => {
    expect(heart).toBe('caves/4,0/heart');
    expect(leftInChest({ kind: 'heart' }, opened, id, rewards, [])).toBe(true);
    expect(leftInChest({ kind: 'heart' }, takeReward(opened, heart), id, rewards, [])).toBe(false);
  });

  it('a Mana Crystal waits until taken', () => {
    expect(leftInChest({ kind: 'crystal' }, opened, id, rewards, [])).toBe(true);
    expect(leftInChest({ kind: 'crystal' }, takeReward(opened, crystal), id, rewards, [])).toBe(
      false,
    );
  });

  it('gems and potions do not come back', () => {
    expect(leftInChest({ kind: 'gems', amount: 5 }, opened, id, rewards, [])).toBe(false);
    expect(leftInChest({ kind: 'potion', potion: 'mana' }, opened, id, rewards, [])).toBe(false);
  });
});

describe('Mana Crystals', () => {
  it('are counted from the rewards taken, and announced', () => {
    expect(manaCrystals(NEW_PROGRESS)).toBe(0);
    expect(manaCrystals(takeReward(NEW_PROGRESS, rewardId('dungeon2', 'crystal')))).toBe(1);
    expect(CRYSTAL_MESSAGE[0]).toBe('A MANA CRYSTAL!');
  });
});
