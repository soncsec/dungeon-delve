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

const sceneNow = (page: Page) => page.evaluate(() => window.__game?.scene() ?? null);

/** The opened doors and chests (ids ending in a cell), leaving out seen rooms, bosses and the rest. */
const fixtures = (opened: string[]): string[] => opened.filter((id) => /\/\d+,\d+$/.test(id));

/**
 * Talks to Walker (he must be in the room): stand beside him facing him, press
 * Space, and turn every page. Returns the pages shown.
 */
async function talkToWalker(page: Page): Promise<string[][]> {
  const w = (await snapshot(page)).walker;
  if (!w) throw new Error('Walker is not here');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), w);
  // A press is ignored while he is being knocked back.
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).talking).not.toBeNull();
  const pages: string[][] = [];
  for (;;) {
    const talking = (await snapshot(page)).talking;
    if (!talking) break;
    pages.push(talking.lines);
    await page.keyboard.press('Space');
    // Wait for the page to turn (or the talk to end) before reading the next.
    await expect
      .poll(async () => (await snapshot(page)).talking?.page ?? -1)
      .not.toBe(talking.page);
  }
  return pages;
}

/**
 * Opens the game; from the title screen (no save yet), Enter starts a new game.
 * In a new game Walker hands over the sword and shield first, and Jarrett goes
 * back to where he started.
 */
async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toMatch(/^(Title|Game)$/);
  if ((await sceneNow(page)) === 'Title') await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Game');
  const start = await snapshot(page);
  // Only the village talk: Walker at a dungeon entrance is left for the test.
  if (start.map === 'overworld' && start.walker) {
    await talkToWalker(page);
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'down'), start.player);
  }
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
  expect((await snapshot(page)).room).toEqual({ col: 4, row: 7 });
  // The start room's west gap is at rows 4–5; Jarrett starts in row 5.
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 3, row: 7 });
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
    .toEqual({ col: 4, row: 7 });
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
    .toEqual({ col: 3, row: 7 });
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
  // No daggers yet (they're dungeon 1's prize): the far box is empty.
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');
  await expect.poll(async () => (await hud())?.weapon).toBe('');
  await page.evaluate(() => window.__game?.giveItem('daggers'));
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
  // Mana and the bar read together, from the same frame: on a slow machine mana can refill
  // between two separate reads.
  const after = await page.evaluate(() => ({
    mana: window.__game?.snapshot()?.mana.current,
    width: window.__game?.hud().manaWidth,
  }));
  expect(after).toEqual({ mana: 75, width: 32 }); // 75% of the bar's 42-px fill, rounded
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
    map: null, // outdoors: no dungeon map
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
    .toEqual({ col: 3, row: 7 });
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
  expect(s.room).toEqual({ col: 4, row: 7 });
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
  expect(fixtures((await snapshot(page)).opened)).toEqual(['dungeon1/1,3/4,3']);
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
  expect(fixtures(s.opened)).toEqual([]);
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.player.y).toBe(38); // flush below the gate (row 2's top + his 6-px feet box)
});

test('leaning on a stone slides it one cell', async ({ page }) => {
  await openGame(page, '?dungeon=1');
  expect((await snapshot(page)).stones).toEqual([{ cx: 12, cy: 4 }]);
  // Just left of the stone (x 192–207, row 4), facing it.
  await page.evaluate(() => window.__game?.placeHero(186, 78, 'right'));
  await page.keyboard.down('ArrowRight');
  // Read the sound count from the snapshot that first shows the stone moved: with the
  // arrow still held, he goes on leaning, and a later snapshot may show the next push.
  let moved = await snapshot(page);
  await expect
    .poll(async () => {
      moved = await snapshot(page);
      return moved.stones;
    })
    .toEqual([{ cx: 13, cy: 4 }]);
  await page.keyboard.up('ArrowRight');
  expect(moved.sounds.push).toBe(1);
});

test('through the archway into dungeon 1, and back out again', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  // Enemies held and out of the way: held ones still hurt to touch, and a knock sideways
  // would push him off line with the archway's opening.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.clearEnemies());
  // West out of the village gate, then north up the west street to Hollow Oak's
  // archway. He stops for each slide, so each room's enemies (which appear when
  // the slide ends) are cleared before he walks on.
  const walkTo = async (key: string, room: { col: number; row: number }) => {
    await page.keyboard.down(key);
    await expect.poll(async () => (await snapshot(page)).room, { timeout: 15_000 }).toEqual(room);
    await page.keyboard.up(key);
    await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
    await page.evaluate(() => window.__game?.clearEnemies());
  };
  await walkTo('ArrowLeft', { col: 3, row: 7 });
  // In line with the meadow's north gap (columns 9–10), then north.
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'up'));
  await walkTo('ArrowUp', { col: 3, row: 6 });
  await walkTo('ArrowUp', { col: 3, row: 5 });
  // On up through the archway's opening.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 20_000 }).toBe('dungeon1');
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const inside = await snapshot(page);
  expect(inside.room).toEqual({ col: 1, row: 3 });
  expect(inside.health.points).toBe(inside.health.max); // nothing touched him on the way
  expect(inside.enteredAt).toEqual({ x: 160, y: 140 }); // where he arrived (the arrow was still held after)

  // Back down through the doorway in the south wall.
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 10_000 }).toBe('overworld');
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const outside = await snapshot(page);
  expect(outside.room).toEqual({ col: 3, row: 5 });
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

const titleShows = (page: Page) => page.evaluate(() => window.__game?.title() ?? null);

/** Opens the game afresh (without ?dungeon, which skips the title) and waits for the title screen. */
async function reloadToTitle(page: Page): Promise<void> {
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
}

test('a new game from the title screen saves at the start room', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  expect(await titleShows(page)).toEqual({ screen: 'menu', options: ['NEW GAME'], cursor: 0 });
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const s = await snapshot(page);
  expect(s.map).toBe('overworld');
  expect(s.saves).toBe(1);
  expect(s.cheated).toBe(false);
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['CONTINUE', 'NEW GAME']);
  expect(watched.errors).toEqual([]);
});

test('CONTINUE brings back hearts, items, gems, keys, opened chests, beaten bosses and play time', async ({
  page,
}) => {
  const watched = watchPage(page);
  await beatTreant(page); // a ?dungeon=1 run: marked as a cheat
  const heart = (await snapshot(page)).pickups.find((p) => p.kind === 'heart-container');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), heart ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).health.max).toBe(8);
  await page.evaluate(() => window.__game?.giveItem('daggers'));
  await page.evaluate(() => window.__game?.giveKey());
  await page.evaluate(() => window.__game?.setGems(42));
  // Back to the entrance, the save point.
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  const saved = await snapshot(page);
  expect(saved.saves).toBeGreaterThanOrEqual(2);

  await reloadToTitle(page);
  await page.keyboard.press('Enter'); // CONTINUE
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon1');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.health).toEqual({ points: 8, max: 8 });
  expect(s.gems).toBe(42);
  expect(s.keys).toBe(1);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon1/1,0/boss', 'dungeon1/heart']));
  expect(s.opened).not.toContain('dungeon1/shard'); // left on the floor
  expect(s.cheated).toBe(true);
  // It carries on from the play time in the save.
  expect(saved.savedPlayMs).not.toBeNull();
  expect(s.playMs).toBeGreaterThanOrEqual(saved.savedPlayMs ?? Number.POSITIVE_INFINITY);
  expect((await page.evaluate(() => window.__game?.hud()))?.hearts.length).toBe(4);
  await page.keyboard.press('i');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots.far)
    .toBe('Daggers');
  expect(watched.errors).toEqual([]);
});

test('NEW GAME over a save asks first; NO keeps it, YES starts over', async ({ page }) => {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.setGems(42));
  await page.evaluate(() => window.__game?.goToRoom(1, 3)); // saves
  await reloadToTitle(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => titleShows(page))
    .toEqual({ screen: 'confirm', options: ['NO', 'YES'], cursor: 0 });
  await page.keyboard.press('Enter'); // NO
  await expect
    .poll(() => titleShows(page))
    .toEqual({ screen: 'menu', options: ['CONTINUE', 'NEW GAME'], cursor: 1 });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await titleShows(page))?.screen).toBe('confirm');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // YES
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const s = await snapshot(page);
  expect(s.map).toBe('overworld');
  expect(s.gems).toBe(0);
  expect(s.cheated).toBe(false);
});

test('a damaged save is ignored: the title offers only NEW GAME', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  await page.evaluate(() => {
    window.localStorage.setItem('dungeon-delve:save', '{"version":1,"map":"the-moon"}');
  });
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['NEW GAME']);
  await page.evaluate(() => window.localStorage.setItem('dungeon-delve:save', '{oops'));
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['NEW GAME']);
  expect(watched.errors).toEqual([]);
});

test('the inventory shows a map of the dungeon rooms Jarrett has been in, kept in the save', async ({
  page,
}) => {
  const watched = watchPage(page);
  const mapShown = async () => {
    await page.keyboard.press('i');
    await expect.poll(() => sceneNow(page)).toBe('Inventory');
    const m = (await page.evaluate(() => window.__game?.inventory()))?.map ?? null;
    await page.keyboard.press('i');
    await expect.poll(() => sceneNow(page)).toBe('Game');
    return m;
  };
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect(await mapShown()).toEqual({
    name: 'Hollow Oak',
    rooms: [{ x: 1, y: 3, current: true, boss: false }],
  });
  await page.evaluate(() => window.__game?.goToRoom(1, 2)); // the hub
  await page.evaluate(() => window.__game?.goToRoom(0, 2)); // the west room
  expect((await mapShown())?.rooms).toEqual([
    { x: 0, y: 2, current: true, boss: false },
    { x: 1, y: 2, current: false, boss: false },
    { x: 1, y: 3, current: false, boss: false },
  ]);

  // Back at the entrance (a save point), then reload and continue: the map is kept.
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  await reloadToTitle(page);
  await page.keyboard.press('Enter'); // CONTINUE
  await expect.poll(() => sceneNow(page)).toBe('Game');
  expect((await mapShown())?.rooms).toHaveLength(3);

  // Outdoors there is no dungeon map.
  await reloadToTitle(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // YES, start over
  await expect.poll(() => sceneNow(page)).toBe('Game');
  expect(await mapShown()).toBeNull();
  expect(watched.errors).toEqual([]);
});

test('Walker waits in the village, tells the story and hands over the sword and shield', async ({
  page,
}) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const inventory = () => page.evaluate(() => window.__game?.inventory() ?? null);
  const s = await snapshot(page);
  expect(s.walker).toEqual({ x: 216, y: 79 });
  expect(s.talking).toBeNull();
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect((await hud())?.weapon).toBe(''); // no sword yet
  // Empty-handed but for Fireball: Space by himself does nothing. Keys are handled
  // in order, so once the X that follows has switched modes, the Space was handled too.
  await page.keyboard.press('Space');
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');
  expect((await snapshot(page)).swings).toBe(0);
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('near');

  // Beside him, facing him: Space starts the talk, and the game waits.
  await page.evaluate(() => window.__game?.placeHero(204, 79, 'right'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).talking?.page).toBe(0);
  expect((await snapshot(page)).talking?.lines).toEqual(['HELLO, JARRETT. I AM WALKER.']);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowLeft');
  expect((await snapshot(page)).player).toEqual({ x: 204, y: 79 });
  expect((await snapshot(page)).swings).toBe(0); // the press turned no page into a swing

  // Page by page; the sword and shield arrive with the page that offers them.
  const pages: string[][] = [];
  let sword = -1;
  for (;;) {
    const talking = (await snapshot(page)).talking;
    if (!talking) break;
    pages.push(talking.lines);
    if (sword < 0 && (await snapshot(page)).sounds.chest > 0) {
      sword = talking.page;
      // The status bar shows the sword at once, while he is still talking.
      expect((await hud())?.weapon).toBe('sword-icon');
    }
    await page.keyboard.press('Space');
    await expect
      .poll(async () => (await snapshot(page)).talking?.page ?? -1)
      .not.toBe(talking.page);
  }
  expect(pages.length).toBeGreaterThanOrEqual(8);
  expect(pages.flat().join(' ')).toContain('TAKE THESE: A SWORD AND A SHIELD.');
  expect(pages[sword]?.join(' ')).toContain('TAKE THESE');
  const after = await snapshot(page);
  expect((await hud())?.weapon).toBe('sword-icon');
  expect(after.walker).toBeNull(); // gone in a shimmer
  expect(after.opened).toContain('walker/village');
  expect(after.saves).toBe(2); // the village is a save point: saved again with the gifts
  await page.keyboard.press('i');
  await expect
    .poll(async () => (await inventory())?.slots)
    .toEqual({
      near: 'Wooden Sword',
      far: '',
      spell: 'Fireball',
      shield: 'Wooden Shield',
    });
  await page.keyboard.press('i');

  // Continue later: he's gone, and the gifts are kept.
  await reloadToTitle(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  expect((await snapshot(page)).walker).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).swings).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('Walker gives a hint at dungeon 1, and waits outside once its shard is found', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect((await snapshot(page)).walker).toEqual({ x: 232, y: 111 });
  const hint = await talkToWalker(page);
  expect(hint[0]?.join(' ')).toContain('THIS IS HOLLOW OAK.');
  expect(hint.flat().join(' ')).toContain('THROWING DAGGERS');
  let s = await snapshot(page);
  expect(s.walker).toBeNull();
  expect(s.opened).toContain('walker/dungeon1');

  // Beat the Treant and take the shard.
  await page.evaluate(() => window.__game?.goToRoom(1, 1));
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 1, row: 0 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('treant');
  await page.evaluate(() => window.__game?.setBossHealth(1));
  const bx = (await snapshot(page)).boss?.x ?? 0;
  await page.evaluate((x) => window.__game?.placeHero(x, 120, 'up'), bx);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const shard = (await snapshot(page)).pickups.find((p) => p.kind === 'shard');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), shard ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).shards).toBe(1);

  // Out through the entrance's doorway: Walker is waiting by the archway.
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 10_000 }).toBe('overworld');
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  // The archway room's enemies appear where he comes out; this test is about Walker.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.clearEnemies());
  expect((await snapshot(page)).walker).toEqual({ x: 216, y: 79 });
  const after = await talkToWalker(page);
  expect(after[0]?.join(' ')).toContain('SEVEN MORE TO FIND.');
  expect(after.flat().join(' ')).toContain('PRESS X TO SWITCH');
  s = await snapshot(page);
  expect(s.walker).toBeNull();
  expect(s.opened).toContain('walker/dungeon1-done');
  expect(watched.errors).toEqual([]);
});

test('a new game starts at the village gate; a house’s walls stop Jarrett', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  let s = await snapshot(page);
  expect(s.room).toEqual({ col: 4, row: 7 });
  expect(s.region).toBe('village');
  // The west street: a house whose walls fill columns 3–7, rows 5–7. Its steps (column 5,
  // below the door) lead into the shop, so walk up into the wall beside them, at column 4.
  await page.evaluate(() => window.__game?.goToRoom(3, 6));
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.placeHero(72, 142, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(134); // row 8's top + his 6-px feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  s = await snapshot(page);
  expect(s.player.y).toBe(134);
  expect(s.region).toBe('village');
  expect(watched.errors).toEqual([]);
});

test('north of Hollow Oak lie the vault grounds, and the vault door stays shut', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // From the forest room east of the archway, up through its north gap.
  await page.evaluate(() => window.__game?.goToRoom(4, 5));
  await page.evaluate(() => window.__game?.clearEnemies());
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 4, row: 4 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('vault');

  // The vault's door, in the room to the west: columns 14–15 of its south face (row 3).
  await page.evaluate(() => window.__game?.goToRoom(3, 4));
  await page.evaluate(() => window.__game?.placeHero(240, 90, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(70); // row 4's top + his 6-px feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  const s = await snapshot(page);
  expect(s.player.y).toBe(70);
  expect(s.opened.filter((id) => id.startsWith('overworld/'))).toEqual([]);
  expect(watched.errors).toEqual([]);
});

test('west of the meadows lies the marsh, whose ponds stop Jarrett', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // From the west meadow, out through its west gap (rows 4–5).
  await page.evaluate(() => window.__game?.goToRoom(3, 7));
  await page.evaluate(() => window.__game?.clearEnemies());
  // goToRoom puts him at the room's start cell, which can be next to a robot: let any knockback end.
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(60, 94, 'left'));
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 2, row: 7 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('marsh');

  // A pond in the north-west of the marsh fills columns 7–10, rows 4–6: walk up into it.
  await page.evaluate(() => window.__game?.goToRoom(0, 4));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(136, 126, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(118); // row 7's top + his 6-px feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).player.y).toBe(118);
  expect(watched.errors).toEqual([]);
});

test('east of the vault grounds lie the ruins, whose broken walls stop Jarrett', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // From the vault grounds' south-east room, out through its new east gap (rows 4–5).
  await page.evaluate(() => window.__game?.goToRoom(4, 4));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(260, 94, 'right'));
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 5, row: 4 });
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('ruins');

  // A ruined wall fills columns 13–15, rows 6–7, of Sunken Crypt's clearing: walk up into it.
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(232, 142, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(134); // row 8's top + his 6-px feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).player.y).toBe(134);
  expect(watched.errors).toEqual([]);
});

test('north of the forest rise the mountains; the mine cave is sealed rock', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // From the forest edge north of the vault grounds, up through its new north gap.
  await page.evaluate(() => window.__game?.goToRoom(3, 2));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 3, row: 1 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('mountains');

  // Stonecrag Mine's cave (columns 9–11, rows 1–3): its rock stops him beside the doorway.
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(184, 90, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(70); // row 4's top + his 6-px feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).player.y).toBe(70);

  // The far north-east is the volcano edge.
  await page.evaluate(() => window.__game?.goToRoom(7, 0));
  expect((await snapshot(page)).region).toBe('volcano');
  expect(watched.errors).toEqual([]);
});

test('the village shop: in through the house door, buy from the shopkeeper, and back out', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.setGems(100));
  // The west street's house: its steps (column 5, row 8) lead inside. Walk west along the path onto them.
  await page.evaluate(() => window.__game?.goToRoom(3, 6));
  await page.evaluate(() => window.__game?.placeHero(136, 142, 'left'));
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 10_000 }).toBe('shop');
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);

  // Up to the counter, and talk to the shopkeeper behind it.
  await page.evaluate(() => window.__game?.placeHero(152, 120, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(86); // the counter's row 4 stops him
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Space');
  await expect.poll(() => sceneNow(page)).toBe('Shop');
  const shop = () => page.evaluate(() => window.__game?.shop() ?? null);
  expect(await shop()).toEqual({
    cursor: 0,
    items: [
      { name: 'Health Potion', price: 10, owned: false },
      { name: 'Mana Brew', price: 15, owned: false },
      { name: 'Iron Shield', price: 80, owned: false },
    ],
    gems: 100,
    message: 'WELCOME! WHAT WILL IT BE?',
  });

  // A Health Potion, then the Iron Shield; then not enough gems for a Mana Brew.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await shop())?.gems).toBe(90);
  expect((await shop())?.message).toBe('THANK YOU!');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await shop())?.gems).toBe(10);
  expect((await shop())?.items[2]?.owned).toBe(true);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await shop())?.message).toBe('NOT ENOUGH GEMS.');
  expect((await shop())?.gems).toBe(10);

  // Leave: the purchases are his, and the Iron Shield is in his hand.
  await page.keyboard.press('Escape');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const s = await snapshot(page);
  expect(s.gems).toBe(10);
  expect(s.potions).toEqual({ health: 2, mana: 1 });
  await page.keyboard.press('i');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots.shield)
    .toBe('Iron Shield');
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Game');

  // Out through the shop's doorway, onto the path beside the steps.
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).map, { timeout: 10_000 }).toBe('overworld');
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  expect((await snapshot(page)).room).toEqual({ col: 3, row: 6 });
  expect(watched.errors).toEqual([]);
});

/** Walks Jarrett into a cell until a test passes (a chest opens, a map changes). */
async function holdUntil(page: Page, key: string, done: () => Promise<boolean>): Promise<void> {
  await page.keyboard.down(key);
  await expect.poll(done, { timeout: 10_000 }).toBe(true);
  await page.keyboard.up(key);
}

test('a false wall sounds hollow, opens on a second strike, and hides a secret cave', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // The forest's dead end: a false wall at column 2, row 4, with a hole behind it.
  await page.evaluate(() => window.__game?.goToRoom(0, 3));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(56, 78, 'left'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.hollow).toBe(1);
  expect((await snapshot(page)).opened).not.toContain('overworld/0,3/2,4');
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('overworld/0,3/2,4');
  expect((await snapshot(page)).sounds.crumble).toBe(1);

  // Through it and down the hole: a cave with two chests.
  await holdUntil(page, 'ArrowLeft', async () => (await snapshot(page)).map === 'caves');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const before = await snapshot(page);
  for (const x of [120, 200]) {
    await page.evaluate((cx) => window.__game?.placeHero(cx, 86, 'up'), x);
    const opened = (await snapshot(page)).opened.length;
    await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).opened.length > opened);
    await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]);
  }
  const s = await snapshot(page);
  expect(s.potions.mana).toBe(before.potions.mana + 1);
  expect(s.gems).toBe(before.gems + 20);

  // Back up, beside the false wall, which stays open.
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await holdUntil(page, 'ArrowDown', async () => (await snapshot(page)).map === 'overworld');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  expect((await snapshot(page)).room).toEqual({ col: 0, row: 3 });
  expect(watched.errors).toEqual([]);
});

test('a secret cave in the ruins holds a heart container, kept in the save', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(7, 4));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  // The false wall at column 16, row 3, struck twice from the left.
  await page.evaluate(() => window.__game?.placeHero(248, 62, 'right'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.hollow).toBe(1);
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.crumble).toBe(1);
  await holdUntil(page, 'ArrowRight', async () => (await snapshot(page)).map === 'caves');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  // The chest in the middle: a heart container.
  await page.evaluate(() => window.__game?.placeHero(152, 86, 'up'));
  await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).health.max === 8);
  const room = (await snapshot(page)).room;
  expect((await snapshot(page)).opened).toContain(`caves/${room.col},${room.row}/heart`);
  // Saved on the way out (the village's save point), and kept on continuing.
  await page.evaluate(() => window.__game?.goToRoom(0, 0));
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await holdUntil(page, 'ArrowDown', async () => (await snapshot(page)).map === 'overworld');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  await page.evaluate(() => window.__game?.goToRoom(4, 7));
  await reloadToTitle(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  expect((await snapshot(page)).health.max).toBe(8);
});

test('a stone in the east meadow hides a hole down to a cave', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(5, 7));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  expect((await snapshot(page)).stones).toEqual([{ cx: 14, cy: 6 }]);
  // Lean on it from the west: it slides east, off the hole, and walking on takes him down.
  await page.evaluate(() => window.__game?.placeHero(218, 110, 'right'));
  await holdUntil(page, 'ArrowRight', async () => (await snapshot(page)).map === 'caves');
  expect((await snapshot(page)).sounds.push).toBe(1);
});

test('the Axe smashes boulders and cracked walls; the sword only clinks; Fireball burns thorns', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  const opened = async () =>
    (await snapshot(page)).opened.filter((id) => id.startsWith('overworld/'));
  // The start room's boulder fills columns 4–5, rows 6–7. Strike it from above with the sword.
  await page.evaluate(() => window.__game?.placeHero(72, 92, 'down'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.block).toBe(1);
  expect(await opened()).toEqual([]);
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();

  // The Axe, chosen in the inventory: one blow breaks the whole boulder.
  await page.evaluate(() => window.__game?.giveItem('axe'));
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Inventory');
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots.near)
    .toBe('Axe');
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  await page.keyboard.press('Space');
  await expect
    .poll(opened)
    .toEqual(['overworld/4,7/4,6', 'overworld/4,7/5,6', 'overworld/4,7/4,7', 'overworld/4,7/5,7']);
  expect((await snapshot(page)).sounds.crumble).toBe(1);
  // Where it stood, he walks on through.
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(120);
  await page.keyboard.up('ArrowDown');

  // A cracked wall (put here for the test; they're placed in M4.4/M5) smashes too.
  await page.evaluate(() => window.__game?.setCell(11, 5, 'x'));
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'right'));
  await expect.poll(async () => (await snapshot(page)).sword).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(opened).toContain('overworld/4,7/11,5');

  // A thorn bush, two cells to his left: a Fireball burns it.
  await page.evaluate(() => window.__game?.setCell(7, 5, 't'));
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'left'));
  await page.keyboard.press('c');
  await expect.poll(opened).toContain('overworld/4,7/7,5');
  expect((await snapshot(page)).sounds.burn).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('a Fireball burns the thorns in front of a secret cave in the forest', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // West of the vault grounds: thorns at column 1, row 7, with a hole behind them.
  await page.evaluate(() => window.__game?.goToRoom(2, 3));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(44, 126, 'left'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('overworld/2,3/1,7');
  await holdUntil(page, 'ArrowLeft', async () => (await snapshot(page)).map === 'caves');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const gems = (await snapshot(page)).gems;
  await page.evaluate(() => window.__game?.placeHero(152, 86, 'up'));
  await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).gems === gems + 30);
  expect(watched.errors).toEqual([]);
});
