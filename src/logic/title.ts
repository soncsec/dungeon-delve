/**
 * The title screen's menu (engine-free, unit tested): CONTINUE (only when
 * there is a save) and NEW GAME. Starting a new game over a save asks first,
 * with NO chosen until the player moves to YES.
 */
export type TitleOption = 'continue' | 'new';
export type ConfirmOption = 'no' | 'yes';
export type TitleInput = 'up' | 'down' | 'choose' | 'back';

export interface TitleState {
  screen: 'menu' | 'confirm';
  cursor: number;
}

export const TITLE_START: TitleState = { screen: 'menu', cursor: 0 };

export function titleOptions(hasSave: boolean): TitleOption[] {
  return hasSave ? ['continue', 'new'] : ['new'];
}

export const CONFIRM_OPTIONS: readonly ConfirmOption[] = ['no', 'yes'];

/** One input: the new state, and what to start (null: nothing yet). */
export function titleStep(
  s: TitleState,
  input: TitleInput,
  hasSave: boolean,
): { state: TitleState; start: TitleOption | null } {
  const count = s.screen === 'menu' ? titleOptions(hasSave).length : CONFIRM_OPTIONS.length;
  if (input === 'up' || input === 'down') {
    const by = input === 'up' ? -1 : 1;
    return { state: { ...s, cursor: (s.cursor + by + count) % count }, start: null };
  }
  if (s.screen === 'confirm') {
    if (input === 'back' || CONFIRM_OPTIONS[s.cursor] === 'no') {
      // Back to the menu, on NEW GAME.
      return { state: { screen: 'menu', cursor: 1 }, start: null };
    }
    return { state: s, start: 'new' };
  }
  if (input === 'back') return { state: s, start: null };
  const option = titleOptions(hasSave)[s.cursor] ?? 'new';
  if (option === 'new' && hasSave) return { state: { screen: 'confirm', cursor: 0 }, start: null };
  return { state: s, start: option };
}

/** Play time as H:MM:SS. */
export function formatPlayTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
