import { describe, expect, it } from 'vitest';
import { EMPTY_INVENTORY, give } from '../../src/logic/inventory';
import { SHOP_ITEMS, SHOP_NAMES, buy, refusal, type Purse } from '../../src/logic/shop';

const PRICES = { 'health-potion': 10, 'mana-brew': 15, 'iron-shield': 80 } as const;
const MAX = 3;
const purse = (gems: number, health = 0, mana = 0): Purse => ({
  gems,
  potions: { health, mana },
  inventory: give(EMPTY_INVENTORY, 'wooden-shield'),
});

describe('the shop', () => {
  it('lists potions and the Iron Shield, with names', () => {
    expect(SHOP_ITEMS).toEqual(['health-potion', 'mana-brew', 'iron-shield']);
    expect(SHOP_ITEMS.map((i) => SHOP_NAMES[i])).toEqual([
      'Health Potion',
      'Mana Brew',
      'Iron Shield',
    ]);
  });

  it('sells potions for gems', () => {
    const health = buy(purse(25), 'health-potion', PRICES, MAX);
    expect(health).toEqual({ ok: true, purse: { ...purse(15), potions: { health: 1, mana: 0 } } });
    const mana = buy(purse(15, 0, 2), 'mana-brew', PRICES, MAX);
    expect(mana).toEqual({ ok: true, purse: { ...purse(0), potions: { health: 0, mana: 3 } } });
  });

  it('sells the Iron Shield and equips it at once', () => {
    const r = buy(purse(100), 'iron-shield', PRICES, MAX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.purse.gems).toBe(20);
    expect(r.purse.inventory.owned).toEqual(['wooden-shield', 'iron-shield']);
    expect(r.purse.inventory.equipped.shield).toBe('iron-shield');
  });

  it('refuses without enough gems, with a full bag, or a shield already owned', () => {
    expect(buy(purse(9), 'health-potion', PRICES, MAX)).toEqual({ ok: false, reason: 'gems' });
    expect(buy(purse(79), 'iron-shield', PRICES, MAX)).toEqual({ ok: false, reason: 'gems' });
    expect(buy(purse(99, 3), 'health-potion', PRICES, MAX)).toEqual({ ok: false, reason: 'full' });
    expect(buy(purse(99, 0, 3), 'mana-brew', PRICES, MAX)).toEqual({ ok: false, reason: 'full' });
    const owner = { ...purse(200), inventory: give(purse(0).inventory, 'iron-shield') };
    expect(buy(owner, 'iron-shield', PRICES, MAX)).toEqual({ ok: false, reason: 'owned' });
    // A full bag or an owned shield is said first, even when gems are short too.
    expect(refusal(purse(0, 3), 'health-potion', PRICES, MAX)).toBe('full');
    expect(refusal(purse(10), 'health-potion', PRICES, MAX)).toBeNull();
  });
});
