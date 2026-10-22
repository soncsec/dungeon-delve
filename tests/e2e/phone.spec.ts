import { expect, test, type Page } from '@playwright/test';
import type { GameSnapshot } from '../../src/scenes/GameScene';

// Runs only in the "phone" project (Pixel 7 emulation; see playwright.config.ts):
// the game starts cleanly on a phone-sized touch screen and stays inside it, and
// its touch controls (M8.2, brought forward by the owner 2026-10-21) work.

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

const snapshot = (page: Page): Promise<GameSnapshot> =>
  page.evaluate(() => window.__game?.snapshot() as GameSnapshot);

/** A dungeon 1 game (no title, no talk), with its enemies held still. */
async function openDungeon(page: Page): Promise<void> {
  await page.goto('./?dungeon=1');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Game');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
  });
}

/** Real finger touches (Chrome's input), so the page sees what a phone would send. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return {
    down: (x: number, y: number) => touch('touchStart', [{ x, y }]),
    move: (x: number, y: number) => touch('touchMove', [{ x, y }]),
    up: () => touch('touchEnd', []),
  };
}

test('the touch pad walks Jarrett the way the finger points, and stops when it lifts', async ({
  page,
}) => {
  await openDungeon(page);
  const pad = await page.locator('#touch .pad').boundingBox();
  expect(pad).not.toBeNull();
  const cx = (pad?.x ?? 0) + (pad?.width ?? 0) / 2;
  const cy = (pad?.y ?? 0) + (pad?.height ?? 0) / 2;
  const reach = (pad?.width ?? 0) * 0.4;
  const start = (await snapshot(page)).player;
  const f = await finger(page);
  // Right of the pad's middle: he walks right.
  await f.down(cx + reach, cy);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(start.x + 10);
  expect((await snapshot(page)).facing).toBe('right');
  // The finger slides above the middle: he turns and walks up.
  const y0 = (await snapshot(page)).player.y;
  await f.move(cx, cy - reach);
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(y0 - 10);
  expect((await snapshot(page)).facing).toBe('up');
  // Lifted: he stands still.
  await f.up();
  await expect.poll(async () => (await snapshot(page)).moving).toBe(false);
  const still = (await snapshot(page)).player;
  await page.waitForTimeout(300);
  expect((await snapshot(page)).player).toEqual(still);
});

test('the touch buttons: HIT swings, MAGIC casts, SWAP switches, BAG opens and closes the bag', async ({
  page,
}) => {
  await openDungeon(page);
  await page.evaluate(() => {
    window.__game?.giveItem('fireball');
    window.__game?.giveItem('daggers');
  });
  const tap = async (kind: string) => {
    const box = await page.locator(`#touch .${kind}`).boundingBox();
    expect(box, kind).not.toBeNull();
    await page.touchscreen.tap(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
  };
  await tap('attack');
  await expect.poll(async () => (await snapshot(page)).swings).toBe(1);
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
  await tap('spell');
  await expect.poll(async () => (await snapshot(page)).casts).toBe(1);
  await tap('switch');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');
  await tap('bag');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Inventory');
  await tap('bag');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
});

test('the PAUSE button pauses; RESUME on the pause screen is a button too', async ({ page }) => {
  await openDungeon(page);
  const box = await page.locator('#touch .pause').boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Pause');
  // RESUME: left of the middle, 116 px down the 320×180 game (scaled to the canvas).
  const canvas = await page.locator('#game canvas').boundingBox();
  const k = (canvas?.width ?? 0) / 320;
  await page.touchscreen.tap((canvas?.x ?? 0) + 90 * k, (canvas?.y ?? 0) + 120 * k);
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
});

test('the touch controls sit below the game when the phone is upright', async ({ page }) => {
  await openDungeon(page);
  const canvas = await page.locator('#game canvas').boundingBox();
  const viewport = page.viewportSize();
  expect(canvas?.y).toBe(0);
  for (const sel of ['.pad', '.attack', '.switch', '.spell', '.health', '.mana', '.bag']) {
    const box = await page.locator(`#touch ${sel}`).boundingBox();
    expect(box, sel).not.toBeNull();
    // Below the game, and on the screen.
    expect(box?.y ?? 0, sel).toBeGreaterThanOrEqual((canvas?.y ?? 0) + (canvas?.height ?? 0));
    expect((box?.y ?? 0) + (box?.height ?? 0), sel).toBeLessThanOrEqual(viewport?.height ?? 0);
  }
});

test('on a phone, Walker names the touch buttons, not the keys', async ({ page }) => {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Title');
  await page.keyboard.press('Enter'); // NEW GAME
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  const w = (await snapshot(page)).walker;
  expect(w).not.toBeNull();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), {
    x: w?.x ?? 0,
    y: w?.y ?? 0,
  });
  // HIT starts the talk and turns its pages, as Space does.
  const hit = await page.locator('#touch .attack').boundingBox();
  const tapHit = () =>
    page.touchscreen.tap(
      (hit?.x ?? 0) + (hit?.width ?? 0) / 2,
      (hit?.y ?? 0) + (hit?.height ?? 0) / 2,
    );
  await tapHit();
  await expect.poll(async () => (await snapshot(page)).talking).not.toBeNull();
  const pages: string[] = [];
  for (let i = 0; i < 20; i++) {
    const talking = (await snapshot(page)).talking;
    if (!talking) break;
    pages.push(talking.lines.join(' '));
    await tapHit();
    await expect
      .poll(async () => (await snapshot(page)).talking?.page ?? -1, { intervals: [50] })
      .not.toBe(talking.page);
  }
  const said = pages.join(' ');
  expect(said).toContain('THE PAD WALKS. HIT STRIKES.');
  expect(said).toContain('BAG OPENS YOUR BAG');
  expect(said).not.toContain('WASD');
  expect(said).not.toContain('SPACE');
  expect((await snapshot(page)).walker).toBeNull();
});
