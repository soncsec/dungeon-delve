/**
 * The title screen's menu (engine-free, unit tested): CONTINUE (only when
 * there is a save), NEW GAME and CONTROLS. Starting a new game over a save
 * asks first, with NO chosen until the player moves to YES. CONTROLS shows the
 * controls until any choice or back.
 */
export type TitleOption = 'continue' | 'new' | 'controls';
export type ConfirmOption = 'no' | 'yes';
export type TitleInput = 'up' | 'down' | 'choose' | 'back';

export interface TitleState {
  screen: 'menu' | 'confirm' | 'controls';
  cursor: number;
}

export const TITLE_START: TitleState = { screen: 'menu', cursor: 0 };

export function titleOptions(hasSave: boolean): TitleOption[] {
  return hasSave ? ['continue', 'new', 'controls'] : ['new', 'controls'];
}

export const CONFIRM_OPTIONS: readonly ConfirmOption[] = ['no', 'yes'];

/** One input: the new state, and what to start (null: nothing yet). */
export function titleStep(
  s: TitleState,
  input: TitleInput,
  hasSave: boolean,
): { state: TitleState; start: Exclude<TitleOption, 'controls'> | null } {
  const options = titleOptions(hasSave);
  if (s.screen === 'controls') {
    // Any choice, or back, returns to the menu, on CONTROLS.
    if (input === 'choose' || input === 'back') {
      return { state: { screen: 'menu', cursor: options.indexOf('controls') }, start: null };
    }
    return { state: s, start: null };
  }
  const count = s.screen === 'menu' ? options.length : CONFIRM_OPTIONS.length;
  if (input === 'up' || input === 'down') {
    const by = input === 'up' ? -1 : 1;
    return { state: { ...s, cursor: (s.cursor + by + count) % count }, start: null };
  }
  if (s.screen === 'confirm') {
    if (input === 'back' || CONFIRM_OPTIONS[s.cursor] === 'no') {
      // Back to the menu, on NEW GAME.
      return { state: { screen: 'menu', cursor: options.indexOf('new') }, start: null };
    }
    return { state: s, start: 'new' };
  }
  if (input === 'back') return { state: s, start: null };
  const option = options[s.cursor] ?? 'new';
  if (option === 'controls') return { state: { screen: 'controls', cursor: 0 }, start: null };
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
