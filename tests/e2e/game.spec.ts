import { expect, test, type Page } from '@playwright/test';
import type { GameSnapshot } from '../../src/scenes/GameScene';

/** Records console errors, uncaught exceptions and requests to other hosts. */
function watchPage(page: Page): { errors: string[]; foreignRequests: string[] } {
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
  return { errors, foreignRequests };
}

async function snapshot(page: Page): Promise<GameSnapshot> {
  const snap = await page.evaluate(() => window.__game?.snapshot() ?? null);
  if (!snap) throw new Error('game scene is not running');
  return snap;
}

async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Game');
}

test('boots with no console errors and no third-party requests', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('arrow keys move the player and it stays on screen', async ({ page }) => {
  await openGame(page);
  const start = (await snapshot(page)).player;
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.x - 20);
  await page.waitForTimeout(2000); // long enough to reach the edge
  await page.keyboard.up('ArrowLeft');
  const left = (await snapshot(page)).player;
  expect(left.x).toBeGreaterThan(0);
  expect(left.y).toBe(start.y);
});

test('?seed= in the URL sets the random seed', async ({ page }) => {
  await openGame(page, '?seed=42');
  expect((await snapshot(page)).seed).toBe(42);
});

test('asset preview scene loads every asset and pages through the groups', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./?scene=preview');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('AssetPreview');
  expect(await page.evaluate(() => window.__game?.missingTextures() ?? null)).toEqual([]);
  const first = await page.evaluate(() => window.__game?.previewGroup() ?? null);
  expect(first).toBe('characters');
  // One key at a time, checking the page after each, so every step is accounted for.
  const group = () => page.evaluate(() => window.__game?.previewGroup() ?? null);
  await page.keyboard.press('ArrowRight');
  await expect.poll(group).toBe('enemies');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(group).toBe('characters');
  await page.keyboard.press('ArrowLeft'); // wraps round to the last group
  await expect.poll(group).toBe('items');
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('Jarrett faces the way he walks, and walls stop him', async ({ page }) => {
  await openGame(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).facing).toBe('up');
  await expect.poll(async () => (await snapshot(page)).moving).toBe(true);
  await page.keyboard.up('ArrowUp');

  // Left of the start room's boulder (cells 4–5, rows 6–7), in row 7.
  await page.evaluate(() => window.__game?.placeHero(40, 126));
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).player.x).toBe(59); // flush: 64 − half box width 5
  await page.waitForTimeout(300);
  expect((await snapshot(page)).player).toEqual({ x: 59, y: 126 });
  expect((await snapshot(page)).facing).toBe('right');
  await page.keyboard.up('ArrowRight');
});

test('walking through a gap slides to the next room, and back', async ({ page }) => {
  await openGame(page);
  expect((await snapshot(page)).room).toEqual({ col: 1, row: 1 });
  // The start room's west gap is at rows 4–5; Jarrett starts in row 5.
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 0, row: 1 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  const arrived = (await snapshot(page)).enteredAt;
  expect(arrived?.x).toBeGreaterThan(300); // at the new room's east edge
  expect(arrived?.y).toBe(94); // same row as before
  // The west room's two robots appear once the view has arrived.
  expect((await snapshot(page)).robots).toHaveLength(2);

  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 1 });
  await page.keyboard.up('ArrowRight');
});

test('Space or J swings the sword in front of Jarrett, and he stands still meanwhile', async ({
  page,
}) => {
  await openGame(page);
  const start = await snapshot(page);
  expect(start.swings).toBe(0);
  // Facing down at the start: the swing covers the ground just below his feet.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).swings).toBe(1);
  const box = (await snapshot(page)).lastSword;
  expect(box?.y).toBe(start.player.y);
  expect(box?.x).toBeLessThan(start.player.x);
  expect((box?.x ?? 0) + (box?.w ?? 0)).toBeGreaterThan(start.player.x);

  // A press during a swing is ignored, so let the first swing finish.
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();

  // J swings too. Holding a direction from the moment of the swing doesn't move
  // him until it ends; then he walks on.
  await page.keyboard.down('j');
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).swings).toBe(2);
  await expect.poll(async () => (await snapshot(page)).stoodAfterSwing).not.toBeNull();
  expect((await snapshot(page)).stoodAfterSwing).toEqual(start.player);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.player.x);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('j');
});

test('two sword hits defeat a robot', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // Robots stand still (apart from knockback), so the test can aim at one.
  await page.evaluate(() => window.__game?.holdRobots(true));
  // Facing down at the start; a robot just below his feet is under the blade.
  await page.evaluate(({ x, y }) => window.__game?.spawnRobot(x, y), {
    x: start.player.x,
    y: start.player.y + 18,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).robots[0]?.health).toBe(1);
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();

  // It was knocked back; step up to it and swing again.
  const r = (await snapshot(page)).robots[0];
  if (!r) throw new Error('robot vanished after one hit');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'down'), {
    x: r.x,
    y: r.y - 14,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).robots).toEqual([]);
});

test('touching a robot costs half a heart and pushes Jarrett away', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  expect(start.health).toEqual({ points: 6, max: 6 });
  await page.evaluate(({ x, y }) => window.__game?.spawnRobot(x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  const hurt = await snapshot(page);
  expect(hurt.invulnerable).toBe(true);
  await page.evaluate(() => window.__game?.clearRobots());
  // Pushed left, away from the robot on his right.
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.player.x - 10);
  await expect.poll(async () => (await snapshot(page)).invulnerable, { timeout: 5000 }).toBe(false);
});

test('Jarrett picks up gems and hearts', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // Lose half a heart first, so the heart has something to restore.
  await page.evaluate(({ x, y }) => window.__game?.spawnRobot(x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  await page.evaluate(() => window.__game?.clearRobots());
  // Let the knockback finish, so he stands where the pickups go.
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);

  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('gem', x, y), { x: at.x, y: at.y });
  await expect.poll(async () => (await snapshot(page)).gems).toBe(1);
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('heart', x, y), {
    x: at.x,
    y: at.y,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(6);
  expect((await snapshot(page)).pickups).toEqual([]);
});

test('the status bar shows hearts and gems', async ({ page }) => {
  await openGame(page);
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect(await hud()).toEqual({ hearts: ['full', 'full', 'full'], gems: '000' });

  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnRobot(x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await hud())?.hearts).toEqual(['full', 'full', 'half']);
  await page.evaluate(() => window.__game?.clearRobots());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);

  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('gem', x, y), at);
  await expect.poll(async () => (await hud())?.gems).toBe('001');
});
