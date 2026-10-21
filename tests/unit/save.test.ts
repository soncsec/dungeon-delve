import { describe, expect, it } from 'vitest';
import { EMPTY_INVENTORY, give } from '../../src/logic/inventory';
import { decodeSave, encodeSave, type SaveGame } from '../../src/logic/save';

/**
 * A save as loose JSON data, for tampering: the point of these tests is to write
 * what the SaveGame type forbids.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

const RULES = { maps: ['overworld', 'dungeon1'], maxPotions: 3, maxGems: 999 };

const GOOD: SaveGame = {
  version: 1,
  map: 'dungeon1',
  inventory: (['wooden-sword', 'daggers', 'wooden-shield'] as const).reduce(give, EMPTY_INVENTORY),
  potions: { health: 2, mana: 0 },
  gems: 120,
  progress: { opened: ['dungeon1/1,3/4,3', 'dungeon1/shard'], keys: { dungeon1: 1 } },
  playMs: 654_321,
  cheated: false,
};

/** The good save as plain JSON data, with one change made by `edit`. */
function tampered(edit: (s: Loose) => void): string {
  const s = JSON.parse(encodeSave(GOOD)) as Loose;
  edit(s);
  return JSON.stringify(s);
}

describe('save game', () => {
  it('reads back what it wrote', () => {
    expect(decodeSave(encodeSave(GOOD), RULES)).toEqual(GOOD);
  });

  it('keeps only the fields it knows', () => {
    const extra = tampered((s) => {
      s.name = 'someone';
      s.potions.extra = 5;
    });
    expect(decodeSave(extra, RULES)).toEqual(GOOD);
  });

  it('has nothing to read when there is no save, or it is not JSON', () => {
    expect(decodeSave(null, RULES)).toBeNull();
    expect(decodeSave('', RULES)).toBeNull();
    expect(decodeSave('{not json', RULES)).toBeNull();
    expect(decodeSave('[]', RULES)).toBeNull();
    expect(decodeSave('null', RULES)).toBeNull();
  });

  it.each<[string, (s: Loose) => void]>([
    ['another version', (s) => (s.version = 2)],
    ['an unknown map', (s) => (s.map = 'dungeon9')],
    ['a map that is not text', (s) => (s.map = 3)],
    ['no inventory', (s) => delete s.inventory],
    ['owned items that are not a list', (s) => (s.inventory.owned = 'daggers')],
    ['no equipped slots', (s) => (s.inventory.equipped = null)],
    ['an unknown item', (s) => s.inventory.owned.push('laser')],
    ['an item owned twice', (s) => s.inventory.owned.push('daggers')],
    ['an inherited name as an item', (s) => s.inventory.owned.push('toString')],
    ['an equipped item not owned', (s) => (s.inventory.equipped.spell = 'fireball')],
    ['an item in the wrong slot', (s) => (s.inventory.equipped.near = 'daggers')],
    ['a missing slot', (s) => delete s.inventory.equipped.shield],
    ['no progress', (s) => (s.progress = [])],
    ['opened ids that are not a list', (s) => (s.progress.opened = {})],
    [
      'too many opened ids',
      (s) => (s.progress.opened = Array.from({ length: 2001 }, (_, i) => `x${i}`)),
    ],
    ['an opened id that is not text', (s) => s.progress.opened.push(7)],
    ['a very long opened id', (s) => s.progress.opened.push('x'.repeat(65))],
    ['an opened id twice', (s) => s.progress.opened.push('dungeon1/shard')],
    ['keys that are not a record', (s) => (s.progress.keys = [1])],
    ['keys for an unknown map', (s) => (s.progress.keys.dungeon9 = 1)],
    ['a negative key count', (s) => (s.progress.keys.dungeon1 = -1)],
    ['a fractional key count', (s) => (s.progress.keys.dungeon1 = 0.5)],
    ['too many keys', (s) => (s.progress.keys.dungeon1 = 100)],
    ['no potions', (s) => (s.potions = 2)],
    ['too many health potions', (s) => (s.potions.health = 4)],
    ['a mana count that is not a number', (s) => (s.potions.mana = '1')],
    ['negative gems', (s) => (s.gems = -5)],
    ['too many gems', (s) => (s.gems = 1000)],
    ['play time that is not a whole number', (s) => (s.playMs = 1.5)],
    ['play time over a year', (s) => (s.playMs = 1000 * 60 * 60 * 24 * 366)],
    ['a cheat flag that is not true or false', (s) => (s.cheated = 'no')],
  ])('throws away a save with %s', (_, edit) => {
    expect(decodeSave(tampered(edit), RULES)).toBeNull();
  });

  it('accepts empty slots, no keys, and a cheated run', () => {
    const fresh: SaveGame = {
      ...GOOD,
      map: 'overworld',
      inventory: EMPTY_INVENTORY,
      progress: { opened: [], keys: {} },
      cheated: true,
    };
    expect(decodeSave(encodeSave(fresh), RULES)).toEqual(fresh);
  });
});
