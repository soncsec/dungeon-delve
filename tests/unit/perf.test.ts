import { describe, expect, it } from 'vitest';
import { FRAME_BUDGET } from '../../src/config/tuning';
import { summariseFrames, withinBudget } from '../../src/logic/perf';

describe('frame-time summaries (M2.9)', () => {
  it('finds the median, 95th percentile and slowest frame', () => {
    const ms = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100, reversed below
    ms.reverse();
    expect(summariseFrames(ms)).toEqual({ frames: 100, medianMs: 50, p95Ms: 95, maxMs: 100 });
    expect(summariseFrames([7])).toEqual({ frames: 1, medianMs: 7, p95Ms: 7, maxMs: 7 });
  });

  it('checks a summary against the budget', () => {
    const s = summariseFrames([2, 3, 4, 5, 20]);
    expect(withinBudget(s, { medianMs: 4, p95Ms: 20 })).toBe(true);
    expect(withinBudget(s, { medianMs: 3, p95Ms: 20 })).toBe(false);
    expect(withinBudget(s, { medianMs: 4, p95Ms: 19 })).toBe(false);
  });

  it('rejects empty or bad samples', () => {
    expect(() => summariseFrames([])).toThrow(RangeError);
    expect(() => summariseFrames([1, -1])).toThrow(RangeError);
    expect(() => summariseFrames([1, Number.NaN])).toThrow(RangeError);
  });

  it('budgets within one 60 fps frame', () => {
    expect(FRAME_BUDGET.frameMs).toBeCloseTo(1000 / 60, 6);
    expect(FRAME_BUDGET.medianMs).toBeLessThanOrEqual(FRAME_BUDGET.frameMs / 2);
    expect(FRAME_BUDGET.p95Ms).toBeLessThanOrEqual(FRAME_BUDGET.frameMs);
  });

  it('holds WebKit to the median limit only (owner, 2026-10-20)', () => {
    expect(FRAME_BUDGET.webkit.medianMs).toBe(FRAME_BUDGET.medianMs);
    const slowTail = summariseFrames([1, 1, 1, 1, 1, 1, 1, 1, 1, 200]);
    expect(withinBudget(slowTail, FRAME_BUDGET.webkit)).toBe(true);
    expect(withinBudget(slowTail, FRAME_BUDGET)).toBe(false);
    const slowMedian = summariseFrames([9, 9, 9, 9, 9]);
    expect(withinBudget(slowMedian, FRAME_BUDGET.webkit)).toBe(false);
  });
});
