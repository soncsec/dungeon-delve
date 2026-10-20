/**
 * Sound effects made in code (M7.3, owner 2026-10-18): no sound files, so no
 * third-party audio and nothing to license. Plain TypeScript, no Phaser
 * (ADR-006).
 *
 * Each sound is a small recipe: a wave shape, a pitch that sweeps from one
 * frequency to another, a volume envelope (a quick rise, then a fade to
 * silence), and optionally a run of notes (for jingles). `renderSound` turns a
 * recipe into raw samples, which the game hands to the browser's audio once.
 */
import { createRng } from './rng';

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

export interface SoundRecipe {
  wave: Wave;
  /** Length in seconds. */
  seconds: number;
  /** Pitch at the start and the end, in Hz; it sweeps smoothly between them. */
  from: number;
  to: number;
  /** Seconds to rise to full volume; after that it fades to silence by the end. */
  attack: number;
  /** Peak volume, 0–1. */
  volume: number;
  /**
   * Notes played in turn, each for an equal share of the sound, as multiples
   * of the swept pitch (e.g. [1, 1.25, 1.5] is a major arpeggio). Default: one.
   */
  steps?: readonly number[];
}

/** Checks a recipe, so a typo in the tuning fails loudly instead of sounding wrong. */
export function checkRecipe(r: SoundRecipe): void {
  if (!(r.seconds > 0)) throw new RangeError('seconds must be positive');
  if (!(r.from > 0) || !(r.to > 0)) throw new RangeError('pitches must be positive');
  if (!(r.volume > 0 && r.volume <= 1)) throw new RangeError('volume must be in (0, 1]');
  if (!(r.attack >= 0 && r.attack < r.seconds)) throw new RangeError('attack must fit the sound');
  if (r.steps && (r.steps.length === 0 || r.steps.some((s) => !(s > 0))))
    throw new RangeError('steps must be positive multipliers');
}

/** The value of one wave cycle at `phase` (0–1). */
function oscillate(wave: Exclude<Wave, 'noise'>, phase: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'triangle':
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case 'sawtooth':
      return 2 * phase - 1;
  }
}

/**
 * The samples of `recipe` at `sampleRate`. Noise comes from the seeded RNG,
 * so a sound is the same every time. The first and last samples are silent,
 * so it starts and stops without a click.
 */
export function renderSound(recipe: SoundRecipe, sampleRate: number, seed = 1): Float32Array {
  checkRecipe(recipe);
  if (!(sampleRate > 0)) throw new RangeError('sampleRate must be positive');
  const n = Math.max(2, Math.round(recipe.seconds * sampleRate));
  const out = new Float32Array(n);
  const steps = recipe.steps ?? [1];
  const rng = createRng(seed);
  const attack = recipe.attack * sampleRate;
  let phase = 0;
  let held = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Exponential sweep: equal musical steps per unit time.
    const swept = recipe.from * (recipe.to / recipe.from) ** t;
    const step = steps[Math.min(steps.length - 1, Math.floor(t * steps.length))] as number;
    const freq = swept * step;
    const before = phase;
    phase = (phase + freq / sampleRate) % 1;
    let v: number;
    if (recipe.wave === 'noise') {
      // A new random level each cycle: higher pitch, finer hiss.
      if (i === 0 || phase < before) held = rng.next() * 2 - 1;
      v = held;
    } else {
      v = oscillate(recipe.wave, phase);
    }
    // Rise over the attack, then fade (quadratic) to silence at the end.
    const env = i < attack ? i / attack : ((n - 1 - i) / Math.max(1, n - 1 - attack)) ** 2;
    out[i] = v * env * recipe.volume;
  }
  out[0] = 0;
  out[n - 1] = 0;
  return out;
}
