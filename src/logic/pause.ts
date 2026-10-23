/**
 * Pausing, quitting to the arcade, and the controls legend (ROADMAP M8.3).
 * Engine-free and unit tested. The keys follow Star Destroyer's, so the
 * arcade's games feel alike:
 *
 *   P / Esc  pause, or resume (on the quit question, Esc and P mean "no")
 *   Q        ask "QUIT TO ARCADE?"; Y quits, N goes back to the pause
 *
 * On a phone the pause screen's lines are buttons instead.
 */

export type PauseScreen = 'paused' | 'confirmQuit';
export type PauseInput = 'resume' | 'quit' | 'yes' | 'no';

/** One step of the pause screen: where it goes, and whether the game resumes or quits. */
export function pauseStep(
  screen: PauseScreen,
  input: PauseInput,
): { screen: PauseScreen; resume: boolean; quit: boolean } {
  if (screen === 'paused') {
    if (input === 'resume') return { screen, resume: true, quit: false };
    if (input === 'quit') return { screen: 'confirmQuit', resume: false, quit: false };
    return { screen, resume: false, quit: false };
  }
  if (input === 'yes') return { screen, resume: false, quit: true };
  if (input === 'quit') return { screen, resume: false, quit: false };
  return { screen: 'paused', resume: false, quit: false };
}

/** The controls, two to a line: the keys, or on a phone the buttons. */
export function controlsLegend(touch: boolean): readonly (readonly [string, string])[] {
  if (touch) {
    return [
      ['PAD  WALK', 'HIT  STRIKE'],
      ['SWAP  NEAR/FAR', 'MAGIC  CAST'],
      ['HEAL, MANA  POTIONS', 'BAG  YOUR BAG'],
    ];
  }
  return [
    ['ARROWS/WASD  WALK', 'SPACE  STRIKE'],
    ['X  NEAR/FAR', 'C  CAST'],
    ['1, 2  POTIONS', 'I  YOUR BAG'],
    ['M  SOUND', 'P  PAUSE'],
  ];
}
