import { describe, expect, it } from 'vitest';
import { NO_POTIONS, addPotion, usePotion } from '../../src/logic/potions';

describe('potions', () => {
  it('starts with none', () => {
    expect(NO_POTIONS).toEqual({ health: 0, mana: 0 });
  });

  it('picks up potions up to the most he can carry', () => {
    let p = NO_POTIONS;
    for (let i = 0; i < 3; i++) {
      const r = addPotion(p, 'health', 3);
      expect(r.taken).toBe(true);
      p = r.potions;
    }
    expect(p).toEqual({ health: 3, mana: 0 });
    const full = addPotion(p, 'health', 3);
    expect(full).toEqual({ potions: p, taken: false });
    expect(addPotion(p, 'mana', 3).potions).toEqual({ health: 3, mana: 1 });
  });

  it('uses one if he has one', () => {
    expect(usePotion({ health: 2, mana: 0 }, 'health')).toEqual({
      potions: { health: 1, mana: 0 },
      used: true,
    });
    const none = { health: 2, mana: 0 };
    expect(usePotion(none, 'mana')).toEqual({ potions: none, used: false });
  });
});
