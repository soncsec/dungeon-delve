import { expect, test } from '@playwright/test';

// Runs only in the "phone" project (Pixel 7 emulation; see playwright.config.ts).
// Touch controls arrive in M8.2; for now this checks the game starts cleanly on
// a phone-sized touch screen and stays inside it.

test('boots on a phone with no errors, no third-party requests, inside the screen', async ({
  page,
}) => {
  const errors: string[] = [];
  const foreignRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      foreignRequests.push(req.url());
    }
  });

  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Title');

  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  // Tap NEW GAME (centred, 104 of the game's 180 px down).
  if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + (box.height * 104) / 180);
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
  }

  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
  expect(foreignRequests).toEqual([]);
});
