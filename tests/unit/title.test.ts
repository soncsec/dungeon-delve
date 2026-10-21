import { describe, expect, it } from 'vitest';
import {
  TITLE_START,
  formatPlayTime,
  titleOptions,
  titleStep,
  type TitleState,
} from '../../src/logic/title';

describe('title menu', () => {
  it('offers CONTINUE only when there is a save', () => {
    expect(titleOptions(true)).toEqual(['continue', 'new']);
    expect(titleOptions(false)).toEqual(['new']);
  });

  it('without a save, choosing starts a new game at once', () => {
    expect(titleStep(TITLE_START, 'choose', false)).toEqual({ state: TITLE_START, start: 'new' });
    // Up and down have one option to wrap round.
    expect(titleStep(TITLE_START, 'down', false).state.cursor).toBe(0);
  });

  it('with a save, CONTINUE is first, and the cursor wraps', () => {
    expect(titleStep(TITLE_START, 'choose', true).start).toBe('continue');
    const down = titleStep(TITLE_START, 'down', true).state;
    expect(down.cursor).toBe(1);
    expect(titleStep(down, 'down', true).state.cursor).toBe(0);
    expect(titleStep(TITLE_START, 'up', true).state.cursor).toBe(1);
  });

  it('back does nothing on the menu', () => {
    expect(titleStep(TITLE_START, 'back', true)).toEqual({ state: TITLE_START, start: null });
  });

  it('NEW GAME over a save asks first, with NO chosen', () => {
    const onNew: TitleState = { screen: 'menu', cursor: 1 };
    const asked = titleStep(onNew, 'choose', true);
    expect(asked).toEqual({ state: { screen: 'confirm', cursor: 0 }, start: null });
    // NO, or back, returns to the menu on NEW GAME.
    expect(titleStep(asked.state, 'choose', true)).toEqual({ state: onNew, start: null });
    expect(titleStep(asked.state, 'back', true)).toEqual({ state: onNew, start: null });
    // YES starts over.
    const yes = titleStep(asked.state, 'down', true).state;
    expect(yes).toEqual({ screen: 'confirm', cursor: 1 });
    expect(titleStep(yes, 'choose', true).start).toBe('new');
    expect(titleStep(yes, 'back', true)).toEqual({ state: onNew, start: null });
  });

  it('a cursor past the end counts as NEW GAME', () => {
    expect(titleStep({ screen: 'menu', cursor: 5 }, 'choose', false).start).toBe('new');
  });
});

describe('formatPlayTime', () => {
  it('shows hours, minutes and seconds', () => {
    expect(formatPlayTime(0)).toBe('0:00:00');
    expect(formatPlayTime(654_999)).toBe('0:10:54');
    expect(formatPlayTime(3_600_000 * 12 + 61_000)).toBe('12:01:01');
    expect(formatPlayTime(-5)).toBe('0:00:00');
  });
});
