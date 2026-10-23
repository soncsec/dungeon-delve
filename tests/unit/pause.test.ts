import { describe, expect, it } from 'vitest';
import { controlsLegend, pauseStep } from '../../src/logic/pause';

describe('the pause screen', () => {
  it('P or Esc resumes; Q asks before quitting; Y and N mean nothing until then', () => {
    expect(pauseStep('paused', 'resume')).toEqual({ screen: 'paused', resume: true, quit: false });
    expect(pauseStep('paused', 'quit')).toEqual({
      screen: 'confirmQuit',
      resume: false,
      quit: false,
    });
    expect(pauseStep('paused', 'yes')).toEqual({ screen: 'paused', resume: false, quit: false });
    expect(pauseStep('paused', 'no')).toEqual({ screen: 'paused', resume: false, quit: false });
  });

  it('asked to quit: Y quits; N, Esc or P goes back to the pause; Q again changes nothing', () => {
    expect(pauseStep('confirmQuit', 'yes')).toEqual({
      screen: 'confirmQuit',
      resume: false,
      quit: true,
    });
    for (const input of ['no', 'resume'] as const) {
      expect(pauseStep('confirmQuit', input)).toEqual({
        screen: 'paused',
        resume: false,
        quit: false,
      });
    }
    expect(pauseStep('confirmQuit', 'quit').screen).toBe('confirmQuit');
  });
});

describe('the controls legend', () => {
  it('names the keys, or on a phone the buttons, and every line fits the screen', () => {
    const keys = controlsLegend(false).flat().join(' ');
    expect(keys).toContain('SPACE');
    expect(keys).toContain('P  PAUSE');
    const touch = controlsLegend(true).flat().join(' ');
    expect(touch).toContain('HIT');
    expect(touch).not.toMatch(/SPACE|WASD/);
    for (const [a, b] of [...controlsLegend(false), ...controlsLegend(true)]) {
      expect(a.length).toBeLessThanOrEqual(19);
      expect(b.length).toBeLessThanOrEqual(19);
    }
  });
});
