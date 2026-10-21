/**
 * The village shop (engine-free, unit tested; owner 2026-10-21): potions and
 * the Iron Shield, for gems. A purchase fails, and changes nothing, when the
 * bag is full, the shield is already owned, or there aren't enough gems.
 */
import { give, type Inventory } from './inventory';
import { addPotion, type Potions } from './potions';

export type ShopItem = 'health-potion' | 'mana-brew' | 'iron-shield';

/** What's on sale, in the order shown. */
export const SHOP_ITEMS: readonly ShopItem[] = ['health-potion', 'mana-brew', 'iron-shield'];

export const SHOP_NAMES: Readonly<Record<ShopItem, string>> = {
  'health-potion': 'Health Potion',
  'mana-brew': 'Mana Brew',
  'iron-shield': 'Iron Shield',
};

export interface Purse {
  gems: number;
  potions: Potions;
  inventory: Inventory;
}

export type Refusal = 'gems' | 'full' | 'owned';

export type Purchase = { ok: true; purse: Purse } | { ok: false; reason: Refusal };

/** Why an item can't be bought right now (null: it can). */
export function refusal(
  purse: Purse,
  item: ShopItem,
  prices: Readonly<Record<ShopItem, number>>,
  maxPotions: number,
): Refusal | null {
  if (item === 'iron-shield' && purse.inventory.owned.includes('iron-shield')) return 'owned';
  if (item === 'health-potion' && purse.potions.health >= maxPotions) return 'full';
  if (item === 'mana-brew' && purse.potions.mana >= maxPotions) return 'full';
  if (purse.gems < prices[item]) return 'gems';
  return null;
}

/** Buys an item: pays for it and puts it in the bag. The Iron Shield is equipped at once. */
export function buy(
  purse: Purse,
  item: ShopItem,
  prices: Readonly<Record<ShopItem, number>>,
  maxPotions: number,
): Purchase {
  const no = refusal(purse, item, prices, maxPotions);
  if (no) return { ok: false, reason: no };
  const gems = purse.gems - prices[item];
  if (item === 'iron-shield') {
    const owned = give(purse.inventory, 'iron-shield');
    const inventory = { ...owned, equipped: { ...owned.equipped, shield: 'iron-shield' as const } };
    return { ok: true, purse: { ...purse, gems, inventory } };
  }
  const kind = item === 'health-potion' ? 'health' : 'mana';
  // The full bag was checked above, so the potion always fits.
  const potions = addPotion(purse.potions, kind, maxPotions).potions;
  return { ok: true, purse: { ...purse, gems, potions } };
}
