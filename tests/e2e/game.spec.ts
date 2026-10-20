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
  expect((await snapshot(page)).enemies).toHaveLength(2);

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
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // Facing down at the start; a robot just below his feet is under the blade.
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x, y), {
    x: start.player.x,
    y: start.player.y + 18,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).enemies[0]?.health).toBe(1);
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();

  // It was knocked back; step up to it and swing again.
  const r = (await snapshot(page)).enemies[0];
  if (!r) throw new Error('robot vanished after one hit');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'down'), {
    x: r.x,
    y: r.y - 14,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).enemies).toEqual([]);
});

test('touching a robot costs half a heart and pushes Jarrett away', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  expect(start.health).toEqual({ points: 6, max: 6 });
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  const hurt = await snapshot(page);
  expect(hurt.invulnerable).toBe(true);
  await page.evaluate(() => window.__game?.clearEnemies());
  // Pushed left, away from the robot on his right.
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.player.x - 10);
  await expect.poll(async () => (await snapshot(page)).invulnerable, { timeout: 5000 }).toBe(false);
});

test('Jarrett picks up gems and hearts', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // Lose half a heart first, so the heart has something to restore.
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  await page.evaluate(() => window.__game?.clearEnemies());
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
  expect(await hud()).toEqual({
    hearts: ['full', 'full', 'full'],
    gems: '000',
    weapon: 'sword-icon',
    manaWidth: 42,
    potions: { health: '1', mana: '1' },
  });

  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x + 6, y), {
    x: start.player.x,
    y: start.player.y,
  });
  await expect.poll(async () => (await hud())?.hearts).toEqual(['full', 'full', 'half']);
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);

  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('gem', x, y), at);
  await expect.poll(async () => (await hud())?.gems).toBe('001');
});

test('the M1 loop: walk to the next room and defeat one of its robots', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 0, row: 1 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).enemies).toHaveLength(2);
  await page.evaluate(() => window.__game?.holdEnemies(true));

  // Stand just above the first robot, facing down, and swing until it's gone.
  for (let swing = 0; swing < 4 && (await snapshot(page)).defeated === 0; swing++) {
    const r = (await snapshot(page)).enemies[0];
    if (!r) break;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y - 14, 'down'), r);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
  }
  expect((await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).enemies).toHaveLength(1);
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});

test('X or K switches between the sword and the daggers, and the status bar shows which', async ({
  page,
}) => {
  await openGame(page);
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect((await snapshot(page)).mode).toBe('near');
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');
  await expect.poll(async () => (await hud())?.weapon).toBe('dagger');
  await page.keyboard.press('k');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('near');
  await expect.poll(async () => (await hud())?.weapon).toBe('sword-icon');
});

test('a thrown dagger flies until a wall stops it, and two daggers defeat a robot', async ({
  page,
}) => {
  await openGame(page);
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');

  // Facing down from the start: the dagger flies down and stops at the room's edge.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).thrown).toBe(1);
  await expect.poll(async () => (await snapshot(page)).daggers).toEqual([]);
  expect((await snapshot(page)).swings).toBe(0); // far mode doesn't swing the sword

  // A robot further down the room, standing still for the test.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x, y + 40), start.player);
  for (let i = 0; i < 4 && (await snapshot(page)).defeated === 0; i++) {
    const r = (await snapshot(page)).enemies[0];
    if (!r) break;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y - 40, 'down'), r);
    // The cooldown between throws must have passed.
    await expect.poll(async () => (await snapshot(page)).throwReady).toBe(true);
    const thrown = (await snapshot(page)).thrown;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snapshot(page)).thrown).toBe(thrown + 1);
    await expect.poll(async () => (await snapshot(page)).daggers).toEqual([]);
  }
  expect((await snapshot(page)).defeated).toBe(1);
});

test('C casts a Fireball: it costs mana, which then refills by itself', async ({ page }) => {
  await openGame(page);
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect((await snapshot(page)).mana).toEqual({ current: 100, max: 100 });
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).casts).toBe(1);
  expect((await snapshot(page)).mana.current).toBe(75);
  await expect.poll(async () => (await hud())?.manaWidth).toBe(32); // 75% of the bar's 42-px fill, rounded
  await expect.poll(async () => (await snapshot(page)).fireballs).toEqual([]);
  // After a short pause it refills to full by itself (25 mana at 12 per second).
  await expect.poll(async () => (await snapshot(page)).mana.current, { timeout: 15_000 }).toBe(100);
  await expect.poll(async () => (await hud())?.manaWidth).toBe(42);
});

test('without enough mana, nothing is cast', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.setMana(20));
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  const s = await snapshot(page);
  expect(s.casts).toBe(0);
  expect(s.fireballs).toEqual([]);
});

test('one Fireball defeats a robot', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x, y + 40), start.player);
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).casts).toBe(1);
});

test('1 drinks a Health Potion, but only when Jarrett is hurt', async ({ page }) => {
  await openGame(page);
  expect((await snapshot(page)).potions).toEqual({ health: 1, mana: 1 });
  // At full health it isn't wasted.
  await page.keyboard.press('1');
  await page.waitForTimeout(200);
  expect((await snapshot(page)).potions.health).toBe(1);

  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x + 6, y), start.player);
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  await page.evaluate(() => window.__game?.clearEnemies());
  await page.keyboard.press('1');
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(6);
  expect((await snapshot(page)).potions.health).toBe(0);
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.hud()))?.potions.health)
    .toBe('0');
});

test('2 drinks a Mana Brew, which makes mana refill faster', async ({ page }) => {
  await openGame(page);
  expect((await snapshot(page)).manaBoosted).toBe(false);
  await page.keyboard.press('2');
  await expect.poll(async () => (await snapshot(page)).manaBoosted).toBe(true);
  expect((await snapshot(page)).potions.mana).toBe(0);
  // Pressing 2 with none left does nothing.
  await page.keyboard.press('2');
  await page.waitForTimeout(200);
  expect((await snapshot(page)).potions.mana).toBe(0);
});

test('Jarrett picks up potions up to three of each; a fourth stays on the ground', async ({
  page,
}) => {
  await openGame(page);
  const at = (await snapshot(page)).player;
  for (let n = 2; n <= 3; n++) {
    await page.evaluate(({ x, y }) => window.__game?.spawnPickup('health-potion', x, y), at);
    await expect.poll(async () => (await snapshot(page)).potions.health).toBe(n);
  }
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('health-potion', x, y), at);
  await page.waitForTimeout(300);
  const s = await snapshot(page);
  expect(s.potions.health).toBe(3);
  expect(s.pickups.map((p) => p.kind)).toEqual(['health-potion']);

  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('mana-brew', x, y), at);
  await expect.poll(async () => (await snapshot(page)).potions.mana).toBe(2);
});

/** Each enemy kind's body height (ENEMIES in tuning.ts), to stand just above it. */
const BODY_HEIGHT = { robot: 10, bird: 14, eye: 18, ghost: 22, wolf: 12 } as const;

for (const kind of ['bird', 'eye', 'ghost', 'wolf'] as const) {
  test(`the sword defeats a ${kind}`, async ({ page }) => {
    const watched = watchPage(page);
    await openGame(page);
    await page.evaluate(() => window.__game?.holdEnemies(true));
    const start = await snapshot(page);
    await page.evaluate(({ k, x, y }) => window.__game?.spawnEnemy(k, x, y), {
      k: kind,
      x: start.player.x,
      y: start.player.y + 50,
    });
    for (let swing = 0; swing < 6 && (await snapshot(page)).defeated === 0; swing++) {
      const e = (await snapshot(page)).enemies[0];
      if (!e) break;
      await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'down'), {
        x: e.x,
        y: e.y - BODY_HEIGHT[kind] - 2,
      });
      await page.keyboard.press('Space');
      await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
    }
    expect((await snapshot(page)).defeated).toBe(1);
    expect(watched.errors).toEqual([]);
  });
}

test('the flying eye shoots at Jarrett, and a shot costs half a heart', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // Within the distance it keeps, so it circles and shoots rather than closing in.
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('eye', x + 90, y), start.player);
  // A shot is only in the air for half a second or so, so count shots fired rather than catch one.
  await expect
    .poll(async () => (await snapshot(page)).shotsFired, { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect.poll(async () => (await snapshot(page)).health.points, { timeout: 10_000 }).toBe(5);
});

test('the wolf charges when Jarrett is in line with it', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('wolf', x + 100, y), start.player);
  await expect.poll(async () => (await snapshot(page)).enemies[0]?.charging).toBe(true);
  // It rushes at him, far faster than it walks.
  await expect.poll(async () => (await snapshot(page)).health.points).toBeLessThan(6);
});
