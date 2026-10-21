/**
 * The inventory (engine-free, unit tested): what Jarrett owns, and what is
 * equipped in each of his four slots. The inventory screen moves a cursor
 * over the slots and switches the item in one when he owns more than one.
 */
export type Slot = 'near' | 'far' | 'spell' | 'shield';
export const SLOTS: readonly Slot[] = ['near', 'far', 'spell', 'shield'];

export type ItemId =
  | 'wooden-sword'
  | 'steel-sword'
  | 'star-blade'
  | 'axe'
  | 'daggers'
  | 'fireball'
  | 'lightning'
  | 'ward'
  | 'wooden-shield'
  | 'iron-shield';

/** Every item in the game (PROJECT.md §3b), its slot and its name on screen. */
export const ITEMS: Readonly<Record<ItemId, { slot: Slot; name: string }>> = {
  'wooden-sword': { slot: 'near', name: 'Wooden Sword' },
  'steel-sword': { slot: 'near', name: 'Steel Sword' },
  'star-blade': { slot: 'near', name: 'Star Blade' },
  axe: { slot: 'near', name: 'Axe' },
  daggers: { slot: 'far', name: 'Daggers' },
  fireball: { slot: 'spell', name: 'Fireball' },
  lightning: { slot: 'spell', name: 'Lightning' },
  ward: { slot: 'spell', name: 'Ward' },
  'wooden-shield': { slot: 'shield', name: 'Wooden Shield' },
  'iron-shield': { slot: 'shield', name: 'Iron Shield' },
};

/** The dungeons' prizes that are items so far (PROJECT.md §3c), by dungeon number. */
export const DUNGEON_PRIZES: Readonly<Record<number, ItemId>> = { 1: 'daggers', 2: 'fireball' };

/**
 * What Jarrett holds at the start. A new game: nothing, since Walker hands
 * over the sword and shield in the village. A `?dungeon=n` play-test run
 * skips him: the sword and shield, and the prizes of the dungeons before n.
 */
export function startingKit(dungeon: number | null): ItemId[] {
  if (dungeon === null) return [];
  const before = Object.entries(DUNGEON_PRIZES)
    .filter(([n]) => Number(n) < dungeon)
    .map(([, item]) => item);
  return ['wooden-sword', 'wooden-shield', ...before];
}

export const SLOT_NAMES: Readonly<Record<Slot, string>> = {
  near: 'Near',
  far: 'Far',
  spell: 'Spell',
  shield: 'Shield',
};

export interface Inventory {
  /** In the order he found them. */
  owned: readonly ItemId[];
  equipped: Readonly<Record<Slot, ItemId | null>>;
}

export const EMPTY_INVENTORY: Inventory = {
  owned: [],
  equipped: { near: null, far: null, spell: null, shield: null },
};

/** Adds an item he's found, equipping it if that slot was empty. Finding one twice changes nothing. */
export function give(inv: Inventory, item: ItemId): Inventory {
  if (inv.owned.includes(item)) return inv;
  const slot = ITEMS[item].slot;
  return {
    owned: [...inv.owned, item],
    equipped: inv.equipped[slot] ? inv.equipped : { ...inv.equipped, [slot]: item },
  };
}

/** The items he owns for one slot, in the order found. */
export function ownedIn(inv: Inventory, slot: Slot): ItemId[] {
  return inv.owned.filter((i) => ITEMS[i].slot === slot);
}

/** Equips the next item he owns for a slot (wrapping round); unchanged if he owns one or none. */
export function cycle(inv: Inventory, slot: Slot): Inventory {
  const items = ownedIn(inv, slot);
  if (items.length < 2) return inv;
  const current = inv.equipped[slot];
  const at = current === null ? -1 : items.indexOf(current);
  // The index is always in range: items has at least two entries.
  const next = items[(at + 1) % items.length] as ItemId;
  return { ...inv, equipped: { ...inv.equipped, [slot]: next } };
}

/** Moves the slot cursor up (-1) or down (+1), wrapping round. */
export function moveCursor(index: number, by: -1 | 1, count = SLOTS.length): number {
  return (index + by + count) % count;
}
