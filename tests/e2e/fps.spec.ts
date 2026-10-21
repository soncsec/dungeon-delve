import { expect, test } from '@playwright/test';
import { FRAME_BUDGET } from '../../src/config/tuning';
import { summariseFrames, withinBudget } from '../../src/logic/perf';

// Sampling several seconds of a busy room takes a while on a shared machine.
test.describe.configure({ timeout: 120_000 });

/** Frames to sample: about 5 s at 60 fps. */
const FRAMES = 300;

test('a crowded fight keeps each frame within the 60 fps budget (M2.9)', async ({ page }, info) => {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Title');
  await page.keyboard.press('Enter'); // NEW GAME
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  // Two of every enemy kind around the start room, all moving (and the eyes shooting).
  await page.evaluate(() => {
    const h = window.__game;
    const kinds = ['robot', 'bird', 'ghost', 'eye', 'wolf'] as const;
    kinds.forEach((k, i) => {
      h?.spawnEnemy(k, 40 + i * 55, 60);
      h?.spawnEnemy(k, 40 + i * 55, 140);
    });
  });
  // Jarrett throws daggers (far weapon) non-stop, and casts when he can.
  await page.evaluate(() => window.__game?.giveItem('daggers'));
  await page.keyboard.press('x');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.__game?.frameTimes(true));
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          // Keep him on his feet, so the measurement is of the fight, not of a fall.
          window.__game?.setHealth(6);
          window.__game?.setMana(100);
        });
        await page.keyboard.press('c');
        return (await page.evaluate(() => window.__game?.frameTimes()))?.workMs.length;
      },
      { timeout: 90_000, intervals: [200] },
    )
    .toBeGreaterThanOrEqual(FRAMES);
  await page.keyboard.up('Space');

  const times = await page.evaluate(() => window.__game?.frameTimes());
  const summary = summariseFrames(times?.workMs ?? []);
  const report = `median ${summary.medianMs.toFixed(2)} ms, 95% ${summary.p95Ms.toFixed(2)} ms, max ${summary.maxMs.toFixed(2)} ms over ${summary.frames} frames; Phaser fps ${times?.fps.toFixed(1)}`;
  info.annotations.push({ type: 'frame times', description: report });
  console.log(`[${info.project.name}] ${report}`);
  // WebKit is held to its median only (FRAME_BUDGET.webkit); the others to both limits.
  const budget = info.project.name === 'webkit' ? FRAME_BUDGET.webkit : FRAME_BUDGET;
  expect(withinBudget(summary, budget), report).toBe(true);
});
