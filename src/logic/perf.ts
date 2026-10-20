/**
 * Frame-time summaries for the automated frame-rate check (M2.9; from Star Destroyer). Plain
 * TypeScript, no Phaser (ADR-006).
 *
 * Headless test browsers on a shared machine can't promise a steady 60 frames
 * a second, so the check looks at how long the game takes to do each frame's
 * work (update and render) instead: at 60 fps every frame must fit in
 * 1000/60 ≈ 16.7 ms.
 */

export interface FrameSummary {
  frames: number;
  medianMs: number;
  /** 95% of frames took this long or less. */
  p95Ms: number;
  maxMs: number;
}

/** The value below which `share` (0–1) of the sorted samples fall (nearest rank). */
function percentile(sorted: readonly number[], share: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));
  return sorted[i] as number;
}

/** Summarises frame work times in milliseconds. */
export function summariseFrames(ms: readonly number[]): FrameSummary {
  if (ms.length === 0) throw new RangeError('no frames to summarise');
  if (ms.some((m) => !Number.isFinite(m) || m < 0)) throw new RangeError('bad frame time');
  const sorted = [...ms].sort((a, b) => a - b);
  return {
    frames: ms.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] as number,
  };
}

/** Whether a summary fits the budget: limits on the median and 95th percentile, in ms. */
export const withinBudget = (
  s: FrameSummary,
  budget: { medianMs: number; p95Ms: number },
): boolean => s.medianMs <= budget.medianMs && s.p95Ms <= budget.p95Ms;
