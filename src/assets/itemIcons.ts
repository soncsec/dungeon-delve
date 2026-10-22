import type { ItemId } from '../logic/inventory';

/** Item art where the pack has it (no shield art exists, so shields show by name only). */
export const ITEM_ICON: Partial<Record<ItemId, { texture: string; frame: number; tint?: number }>> =
  {
    'wooden-sword': { texture: 'sword-icon', frame: 0 },
    // The pack has no other sword small enough: the same one, in cold steel-blue (runtime tint).
    'steel-sword': { texture: 'sword-icon', frame: 0, tint: 0x9fc8ff },
    // And the Star Blade, in starlit gold.
    'star-blade': { texture: 'sword-icon', frame: 0, tint: 0xfff0a0 },
    daggers: { texture: 'dagger', frame: 0 },
    // The same dagger, in gold (runtime tint).
    'triple-daggers': { texture: 'dagger', frame: 0, tint: 0xffd070 },
    fireball: { texture: 'fire-ball', frame: 0 },
    lightning: { texture: 'bolt', frame: 0 },
    ward: { texture: 'ward', frame: 0 },
  };
