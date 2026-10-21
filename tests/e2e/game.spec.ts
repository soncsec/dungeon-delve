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
  // Aim only once it has stopped sliding from the last hit.
  await expect.poll(async () => (await snapshot(page)).enemies.some((x) => x.knocked)).toBe(false);
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
    keys: null, // shown in dungeons only
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
    // Aim only once it has stopped sliding from the last hit.
    await expect
      .poll(async () => (await snapshot(page)).enemies.some((x) => x.knocked))
      .toBe(false);
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
  // The daggers are dungeon 1's prize; this test starts with them.
  await page.evaluate(() => window.__game?.giveItem('daggers'));
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
    // Aim only once it has stopped sliding from the last hit.
    await expect
      .poll(async () => (await snapshot(page)).enemies.some((x) => x.knocked))
      .toBe(false);
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
      // Aim only once it has stopped sliding from the last hit.
      await expect
        .poll(async () => (await snapshot(page)).enemies.some((x) => x.knocked))
        .toBe(false);
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

test('the shield blocks a shot from the front, but not from the side', async ({ page }) => {
  await openGame(page);
  const at = (await snapshot(page)).player;
  const mid = at.y - 10; // the middle of his body

  // Facing right, a shot from the right is blocked.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'right'), at);
  await page.evaluate(({ x, y }) => window.__game?.fireEnemyShot(x + 60, y, -1, 0), {
    x: at.x,
    y: mid,
  });
  await expect.poll(async () => (await snapshot(page)).blocked).toBe(1);
  expect((await snapshot(page)).health.points).toBe(6);

  // Facing up, the same shot hits him in the side.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'up'), at);
  await page.evaluate(({ x, y }) => window.__game?.fireEnemyShot(x + 60, y, -1, 0), {
    x: at.x,
    y: mid,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  expect((await snapshot(page)).blocked).toBe(1);
});

test('I opens the inventory over a paused game; I closes it', async ({ page }) => {
  await openGame(page);
  const before = (await snapshot(page)).player;
  await page.keyboard.press('i');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Inventory');
  expect(await page.evaluate(() => window.__game?.inventory())).toEqual({
    cursor: 0,
    // No far weapon yet: the daggers are dungeon 1's prize.
    slots: { near: 'Wooden Sword', far: '', spell: 'Fireball', shield: 'Wooden Shield' },
  });
  // The game is paused: holding a direction doesn't move Jarrett.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('i');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  expect((await snapshot(page)).player).toEqual(before);
  expect(await page.evaluate(() => window.__game?.inventory())).toBeNull();
});

test('in the inventory, arrows choose a slot and Space switches its item', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.giveItem('steel-sword');
    window.__game?.giveItem('daggers');
  });
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => window.__game?.inventory()?.cursor)).toBe(0);
  const inv = () => page.evaluate(() => window.__game?.inventory());
  await page.keyboard.press('Space');
  await expect.poll(async () => (await inv())?.slots['near']).toBe('Steel Sword');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await inv())?.cursor).toBe(1);
  // Only one far weapon: Space changes nothing.
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  expect((await inv())?.slots['far']).toBe('Daggers');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await inv())?.cursor).toBe(3); // wrapped round to Shield
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  // The choice stays: opening again shows the Steel Sword.
  await page.keyboard.press('i');
  await expect.poll(async () => (await inv())?.slots['near']).toBe('Steel Sword');
});

test('out of hearts, Jarrett falls and is back in the start room, losing 10% of his gems', async ({
  page,
}) => {
  await openGame(page);
  // Into the west room first, so coming back to the start room shows.
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 0, row: 1 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await page.evaluate(() => window.__game?.clearEnemies());
  await page.evaluate(() => {
    window.__game?.setGems(25);
    window.__game?.setHealth(1);
  });
  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x - 6, y), at);
  await expect.poll(async () => (await snapshot(page)).falling).toBe(true);
  await expect.poll(async () => (await snapshot(page)).falls, { timeout: 10_000 }).toBe(1);
  const s = await snapshot(page);
  expect(s.falling).toBe(false);
  expect(s.room).toEqual({ col: 1, row: 1 });
  expect(s.health).toEqual({ points: 6, max: 6 });
  expect(s.gems).toBe(23); // 25 − 10% rounded down
  expect(s.potions).toEqual({ health: 1, mana: 1 });
  expect(s.mana.current).toBe(100);
});

test('actions make their sounds, and M mutes and unmutes', async ({ page }) => {
  await openGame(page);
  const sounds = async () => (await snapshot(page)).sounds;
  await page.keyboard.press('Space');
  await expect.poll(async () => (await sounds()).swing).toBe(1);
  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('gem', x, y), at);
  await expect.poll(async () => (await sounds()).gem).toBe(1);
  await page.evaluate(() => window.__game?.setMana(0));
  await page.keyboard.press('c');
  await expect.poll(async () => (await sounds()).noMana).toBe(1);
  expect((await sounds()).cast).toBe(0);

  expect((await snapshot(page)).muted).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(async () => (await snapshot(page)).muted).toBe(true);
  await page.keyboard.press('m');
  await expect.poll(async () => (await snapshot(page)).muted).toBe(false);
});

test('the sounds are built in the browser from code (Web Audio)', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  const ready = await page.evaluate(() => {
    const ctx = (window as unknown as { AudioContext?: unknown }).AudioContext;
    return ctx !== undefined;
  });
  expect(ready).toBe(true);
  // No sound files are fetched: every request stays on our own server and none is audio.
  expect(watched.foreignRequests).toEqual([]);
  expect(watched.errors).toEqual([]);
});

test('?dungeon=1 starts at dungeon 1, whose walls stop Jarrett', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  const start = await snapshot(page);
  expect(start.map).toBe('dungeon1');
  // Straight up from the start: open floor until the wall face in row 1.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(38); // row 2's top (32) + his 6-px feet box
  await page.keyboard.up('ArrowUp');
  expect(watched.errors).toEqual([]);
});

test('without ?dungeon, the game starts on the overworld', async ({ page }) => {
  await openGame(page, '?dungeon=99');
  expect((await snapshot(page)).map).toBe('overworld');
});

test('in dungeon 1: a chest gives a key, and the key opens the locked door into the hub', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const hud = () => page.evaluate(() => window.__game?.hud());
  await expect.poll(async () => (await hud())?.keys).toBe('0'); // the key count shows in dungeons
  // The key chest is at column 4, row 3: walk up into it from just below.
  await page.evaluate(() => window.__game?.placeHero(72, 86, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).keys).toBe(1); // opened, and the key picked up
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).opened).toEqual(['dungeon1/1,3/4,3']);
  await expect.poll(async () => (await hud())?.keys).toBe('1');

  // The locked door is at columns 9–10, row 1: walk up into it, and on through.
  await page.evaluate(() => window.__game?.placeHero(160, 44, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 2 }); // the hub
  await page.keyboard.up('ArrowUp');
  const s = await snapshot(page);
  expect(s.keys).toBe(0);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon1/1,3/9,1', 'dungeon1/1,3/10,1']));
  expect(watched.errors).toEqual([]);
});

test('without a key, the locked door stays shut', async ({ page }) => {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.placeHero(160, 44, 'up'));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowUp');
  const s = await snapshot(page);
  expect(s.opened).toEqual([]);
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.player.y).toBe(38); // flush below the gate (row 2's top + his 6-px feet box)
});

test('leaning on a stone slides it one cell', async ({ page }) => {
  await openGame(page, '?dungeon=1');
  expect((await snapshot(page)).stones).toEqual([{ cx: 12, cy: 4 }]);
  // Just left of the stone (x 192–207, row 4), facing it.
  await page.evaluate(() => window.__game?.placeHero(186, 78, 'right'));
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).stones).toEqual([{ cx: 13, cy: 4 }]);
  await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).sounds.push).toBe(1);
});

test('through the archway into dungeon 1, and back out again', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // North from the start room, then on up through the archway's opening.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 20_000 }).toBe('dungeon1');
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const inside = await snapshot(page);
  expect(inside.room).toEqual({ col: 1, row: 3 });
  expect(inside.enteredAt).toEqual({ x: 160, y: 140 }); // where he arrived (the arrow was still held after)

  // Back down through the doorway in the south wall.
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 10_000 }).toBe('overworld');
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const outside = await snapshot(page);
  expect(outside.room).toEqual({ col: 1, row: 0 });
  expect(outside.facing).toBe('down');
  expect(watched.errors).toEqual([]);
});

test('the daggers: push the stone into the closet, open the chest, and throw one', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(0, 2)); // the west room
  expect((await snapshot(page)).stones).toEqual([{ cx: 6, cy: 5 }]);
  // East of the stone that blocks the closet's doorway, pushing west.
  await page.evaluate(() => window.__game?.placeHero(118, 94, 'left'));
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).stones).toEqual([{ cx: 5, cy: 5 }]);
  await page.keyboard.up('ArrowLeft');
  // Into the closet, and up into the chest at column 3, row 3.
  await page.evaluate(() => window.__game?.placeHero(56, 78, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon1/0,2/3,3');
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]); // picked up
  // He can throw them now.
  await page.keyboard.press('x');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).thrown).toBe(1);
  expect(watched.errors).toEqual([]);
});

/** From the great hall, north into dungeon 1's boss room. */
async function enterBossRoom(page: Page): Promise<void> {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.goToRoom(1, 1)); // the great hall
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 0 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('treant');
}

test('the Treant fires spreads of three seeds, and five once it is down to half health', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterBossRoom(page);
  const fired = async () => (await snapshot(page)).shotsFired;
  // Each spread arrives in one frame, so the count jumps by a whole spread at a time.
  let before = await fired();
  await expect.poll(fired, { timeout: 10_000 }).toBeGreaterThan(before);
  expect((await fired()) - before).toBe(3);
  await page.evaluate(() => window.__game?.setBossHealth(5));
  expect((await snapshot(page)).boss?.fierce).toBe(true);
  // The spread already on its way may still be three; the next is five.
  before = await fired();
  await expect.poll(fired, { timeout: 10_000 }).toBeGreaterThan(before);
  before = await fired();
  await expect.poll(fired, { timeout: 10_000 }).toBeGreaterThan(before);
  expect((await fired()) - before).toBe(5);
  expect(watched.errors).toEqual([]);
});

test('the boss room shuts behind Jarrett, and opens for good once the Treant is beaten', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterBossRoom(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect((await snapshot(page)).boss?.health).toBe(10);
  // All the way in: the gates shut.
  await page.evaluate(() => window.__game?.placeHero(80, 110, 'down'));
  await expect.poll(async () => (await snapshot(page)).sealed).toBe(true);
  // The south way out is barred (its gate is row 8, from y 128).
  await page.evaluate(() => window.__game?.placeHero(160, 120, 'down'));
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowDown');
  let s = await snapshot(page);
  expect(s.room).toEqual({ col: 1, row: 0 });
  expect(s.player.y).toBeLessThanOrEqual(128);

  // One hit left: stand below it and swing up.
  await page.evaluate(() => window.__game?.setBossHealth(1));
  const bx = (await snapshot(page)).boss?.x ?? 0;
  await page.evaluate((x) => window.__game?.placeHero(x, 120, 'up'), bx);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  s = await snapshot(page);
  expect(s.sealed).toBe(false);
  expect(s.opened).toContain('dungeon1/1,0/boss');
  expect(s.sounds.defeat).toBeGreaterThanOrEqual(1);

  // Out through the south gap, and back: it stays beaten.
  await page.evaluate(() => window.__game?.placeHero(160, 120, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 1 });
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 0 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await page.waitForTimeout(300);
  s = await snapshot(page);
  expect(s.boss).toBeNull();
  expect(s.sealed).toBe(false);
  expect(watched.errors).toEqual([]);
});

/** Into the boss room, and the Treant beaten with one swing (its health set to 1). */
async function beatTreant(page: Page): Promise<void> {
  await enterBossRoom(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.setBossHealth(1));
  const bx = (await snapshot(page)).boss?.x ?? 0;
  await page.evaluate((x) => window.__game?.placeHero(x, 120, 'up'), bx);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
}

test('the beaten Treant leaves a heart container (+1 heart) and a shard of the Star of Power', async ({
  page,
}) => {
  const watched = watchPage(page);
  await beatTreant(page);
  const kinds = async () => (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(await kinds()).toEqual(['heart-container', 'shard']);
  const at = (kind: string) =>
    snapshot(page).then((s) => s.pickups.find((p) => p.kind === kind) ?? { x: 0, y: 0 });

  await page.evaluate(() => window.__game?.setHealth(3));
  const heart = await at('heart-container');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), heart);
  await expect.poll(kinds).toEqual(['shard']);
  let s = await snapshot(page);
  expect(s.health).toEqual({ points: 8, max: 8 }); // four hearts, all full
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.hud()))?.hearts.length)
    .toBe(4);

  const shard = await at('shard');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), shard);
  await expect.poll(kinds).toEqual([]);
  s = await snapshot(page);
  expect(s.shards).toBe(1);
  expect(s.announced).toBe(1);
  expect(s.sounds.shard).toBe(1);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon1/heart', 'dungeon1/shard']));
  expect(watched.errors).toEqual([]);
});

test('a reward left behind is still there when Jarrett comes back', async ({ page }) => {
  await beatTreant(page);
  // Out through the south gap without picking anything up, and back in.
  await page.evaluate(() => window.__game?.placeHero(160, 120, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 1 });
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 0 });
  await page.keyboard.up('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).pickups.map((p) => p.kind).sort())
    .toEqual(['heart-container', 'shard']);
});
