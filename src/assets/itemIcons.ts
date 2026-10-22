import type { ItemId } from '../logic/inventory';

/** Item art where the pack has it (no shield art exists, so shields show by name only). */
export const ITEM_ICON: Partial<Record<ItemId, { texture: string; frame: number }>> = {
  'wooden-sword': { texture: 'sword-icon', frame: 0 },
  daggers: { texture: 'dagger', frame: 0 },
  fireball: { texture: 'fire-ball', frame: 0 },
  lightning: { texture: 'bolt', frame: 0 },
  ward: { texture: 'ward', frame: 0 },
};
