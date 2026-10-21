import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVENTORY,
  ITEMS,
  SLOTS,
  SLOT_NAMES,
  EARNED_BY_DUNGEON,
  cycle,
  give,
  knowsMagic,
  moveCursor,
  ownedIn,
  startingKit,
  takeFound,
  type Inventory,
} from '../../src/logic/inventory';

const kit = (...items: Parameters<typeof give>[1][]): Inventory =>
  items.reduce(give, EMPTY_INVENTORY);

describe('items', () => {
  it('every item belongs to a known slot and has a name', () => {
    for (const item of Object.values(ITEMS)) {
      expect(SLOTS).toContain(item.slot);
      expect(item.name.length).toBeGreaterThan(0);
    }
    for (const slot of SLOTS) expect(SLOT_NAMES[slot].length).toBeGreaterThan(0);
  });
});

describe('give', () => {
  it('adds an item and equips it if its slot was empty', () => {
    const inv = kit('wooden-sword', 'daggers');
    expect(inv.owned).toEqual(['wooden-sword', 'daggers']);
    expect(inv.equipped).toEqual({
      near: 'wooden-sword',
      far: 'daggers',
      spell: null,
      shield: null,
    });
  });

  it('keeps what is equipped when a second item for the slot turns up', () => {
    const inv = kit('wooden-sword', 'steel-sword');
    expect(inv.equipped.near).toBe('wooden-sword');
    expect(ownedIn(inv, 'near')).toEqual(['wooden-sword', 'steel-sword']);
  });

  it('finding an item twice changes nothing', () => {
    const inv = kit('fireball');
    expect(give(inv, 'fireball')).toBe(inv);
  });
});

describe('cycle', () => {
  it('equips the next item for the slot, wrapping round', () => {
    let inv = kit('wooden-sword', 'steel-sword', 'axe');
    inv = cycle(inv, 'near');
    expect(inv.equipped.near).toBe('steel-sword');
    inv = cycle(cycle(inv, 'near'), 'near');
    expect(inv.equipped.near).toBe('wooden-sword');
  });

  it('does nothing with one item or none', () => {
    const one = kit('daggers');
    expect(cycle(one, 'far')).toBe(one);
    expect(cycle(one, 'spell')).toBe(one);
  });

  it('starts from the first item if nothing is equipped', () => {
    const inv: Inventory = {
      owned: ['ward', 'lightning'],
      equipped: { ...EMPTY_INVENTORY.equipped },
    };
    expect(cycle(inv, 'spell').equipped.spell).toBe('ward');
  });
});

describe('moveCursor', () => {
  it('moves through the four slots and wraps round', () => {
    expect(moveCursor(0, 1)).toBe(1);
    expect(moveCursor(3, 1)).toBe(0);
    expect(moveCursor(0, -1)).toBe(3);
  });
});

describe('moveCursor over another list', () => {
  it('wraps round any number of rows (the shop has three)', () => {
    expect(moveCursor(2, 1, 3)).toBe(0);
    expect(moveCursor(0, -1, 3)).toBe(2);
  });
});

describe('startingKit', () => {
  it('a new game starts with nothing: Walker hands over the sword and shield', () => {
    expect(startingKit(null)).toEqual([]);
  });

  it('a ?dungeon=n run has the sword, the shield, and what the dungeons before n earn', () => {
    expect(startingKit(1)).toEqual(['wooden-sword', 'wooden-shield']);
    expect(startingKit(2)).toEqual(['wooden-sword', 'wooden-shield', 'daggers', 'fireball']);
    expect(startingKit(3)).toEqual(['wooden-sword', 'wooden-shield', 'daggers', 'fireball']);
  });

  it('the Fireball comes from Walker after dungeon 1, with its daggers', () => {
    expect(EARNED_BY_DUNGEON[1]).toEqual(['daggers', 'fireball']);
    expect(startingKit(null)).not.toContain('fireball');
    expect(startingKit(1)).not.toContain('fireball');
  });
});

describe('knowsMagic', () => {
  it('is true once he has a spell, whatever else he holds', () => {
    expect(knowsMagic(EMPTY_INVENTORY)).toBe(false);
    expect(knowsMagic(kit('wooden-sword', 'daggers', 'wooden-shield'))).toBe(false);
    expect(knowsMagic(kit('wooden-sword', 'fireball'))).toBe(true);
  });
});

describe('takeFound', () => {
  it('an item found in a chest goes straight into his hand, even over another', () => {
    const inv = takeFound(kit('wooden-sword', 'fireball'), 'lightning');
    expect(inv.owned).toEqual(['wooden-sword', 'fireball', 'lightning']);
    expect(inv.equipped.spell).toBe('lightning');
    expect(inv.equipped.near).toBe('wooden-sword');
  });

  it('finding one he already owns just takes it in hand', () => {
    const inv = takeFound(kit('fireball', 'lightning'), 'fireball');
    expect(inv.owned).toEqual(['fireball', 'lightning']);
    expect(inv.equipped.spell).toBe('fireball');
  });
});
