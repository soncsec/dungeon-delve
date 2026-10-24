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

/**
 * Watches the game until `done` holds, giving up after `gameMs` of game time, not real time, and
 * returns the snapshot it held in (or the last one) for the test to check. A loaded browser can
 * fall so far behind that its game clock runs at a fifth of real time (Phaser slows the game
 * rather than leap ahead when a frame takes over 200 ms), so a real-time limit could run out
 * before something that takes game time has happened. And the page records a snapshot on every
 * frame, read back in batches, so a moment that lasts only a frame or two can't fall between
 * two looks, however slow the round trips to the browser.
 */
async function untilGame(
  page: Page,
  done: (s: GameSnapshot) => boolean,
  gameMs = 5_000,
): Promise<GameSnapshot> {
  // Already so (the common case): no recording needed.
  const now = await snapshot(page);
  if (done(now)) return now;
  // Each recording has its own number, so an earlier one still waiting on its next frame
  // ends rather than running alongside (a snapshot every frame is costly on a slow browser).
  await page.evaluate(() => {
    const w = window as unknown as { __frames?: GameSnapshot[]; __recording?: number };
    const mine = (w.__recording ?? 0) + 1;
    w.__recording = mine;
    w.__frames = [];
    const record = (): void => {
      if (w.__recording !== mine) return;
      const s = window.__game?.snapshot();
      if (s) w.__frames?.push(s);
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  const start = now.playMs;
  for (;;) {
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames?: GameSnapshot[] };
      const taken = w.__frames ?? [];
      w.__frames = [];
      return taken;
    });
    // No frames yet: one look now, which also says so if the game scene isn't running.
    for (const s of frames.length > 0 ? frames : [await snapshot(page)]) {
      if (done(s) || s.playMs - start > gameMs) {
        await page.evaluate(() => {
          const w = window as unknown as { __recording?: number };
          w.__recording = (w.__recording ?? 0) + 1;
        });
        return s;
      }
    }
    await page.waitForTimeout(20);
  }
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
/**
 * Whether nothing is still sliding from a hit: no enemy, and not Jarrett (a
 * press is ignored while he is knocked back, and the push carries him on).
 */
async function settled(page: Page): Promise<boolean> {
  const s = await snapshot(page);
  return !s.knockedBack && !s.enemies.some((x) => x.knocked);
}

/**
 * Presses Space and waits for that swing to start and then end. (Waiting only for
 * "no sword out" can pass before the swing starts, so the next press is lost in it.)
 */
async function swingOnce(page: Page): Promise<void> {
  // Once he is free to: a press while he is knocked back is dropped.
  const ready = await untilGame(page, (s) => !s.knockedBack);
  await page.keyboard.press('Space');
  expect((await untilGame(page, (s) => s.swings === ready.swings + 1)).swings).toBe(
    ready.swings + 1,
  );
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();
}

async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toMatch(/^(Title|Game)$/);
  if ((await sceneNow(page)) === 'Title') await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Game');
  const start = await snapshot(page);
  // Only the village talk: Walker at a dungeon entrance is left for the test. Space starts
  // it; then the finishTalk hook turns the rest of its ten pages at once, gifts and all.
  // (Pressing through them took about 8 s of WebKit's 30 s per test here; the village
  // talk's own test still pages through it.)
  if (start.map === 'overworld' && start.walker) {
    const w = start.walker;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), w);
    await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snapshot(page)).talking).not.toBeNull();
    await page.evaluate(() => window.__game?.finishTalk());
    await expect.poll(async () => (await snapshot(page)).walker).toBeNull();
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

test('a desktop shows no touch controls', async ({ page }) => {
  await openGame(page, '?dungeon=1');
  await expect(page.locator('#touch')).toHaveCount(0);
});

test('arrow keys move the player and it stays on screen', async ({ page }) => {
  await openGame(page);
  // Row 7 of the start room, which trees close at the west edge. (Row 5, where he
  // starts, is the way west out of the village.)
  await page.evaluate(() => window.__game?.placeHero(160, 126, 'down'));
  const start = (await snapshot(page)).player;
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(start.x - 20);
  await page.waitForTimeout(2000); // long enough to reach the edge
  await page.keyboard.up('ArrowLeft');
  const left = await snapshot(page);
  expect(left.room).toEqual({ col: 8, row: 11 });
  expect(left.player.x).toBeGreaterThan(0);
  expect(left.player.y).toBe(start.y);
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
  // The art's side row faces right: walking right plays it as drawn.
  expect((await snapshot(page)).heroSprite).toEqual({
    anim: 'jarrett:walk-right',
    flipped: false,
  });
  await page.keyboard.up('ArrowRight');

  // Walking left plays the same row mirrored, and he stands facing left.
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).player.x).toBeLessThan(55);
  expect((await snapshot(page)).heroSprite).toEqual({ anim: 'jarrett:walk-right', flipped: true });
  await page.keyboard.up('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).heroSprite)
    .toEqual({ anim: null, flipped: true });
});

test('walking through a gap slides to the next room, and back', async ({ page }) => {
  await openGame(page);
  expect((await snapshot(page)).room).toEqual({ col: 8, row: 11 });
  // The start room's west gap is at rows 4–5; Jarrett starts in row 5.
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 7, row: 11 });
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
    .toEqual({ col: 8, row: 11 });
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
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();

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
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();

  // It was knocked back; step up to it and swing again.
  // Aim only once it, and Jarrett, have stopped sliding from the last hit.
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
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
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
    manaBar: 0, // no mana bar until he knows a spell
    manaWidth: 0,
    potions: { health: '1', mana: '1' },
    keys: null, // shown in dungeons only
  });
  await page.evaluate(() => window.__game?.giveItem('fireball'));
  await expect.poll(async () => (await hud())?.manaBar).toBe(44);
  expect((await hud())?.manaWidth).toBe(42); // full

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
    .toEqual({ col: 7, row: 11 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).enemies).toHaveLength(2);
  await page.evaluate(() => window.__game?.holdEnemies(true));

  // Stand just above the first robot, facing down, and swing until it's gone.
  for (let swing = 0; swing < 4 && (await snapshot(page)).defeated === 0; swing++) {
    // Aim only once it, and Jarrett, have stopped sliding from the last hit.
    await expect.poll(() => settled(page)).toBe(true);
    const r = (await snapshot(page)).enemies[0];
    if (!r) break;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y - 14, 'down'), r);
    await swingOnce(page);
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
    // Aim only once it, and Jarrett, have stopped sliding from the last hit.
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
  await page.evaluate(() => window.__game?.giveItem('fireball')); // dungeon 2's prize
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
  await page.evaluate(() => window.__game?.giveItem('fireball'));
  // Empty: refilling to a Fireball's 25 takes 2 s, far longer than the key press
  // takes even on a busy machine. (From 20 it took only 0.4 s.)
  await page.evaluate(() => window.__game?.setMana(0));
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  const s = await snapshot(page);
  expect(s.casts).toBe(0);
  expect(s.fireballs).toEqual([]);
});

test('one Fireball defeats a robot', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.giveItem('fireball'));
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const start = await snapshot(page);
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('robot', x, y + 40), start.player);
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).casts).toBe(1);
});

test('Lightning stuns an enemy, and powers a crystal switch that opens its gates', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => {
    window.__game?.giveItem('lightning'); // Sunken Crypt's prize
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the hub
    window.__game?.clearEnemies();
  });
  // A robot two cells below him: one bolt stuns it, without hurting it.
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'down'));
  await page.evaluate(() => window.__game?.spawnEnemy('robot', 160, 130));
  await page.evaluate(() => window.__game?.holdEnemies(false));
  await page.keyboard.press('c');
  const robot = async () => (await snapshot(page)).enemies[0];
  await expect.poll(async () => (await robot())?.stunned, { intervals: [50] }).toBe(true);
  const stunned = await robot();
  expect(stunned?.health).toBe(2);
  expect((await snapshot(page)).casts).toBe(1);
  expect((await snapshot(page)).sounds.zap).toBeGreaterThanOrEqual(1);
  // Stunned, it stands still, and touching it costs nothing.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), {
    x: stunned?.x ?? 0,
    y: stunned?.y ?? 0,
  });
  await page.waitForTimeout(400);
  expect((await robot())?.stunned).toBe(true);
  expect((await robot())?.x).toBe(stunned?.x);
  expect((await robot())?.y).toBe(stunned?.y);
  expect((await snapshot(page)).health.points).toBe((await snapshot(page)).health.max);
  await page.evaluate(() => window.__game?.clearEnemies());

  // A crystal switch in the wall (column 4, row 1), and a gate across the way north.
  await page.evaluate(() => {
    window.__game?.setCell(4, 1, 'z');
    window.__game?.setCell(9, 1, 'g');
    window.__game?.setCell(10, 1, 'g');
    window.__game?.setMana(100);
  });
  // The gate stops him.
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(40);
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).room).toEqual({ col: 1, row: 2 });
  expect((await snapshot(page)).player.y).toBeGreaterThanOrEqual(32);
  // A bolt up into the switch powers it, and the gate opens: he walks on north.
  await page.evaluate(() => window.__game?.placeHero(72, 46, 'up'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon1/1,2/4,1');
  expect((await snapshot(page)).sounds.switch).toBe(1);
  await page.evaluate(() => window.__game?.placeHero(160, 46, 'up'));
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
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
  expect((await untilGame(page, (s) => s.manaBoosted)).manaBoosted).toBe(true);
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
const BODY_HEIGHT = {
  robot: 10,
  bird: 14,
  eye: 18,
  ghost: 22,
  wolf: 12,
  snake: 10,
  mushroom: 14,
  toad: 14,
} as const;

for (const kind of ['bird', 'eye', 'ghost', 'wolf', 'snake', 'mushroom', 'toad'] as const) {
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
      // Aim only once it, and Jarrett, have stopped sliding from the last hit.
      await expect.poll(() => settled(page)).toBe(true);
      const e = (await snapshot(page)).enemies[0];
      if (!e) break;
      await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'down'), {
        x: e.x,
        y: e.y - BODY_HEIGHT[kind] - 2,
      });
      await swingOnce(page);
    }
    expect((await snapshot(page)).defeated).toBe(1);
    expect(watched.errors).toEqual([]);
  });
}

/** A dungeon 1 room (the hub) emptied, with Jarrett in the middle and full of hearts. */
async function emptyHub(page: Page): Promise<void> {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => {
    window.__game?.goToRoom(1, 2);
    window.__game?.clearEnemies();
    window.__game?.placeHero(160, 94, 'left');
  });
}

test('the snake spits venom along a line at Jarrett, then coils', async ({ page }) => {
  const watched = watchPage(page);
  await emptyHub(page);
  // Level with him, to his left: it spits right, along the row.
  await page.evaluate(() => window.__game?.spawnEnemy('snake', 60, 94));
  await expect.poll(async () => (await snapshot(page)).shotsFired, { timeout: 5_000 }).toBe(1);
  const shot = (await snapshot(page)).enemyShots[0];
  expect(shot?.y).toBeCloseTo(89, 0); // from the middle of its body
  await expect
    .poll(async () => (await snapshot(page)).enemyShots[0]?.x ?? 999)
    .toBeGreaterThan((shot?.x ?? 0) + 8);
  // It coils: no second spit straight away.
  await page.waitForTimeout(400);
  expect((await snapshot(page)).shotsFired).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('the mushroom puffs a ring of spores that drift a little way', async ({ page }) => {
  const watched = watchPage(page);
  await emptyHub(page);
  // Its first puff would come 2.6 to 3.6 s (game time) after it appears: bring it on now.
  await page.evaluate(() => {
    window.__game?.spawnEnemy('mushroom', 240, 60);
    window.__game?.enemiesShootNow();
  });
  await expect.poll(async () => (await snapshot(page)).shotsFired).toBeGreaterThan(0);
  // One puff is six spores, all at once.
  expect((await snapshot(page)).shotsFired).toBe(6);
  // Spores go only a short way, then are gone.
  const settled = await untilGame(page, (s) => s.enemyShots.length === 0);
  expect(settled.enemyShots).toEqual([]);
  expect(settled.shotsFired).toBe(6);
  expect(watched.errors).toEqual([]);
});

test('the toad sits, then hops at Jarrett', async ({ page }) => {
  const watched = watchPage(page);
  await emptyHub(page);
  await page.evaluate(() => window.__game?.spawnEnemy('toad', 260, 94));
  const toad = async () => (await snapshot(page)).enemies[0];
  await expect
    .poll(async () => (await toad())?.charging, { timeout: 5_000, intervals: [50] })
    .toBe(true);
  await expect.poll(async () => (await toad())?.x ?? 999).toBeLessThan(245);
  expect(watched.errors).toEqual([]);
});

test('a find from a chest is held up over his head with a success tune, and the game waits', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  // The entrance's chest (column 4, row 3) holds a key.
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
    window.__game?.placeHero(88, 63, 'left');
    window.__game?.bump(4, 3);
  });
  await expect.poll(async () => (await snapshot(page)).pickups.length).toBe(1);
  const key = (await snapshot(page)).pickups[0];
  expect(key?.kind).toBe('key');
  // On the key: he holds it up, and the game waits. Watched frame by frame inside the
  // page (the hold is 1.5 s, which a slow browser's round trips could miss entirely):
  // the arrow is held down as soon as the hold begins, and he doesn't move until it ends.
  const hold = await page.evaluate(
    async ({ x, y }) => {
      const g = window.__game;
      const frame = () => new Promise((done) => requestAnimationFrame(() => done(null)));
      g?.placeHero(x, y, 'left');
      for (let i = 0; i < 600 && !g?.snapshot()?.holding; i++) await frame();
      const start = g?.snapshot() ?? null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
      let frames = 0;
      let moved = false;
      for (let s = g?.snapshot(); s?.holding; s = g?.snapshot()) {
        frames += 1;
        if (s.player.x !== start?.player.x || s.player.y !== start?.player.y) moved = true;
        await frame();
      }
      return { start, frames, moved };
    },
    key ?? { x: 0, y: 0 },
  );
  const held = hold.start;
  expect(held?.holding).toBe(true);
  expect(held?.keys).toBe(1);
  expect(held?.facing).toBe('down'); // he turns to face you
  expect(held?.sounds.found).toBe(1);
  expect(held?.sounds.chest).toBe(1); // only the chest's opening; the find has its own tune
  expect(hold.frames).toBeGreaterThan(0);
  expect(hold.moved).toBe(false);
  // Then, the arrow still down, he walks on.
  await expect
    .poll(async () => (await snapshot(page)).player.x)
    .toBeGreaterThan(held?.player.x ?? 0);
  await page.evaluate(() =>
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' })),
  );
  expect(watched.errors).toEqual([]);
});

test('a heart container is held up too, wherever it lies; a dropped gem is not', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
    window.__game?.spawnPickup('gem', 120, 94);
    window.__game?.spawnPickup('heart-container', 200, 94);
  });
  await page.evaluate(() => window.__game?.placeHero(120, 94, 'right'));
  await expect.poll(async () => (await snapshot(page)).gems).toBe(1);
  expect((await snapshot(page)).holding).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(200, 94, 'right'));
  expect((await untilGame(page, (s) => s.holding)).holding).toBe(true);
  expect((await snapshot(page)).health.max).toBe(8);
  expect((await untilGame(page, (s) => !s.holding, 10_000)).holding).toBe(false);
  expect(watched.errors).toEqual([]);
});

/** The hub emptied (see emptyHub), with a pine whose trunk is at cell (10,5): its art hides cells 9-11 × 3-5. */
async function hubWithPine(page: Page): Promise<void> {
  await emptyHub(page);
  await page.evaluate(() => window.__game?.setCell(10, 5, 'T'));
}

test('a walking enemy keeps out from under a tree: a toad hopping at Jarrett stops at its branches', async ({
  page,
}) => {
  const watched = watchPage(page);
  await hubWithPine(page);
  // Jarrett above the tree, the toad below it, both in column 10: it hops straight at him.
  await page.evaluate(() => {
    window.__game?.placeHero(168, 40, 'down');
    window.__game?.spawnEnemy('toad', 168, 127); // row 7, the bottom row of floor
  });
  let highest = 999;
  let hopped = false;
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const t = (await snapshot(page)).enemies[0];
    if (t) {
      highest = Math.min(highest, t.y);
      hopped ||= t.charging;
    }
  }
  expect(hopped).toBe(true);
  expect(highest).toBeLessThan(120); // it came up towards him...
  expect(highest).toBeGreaterThanOrEqual(110); // ...but its body never went in under the tree (row 5 ends at y 96)
  expect(watched.errors).toEqual([]);
});

test('an enemy put under a tree by hand walks out at its own pace, never jumping', async ({
  page,
}) => {
  const watched = watchPage(page);
  await hubWithPine(page);
  // Inside the pine's branches above its trunk (cells 10-11 × 3-4), where no enemy starts in
  // the game; a snap to a cell line from there is 8-14 px. Each
  // frame it may move no further than its walking speed allows for that frame's game time.
  const worst = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const g = window.__game;
        g?.spawnEnemy('robot', 176, 72);
        let last = g?.snapshot();
        let over = 0;
        let frames = 0;
        const tick = () => {
          const s = g?.snapshot();
          const a = last?.enemies[0];
          const b = s?.enemies[0];
          if (s && last && a && b) {
            const allowed = (30 * (s.playMs - last.playMs)) / 1000 + 0.5; // robot speed 30 px/s
            over = Math.max(over, Math.hypot(b.x - a.x, b.y - a.y) - allowed);
          }
          last = s;
          frames += 1;
          if (frames < 40) requestAnimationFrame(tick);
          else resolve(over);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(worst).toBeLessThanOrEqual(0);
  expect(watched.errors).toEqual([]);
});

test('an enemy beaten over a tree leaves its drop on open ground nearby, not in the tree', async ({
  page,
}) => {
  const watched = watchPage(page);
  await hubWithPine(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.spawnEnemy('bird', 168, 95); // over the trunk
    window.__game?.nextDrop('gem');
    window.__game?.placeHero(192, 95, 'left'); // beside the tree, facing it
  });
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  await expect.poll(async () => (await snapshot(page)).pickups.length).toBe(1);
  const gem = (await snapshot(page)).pickups[0];
  // The nearest open cell he can reach: the one just below the trunk, (10,6).
  expect(gem).toEqual({ kind: 'gem', x: 168, y: 111 });
  expect(watched.errors).toEqual([]);
});

test('the flying eye shoots at Jarrett, and a shot costs half a heart', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // Within the distance it keeps, so it circles and shoots rather than closing in.
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('eye', x + 90, y), start.player);
  // A shot is only in the air for half a second or so, so count shots fired rather than catch one.
  expect((await untilGame(page, (s) => s.shotsFired > 0, 10_000)).shotsFired).toBeGreaterThan(0);
  expect((await untilGame(page, (s) => s.health.points === 5, 10_000)).health.points).toBe(5);
});

test('the wolf charges when Jarrett is in line with it', async ({ page }) => {
  await openGame(page);
  const start = await snapshot(page);
  // To his left, on open grass (to his right is under a pine's branches, where walkers can't go).
  await page.evaluate(({ x, y }) => window.__game?.spawnEnemy('wolf', x - 100, y), start.player);
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
    // No far weapon or spell yet: the daggers are dungeon 1's prize, the Fireball dungeon 2's.
    slots: { near: 'Wooden Sword', far: '', spell: '', shield: 'Wooden Shield' },
    map: null, // outdoors: no dungeon map
    // ...but the world map, on its own page: so far only the screen he starts on.
    world: {
      cols: 16,
      rows: 12,
      cells: [{ x: 8, y: 11, region: 'village', current: true, entrance: null }],
    },
    page: 'items',
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
    .toEqual({ col: 7, row: 11 });
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
  expect(s.room).toEqual({ col: 8, row: 11 });
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
  await page.evaluate(() => {
    window.__game?.giveItem('fireball');
    window.__game?.setMana(0);
  });
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

test('out of dungeon 1 through its doorway, and back in through the archway', async ({ page }) => {
  const watched = watchPage(page);
  // From the dungeon's entrance (owner 2026-10-21): a new game's ten-page talk with
  // Walker and the walk from the village made this test take up to 35 s of its 30 s
  // in WebKit here. The reachability unit tests cover the way from the village.
  await openGame(page, '?dungeon=1');
  // Enemies held and out of the way: held ones still hurt to touch, and a knock sideways
  // would push him off line with the doorways.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.clearEnemies());
  const start = await snapshot(page);
  expect(start.map).toBe('dungeon1');
  expect(start.room).toEqual({ col: 1, row: 3 });

  /** Holds a key until a trip to another map starts (so he can't walk on after he arrives). */
  const travel = async (key: 'ArrowUp' | 'ArrowDown') => {
    await page.keyboard.down(key);
    await expect
      .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
      .toBe(true);
    await page.keyboard.up(key);
    await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  };

  // Down through the doorway in the entrance's south wall.
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await travel('ArrowDown');
  const outside = await snapshot(page);
  expect(outside.map).toBe('overworld');
  expect(outside.room).toEqual({ col: 6, row: 8 });
  expect(outside.enteredAt).toEqual({ x: 160, y: 78 }); // just below the archway
  expect(outside.facing).toBe('down');

  // And straight back up through the archway's opening.
  await page.evaluate(() => window.__game?.clearEnemies());
  await travel('ArrowUp');
  const inside = await snapshot(page);
  expect(inside.map).toBe('dungeon1');
  expect(inside.room).toEqual({ col: 1, row: 3 });
  expect(inside.enteredAt).toEqual({ x: 160, y: 140 }); // where he arrived
  expect(inside.health.points).toBe(inside.health.max); // nothing touched him on the way
  expect(watched.errors).toEqual([]);
});

test('Bog Grotto’s archway in the marsh opens once Jarrett holds a shard', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(2, 8));
  await page.evaluate(() => window.__game?.clearEnemies());
  // Up into the archway's opening with no shard: he reaches the doorway's row (it ends
  // at y 48) and stands in it a while, and nothing happens. (Waiting for him to get there,
  // rather than a fixed time: a slow browser walks him less far in the same time.)
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  let s = await snapshot(page);
  expect(s.map).toBe('overworld');
  expect(s.travelling).toBe(false);
  expect(s.player.y).toBeLessThan(48); // still in the doorway's row
  // With one shard (dungeon 1's), the way opens.
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('shard', x, y), { x: 160, y: 70 });
  await expect.poll(async () => (await snapshot(page)).shards).toBe(1);
  // He holds it up first, and can't move until he's done.
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  s = await snapshot(page);
  expect(s.map).toBe('dungeon2');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.enteredAt).toEqual({ x: 160, y: 140 });
  expect(watched.errors).toEqual([]);
});

test('Bog Grotto’s prize: a Mana Crystal in the east closet; Walker’s Fireball burns the hub’s thorns', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=2'); // with what dungeon 1 earns: the daggers and the Fireball
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect((await snapshot(page)).mana).toEqual({ current: 100, max: 100 });
  expect((await hud())?.manaBar).toBe(44);

  // The east room: push the stone in the closet's doorway (column 14, row 6) up twice.
  await page.evaluate(() => window.__game?.goToRoom(2, 2));
  await page.evaluate(() => window.__game?.clearEnemies());
  expect((await snapshot(page)).stones).toEqual([{ cx: 14, cy: 6 }]);
  await page.evaluate(() => window.__game?.placeHero(232, 126, 'up'));
  await holdUntil(page, 'ArrowUp', async () => {
    const st = (await snapshot(page)).stones;
    return st.length === 1 && st[0]?.cy === 4;
  });
  // Round the stone, beside the chest at column 14, row 3, and it opens: the crystal drops.
  // (Opened with the bump hook, so he doesn't walk on into the crystal at once.)
  await page.evaluate(() => window.__game?.placeHero(216, 62, 'right'));
  await page.evaluate(() => window.__game?.bump(14, 3));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon2/2,2/14,3');
  const crystal = (await snapshot(page)).pickups.find((p) => p.kind === 'mana-crystal');
  expect(crystal).toBeDefined();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), crystal ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).mana).toEqual({ current: 150, max: 150 });
  let s = await snapshot(page);
  expect(s.opened).toContain('dungeon2/crystal');
  expect(s.announced).toBe(1);
  await expect.poll(async () => (await hud())?.manaBar).toBe(65); // half as long again
  expect((await hud())?.manaWidth).toBe(63);

  // The hub: a Fireball burns the thorns across the way north, and he walks on through.
  await page.evaluate(() => window.__game?.goToRoom(1, 2));
  await page.evaluate(() => window.__game?.clearEnemies());
  await page.evaluate(() => window.__game?.placeHero(152, 46, 'up'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon2/1,2/9,1');
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  s = await snapshot(page);
  expect(s.mana.max).toBe(150);
  expect(watched.errors).toEqual([]);
});

test('a prize left in an opened chest waits there until Jarrett picks it up', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const keyHere = async () => (await snapshot(page)).pickups.some((p) => p.kind === 'key');
  // The entrance's chest (column 4, row 3) opens with Jarrett away from it: the key drops.
  await page.evaluate(() => window.__game?.placeHero(160, 126, 'up'));
  await page.evaluate(() => window.__game?.bump(4, 3));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon1/1,3/4,3');
  expect(await keyHere()).toBe(true);
  // He leaves without it, and comes back: it is still there.
  await page.evaluate(() => window.__game?.goToRoom(0, 2));
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  expect(await keyHere()).toBe(true);
  expect((await snapshot(page)).keys).toBe(0);
  // He takes it; after that it doesn't come back.
  await page.evaluate(() => window.__game?.placeHero(72, 63));
  await expect.poll(async () => (await snapshot(page)).keys).toBe(1);
  await page.evaluate(() => window.__game?.goToRoom(0, 2));
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  expect(await keyHere()).toBe(false);
  expect((await snapshot(page)).keys).toBe(1);

  // The same for an item: the daggers in the west room's closet.
  await page.evaluate(() => window.__game?.goToRoom(0, 2));
  await page.evaluate(() => window.__game?.placeHero(160, 126, 'up'));
  await page.evaluate(() => window.__game?.bump(3, 3));
  const itemHere = async () => (await snapshot(page)).pickups.some((p) => p.kind === 'item');
  await expect.poll(itemHere).toBe(true);
  await page.evaluate(() => window.__game?.goToRoom(1, 2));
  await page.evaluate(() => window.__game?.goToRoom(0, 2));
  expect(await itemHere()).toBe(true);
  expect(watched.errors).toEqual([]);
});

test('Sunken Crypt’s archway in the ruins opens once Jarrett holds two shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  const shards = async () => (await snapshot(page)).shards;
  // Dungeon 1's shard (put at his feet), then out to the overworld.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('shard', x, y), at);
  await expect.poll(shards).toBe(1);
  // He holds it up first, and can't move until he's done.
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(10, 6);
    window.__game?.clearEnemies();
  });
  // With one shard, he stands in the crypt's doorway and nothing happens.
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // A second shard, and the way opens.
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.evaluate(() => window.__game?.spawnPickup('shard', 160, 70));
  await expect.poll(shards).toBe(2);
  // He holds it up first, and can't move until he's done.
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon3');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.enteredAt).toEqual({ x: 160, y: 140 });
  expect(watched.errors).toEqual([]);
});

test('Sunken Crypt’s prize: Lightning, in hand at once; the hub’s crystal switch opens the way north', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=3'); // with the daggers and the Fireball
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(2, 2); // the east crypt
    window.__game?.clearEnemies();
  });
  // Push the stone in the closet's west doorway (column 12, row 5) in, east.
  expect((await snapshot(page)).stones).toEqual([{ cx: 12, cy: 5 }]);
  await page.evaluate(() => window.__game?.placeHero(184, 94, 'right'));
  await holdUntil(
    page,
    'ArrowRight',
    async () => ((await snapshot(page)).stones[0]?.cx ?? 0) >= 14,
  );
  // Round the stone, beside the chest (column 16, row 4), and it opens: Lightning drops.
  await page.evaluate(() => window.__game?.placeHero(248, 78, 'right'));
  await page.evaluate(() => window.__game?.bump(16, 4));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon3/2,2/16,4');
  const bolt = (await snapshot(page)).pickups.find((p) => p.kind === 'item');
  expect(bolt).toBeDefined();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), bolt ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]);

  // In the hub, a bolt up into the switch in the north wall: the gates open, and on he goes.
  await page.evaluate(() => {
    window.__game?.goToRoom(1, 2);
    window.__game?.clearEnemies();
    window.__game?.placeHero(72, 46, 'up');
  });
  await page.keyboard.press('c'); // Lightning is in his hand already
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon3/1,2/4,1');
  await page.evaluate(() => window.__game?.placeHero(160, 46, 'up'));
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
});

test('Stonecrag Mine’s cave in the mountains opens once Jarrett holds three shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(6, 2);
    window.__game?.clearEnemies();
    window.__game?.takeShard(1);
    window.__game?.takeShard(2);
  });
  expect((await snapshot(page)).shards).toBe(2);
  // With two shards, he stands in the cave's mouth and nothing happens.
  await page.evaluate(() => window.__game?.placeHero(168, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // The third shard, and the way opens.
  await page.evaluate(() => {
    window.__game?.takeShard(3);
    window.__game?.placeHero(168, 70, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon4');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.enteredAt).toEqual({ x: 160, y: 140 });
  expect(watched.errors).toEqual([]);
});

test('Stonecrag Mine’s prize: the Axe behind thorns, which smashes the hub’s rubble', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=4'); // with the daggers, the Fireball and Lightning
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(2, 2); // the east drift
    window.__game?.clearEnemies();
    window.__game?.placeHero(184, 94, 'right');
  });
  // A Fireball burns the thorns in the closet's doorway (column 12, row 5).
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon4/2,2/12,5');
  // In, beside the chest (column 14, row 4), and it opens: the Axe drops.
  await page.evaluate(() => window.__game?.placeHero(216, 78, 'right'));
  await page.evaluate(() => window.__game?.bump(14, 4));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon4/2,2/14,4');
  const axe = (await snapshot(page)).pickups.find((p) => p.kind === 'item');
  expect(axe).toBeDefined();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), axe ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]);
  // In the hub, the Axe (in hand at once) smashes the rubble across the way north.
  await page.evaluate(() => {
    window.__game?.goToRoom(1, 2);
    window.__game?.clearEnemies();
    window.__game?.placeHero(152, 46, 'up');
  });
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon4/1,2/9,1');
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
});

test('Thunder Spire’s archway in the mountains opens once Jarrett holds four shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(4, 0);
    window.__game?.clearEnemies();
    for (const n of [1, 2, 3]) window.__game?.takeShard(n);
  });
  expect((await snapshot(page)).shards).toBe(3);
  // With three shards, he stands in the archway and nothing happens.
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // The fourth shard, and the way opens.
  await page.evaluate(() => {
    window.__game?.takeShard(4);
    window.__game?.placeHero(160, 70, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon5');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.enteredAt).toEqual({ x: 160, y: 140 });
  expect(watched.errors).toEqual([]);
});

/** Chooses an item in the bag: down to its slot, then Space until the slot shows `name`. */
async function chooseItem(page: Page, slot: 'near' | 'spell', name: string): Promise<void> {
  const inv = () => page.evaluate(() => window.__game?.inventory());
  const index = slot === 'near' ? 0 : 2;
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await inv())?.cursor).toBe(0);
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await inv())?.cursor).toBe(index);
  for (let i = 0; i < 4 && (await inv())?.slots[slot] !== name; i++) {
    const before = (await inv())?.slots[slot];
    await page.keyboard.press('Space');
    await expect.poll(async () => (await inv())?.slots[slot]).not.toBe(before);
  }
  expect((await inv())?.slots[slot]).toBe(name);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
}

/** Chooses a spell in the bag (the third slot). */
async function chooseSpell(page: Page, name: string): Promise<void> {
  await chooseItem(page, 'spell', name);
}

test('Thunder Spire’s prize: the Ward, caged past thorns and a crystal switch', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=5'); // with the Fireball, Lightning and the Axe
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(0, 2); // the west gallery
    window.__game?.clearEnemies();
    window.__game?.placeHero(168, 78, 'up');
  });
  // A Fireball burns the thorns (column 10, row 2) below the switch.
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon5/0,2/10,2');
  // Lightning, up into the switch in the wall above (column 10, row 1): the cage opens.
  await chooseSpell(page, 'Lightning');
  await page.evaluate(() => window.__game?.placeHero(168, 46, 'up'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon5/0,2/10,1');
  // In the cage, beside the chest (column 7, row 7): the Ward, in his hand at once.
  await page.evaluate(() => window.__game?.placeHero(136, 127, 'left'));
  await page.evaluate(() => window.__game?.bump(7, 7));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon5/0,2/7,7');
  const ward = (await snapshot(page)).pickups.find((p) => p.kind === 'item');
  expect(ward).toBeDefined();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), ward ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]);
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  // In his hand: the bag's spell slot shows it.
  await page.keyboard.press('Tab');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots['spell'])
    .toBe('Ward');
  await page.keyboard.press('Escape');
  expect(watched.errors).toEqual([]);
});

test('in Thunder Spire, the Ward takes Jarrett through the sparks up the stair hall', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=5');
  await page.evaluate(() => window.__game?.giveItem('ward'));
  await chooseSpell(page, 'Ward');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the stair hall
    window.__game?.clearEnemies();
    window.__game?.placeHero(160, 60, 'up');
  });
  // Without the Ward up, the sparks across the way up (row 1) throw him back.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).zaps).toBe(1);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).room).toEqual({ col: 1, row: 2 });
  // With it up, he walks through, up into the upper hall.
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).warded).toBe(true);
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
});

/** Into Thunder Spire's boss room (by the test hook), Jarrett placed at once at `at`. */
async function enterCentaurRoom(page: Page, at: { x: number; y: number }): Promise<void> {
  await openGame(page, '?dungeon=5');
  await page.evaluate(({ x, y }) => {
    window.__game?.goToRoom(1, 0);
    window.__game?.placeHero(x, y, 'right');
  }, at);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('centaur');
}

test('the Centaur gallops at Jarrett when he is level with it', async ({ page }) => {
  const watched = watchPage(page);
  // In its row (it stands at 168, 111), well to its left.
  await enterCentaurRoom(page, { x: 60, y: 111 });
  await expect
    .poll(async () => (await snapshot(page)).boss?.galloping, { intervals: [50] })
    .toBe(true);
  // It rushes along the row at him: a full heart on touch. (Looked at often, to catch that
  // first touch: it may touch him again once his moment of safety is over.)
  await expect
    .poll(async () => (await snapshot(page)).health.points, { intervals: [20] })
    .toBeLessThan(6);
  expect((await snapshot(page)).health.points).toBe(4);
  expect(watched.errors).toEqual([]);
});

test('the Centaur rears and calls down lightning: marks, then bolts; one on Jarrett costs a heart', async ({
  page,
}) => {
  const watched = watchPage(page);
  // Not level with it (up and to its left), so it only paces.
  await enterCentaurRoom(page, { x: 56, y: 47 });
  await page.evaluate(() => window.__game?.enemiesShootNow());
  await expect
    .poll(async () => (await snapshot(page)).boss?.crouching, { intervals: [50] })
    .toBe(true);
  // Then the storm: four marks, one under him (his patch is cells 2-3 × 2-3). They last
  // 0.8 s, so look often.
  await expect
    .poll(async () => (await snapshot(page)).strikes.length, { timeout: 10_000, intervals: [50] })
    .toBe(4);
  const marked = await snapshot(page);
  expect(marked.storms).toBe(1);
  expect(marked.strikes).toHaveLength(4);
  expect(marked.strikes).toContainEqual({ x: 2, y: 2 });
  expect(marked.sounds.rumble).toBe(1);
  // A moment later the bolts strike, and the one on him hurts.
  await expect.poll(async () => (await snapshot(page)).boltsLanded, { timeout: 10_000 }).toBe(4);
  const struck = await snapshot(page);
  expect(struck.strikes).toEqual([]);
  expect(struck.health.points).toBe(4);
  expect(struck.sounds.thunder).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('below half health the storm covers all but one patch; inside the Ward, Jarrett is safe', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterCentaurRoom(page, { x: 56, y: 47 });
  await page.evaluate(() => window.__game?.giveItem('ward'));
  await chooseSpell(page, 'Ward');
  await page.evaluate(() => {
    window.__game?.setBossHealth(6);
    window.__game?.enemiesShootNow();
  });
  // 8 × 3 patches of floor, all but one. The marks last 0.8 s, which a slow browser's
  // round trips could miss, so they are watched frame by frame inside the page, and he
  // wards on the frame they appear, before they fall.
  const marks = await page.evaluate(async () => {
    const g = window.__game;
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(null)));
    for (let i = 0; i < 600 && (g?.snapshot()?.strikes.length ?? 0) < 23; i++) await frame();
    const seen = g?.snapshot()?.strikes.length ?? 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    await frame();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }));
    return seen;
  });
  expect(marks).toBe(23);
  await expect.poll(async () => (await snapshot(page)).warded).toBe(true);
  await expect.poll(async () => (await snapshot(page)).boltsLanded, { timeout: 10_000 }).toBe(23);
  expect((await snapshot(page)).health.points).toBe(6);
  expect(watched.errors).toEqual([]);
});

test('the beaten Centaur leaves a heart container and Thunder Spire’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterCentaurRoom(page, { x: 56, y: 47 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(1);
  });
  // Beside it, facing it: one blow.
  const boss = (await snapshot(page)).boss;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 34, y, 'right'), {
    x: boss?.x ?? 0,
    y: boss?.y ?? 0,
  });
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(kinds).toEqual(['heart-container', 'shard']);
  expect(watched.errors).toEqual([]);
});

/** Dungeon 1's hub, emptied and held, with the Steel Sword in hand. */
async function steelInHub(page: Page): Promise<void> {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.giveItem('steel-sword'));
  await chooseItem(page, 'near', 'Steel Sword');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the hub
    window.__game?.clearEnemies();
  });
}

test('the Steel Sword hits twice as hard: one blow beats a robot', async ({ page }) => {
  const watched = watchPage(page);
  await steelInHub(page);
  await page.evaluate(() => {
    window.__game?.placeHero(160, 94, 'down');
    window.__game?.spawnEnemy('robot', 160, 112); // its body just under the blade
  });
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  expect((await snapshot(page)).swings).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('the Steel Sword bats a shot back the way Jarrett faces, into an enemy', async ({ page }) => {
  const watched = watchPage(page);
  await steelInHub(page);
  // A robot up the room, and a shot (held still) just in front of him, facing up.
  await page.evaluate(() => {
    window.__game?.placeHero(160, 110, 'up');
    window.__game?.spawnEnemy('robot', 160, 50);
    window.__game?.fireEnemyShot(160, 80, 0, 1);
  });
  await swingOnce(page);
  const s = await snapshot(page);
  expect(s.batted).toBe(1);
  expect(s.sounds.bat).toBe(1);
  expect(s.enemyShots).toEqual([]);
  // His now: it flies up into the robot (one hit of two).
  await expect.poll(async () => (await snapshot(page)).enemies[0]?.health).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('an eye statue fires orbs; one batted back into it shuts it, and its gates open', async ({
  page,
}) => {
  const watched = watchPage(page);
  await steelInHub(page);
  // An eye in the north wall (column 4), and a gate across the way north (columns 9-10).
  await page.evaluate(() => {
    window.__game?.setCell(4, 1, 'y');
    window.__game?.setCell(9, 1, 'g');
    window.__game?.setCell(10, 1, 'g');
    window.__game?.placeHero(160, 120, 'up');
    window.__game?.holdEnemies(false);
    window.__game?.enemiesShootNow();
  });
  // It fires straight down; held still once it is out.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const shots = window.__game?.snapshot()?.enemyShots ?? [];
          if (shots.length > 0) window.__game?.holdEnemies(true);
          return shots.length;
        }),
      { intervals: [20] },
    )
    .toBe(1);
  const orb = (await snapshot(page)).enemyShots[0] ?? { x: 0, y: 0 };
  expect(orb.x).toBe(72);
  // Under it, facing up, it just above his head: bat it back up into the eye.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 28, 'up'), orb);
  await swingOnce(page);
  expect((await snapshot(page)).batted).toBe(1);
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon1/1,2/4,1');
  expect((await snapshot(page)).sounds.switch).toBe(1);
  // The gate is open: north he goes.
  await page.evaluate(() => window.__game?.placeHero(160, 46, 'up'));
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
});

test('Witchwood Tower’s archway in the forest opens once Jarrett holds five shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(0, 3);
    window.__game?.clearEnemies();
    for (const n of [1, 2, 3, 4]) window.__game?.takeShard(n);
  });
  // With four shards, he stands in the archway and nothing happens.
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // The fifth, and the way opens.
  await page.evaluate(() => {
    window.__game?.takeShard(5);
    window.__game?.placeHero(160, 70, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon6');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(watched.errors).toEqual([]);
});

test('Witchwood Tower’s prize: the Steel Sword, behind sparks the Ward gets him through', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=6'); // with the Ward, among the rest
  await chooseSpell(page, 'Ward');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(0, 2); // the west hall
    window.__game?.clearEnemies();
    window.__game?.placeHero(104, 110, 'up'); // below the closet's sparks (column 6, row 5)
  });
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).warded).toBe(true);
  await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).player.y < 74);
  // In the closet, beside the chest (column 5, row 3): the Steel Sword, in hand at once.
  await page.evaluate(() => window.__game?.bump(5, 3));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon6/0,2/5,3');
  const sword = (await snapshot(page)).pickups.find((p) => p.kind === 'item');
  expect(sword).toBeDefined();
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), sword ?? { x: 0, y: 0 });
  await expect.poll(async () => (await snapshot(page)).pickups).toEqual([]);
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  // In his hand: the bag's near slot shows it.
  await page.keyboard.press('Tab');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots['near'])
    .toBe('Steel Sword');
  await page.keyboard.press('Escape');
  expect(watched.errors).toEqual([]);
});

test('in Witchwood Tower, an orb batted back into the great stair’s eye opens the way up', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=6');
  await page.evaluate(() => window.__game?.giveItem('steel-sword'));
  await chooseItem(page, 'near', 'Steel Sword');
  await page.evaluate(() => {
    window.__game?.goToRoom(1, 2); // the great stair
    window.__game?.clearEnemies();
    window.__game?.placeHero(160, 120, 'up');
    window.__game?.enemiesShootNow();
  });
  // The eye (column 4, row 1) fires straight down; held still once it is out.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const shots = window.__game?.snapshot()?.enemyShots ?? [];
          if (shots.length > 0) window.__game?.holdEnemies(true);
          return shots.length;
        }),
      { intervals: [20] },
    )
    .toBe(1);
  const orb = (await snapshot(page)).enemyShots[0] ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 28, 'up'), orb);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon6/1,2/4,1');
  await page.evaluate(() => window.__game?.placeHero(160, 46, 'up'));
  await holdUntil(page, 'ArrowUp', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 1 && room.row === 1;
  });
  expect(watched.errors).toEqual([]);
});

/** Into Witchwood Tower's boss room (by the test hook), Jarrett placed at once at `at`. */
async function enterWitchRoom(page: Page, at: { x: number; y: number }): Promise<void> {
  await openGame(page, '?dungeon=6');
  await page.evaluate(({ x, y }) => {
    window.__game?.goToRoom(1, 0);
    window.__game?.placeHero(x, y, 'up');
  }, at);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('witch');
}

test('the Witch throws fire, vanishes, and appears somewhere else', async ({ page }) => {
  const watched = watchPage(page);
  await enterWitchRoom(page, { x: 160, y: 126 });
  const start = (await snapshot(page)).boss;
  await page.evaluate(() => window.__game?.enemiesShootNow());
  await expect.poll(async () => (await snapshot(page)).shotsFired).toBe(3);
  // Gone for a moment...
  expect((await untilGame(page, (s) => s.boss?.gone === true, 10_000)).boss?.gone).toBe(true);
  // ...then back, at another spot.
  const moved = (await untilGame(page, (s) => s.boss?.gone === false, 10_000)).boss;
  expect(moved?.gone).toBe(false);
  expect({ x: moved?.x, y: moved?.y }).not.toEqual({ x: start?.x, y: start?.y });
  expect(watched.errors).toEqual([]);
});

test('below half health the Witch brings decoys; a blow pops one and never hurts her', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterWitchRoom(page, { x: 160, y: 126 });
  await page.evaluate(() => window.__game?.setBossHealth(5));
  // Her next appearance brings two decoys.
  const fierce = await untilGame(page, (s) => s.boss?.decoys.length === 2, 15_000);
  expect(fierce.boss?.decoys).toHaveLength(2);
  // Held still, her fire cleared away.
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
  });
  const s = await snapshot(page);
  const decoy = s.boss?.decoys[0] ?? { x: 0, y: 0 };
  // Beside the first decoy, facing it: one blow, and it is gone; she keeps her health.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 22, y, 'right'), decoy);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).decoysPopped).toBe(1);
  const after = await snapshot(page);
  expect(after.boss?.decoys).toHaveLength(1);
  expect(after.boss?.health).toBe(5);
  expect(watched.errors).toEqual([]);
});

test('the beaten Witch leaves a heart container and Witchwood Tower’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterWitchRoom(page, { x: 160, y: 126 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
    window.__game?.setBossHealth(1);
  });
  const boss = (await snapshot(page)).boss;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 22, y, 'right'), {
    x: boss?.x ?? 0,
    y: boss?.y ?? 0,
  });
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(kinds).toEqual(['heart-container', 'shard']);
  expect(watched.errors).toEqual([]);
});

test('the Triple Daggers throw a fan of three, which spread as they fly', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => {
    window.__game?.giveItem('triple-daggers'); // into the empty far slot
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the hub
    window.__game?.clearEnemies();
    window.__game?.placeHero(60, 94, 'right');
  });
  await page.keyboard.press('x');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('far');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).daggers.length).toBe(3);
  expect((await snapshot(page)).thrown).toBe(1);
  // As they fly they spread out: one level, one above, one below (more than 4 px apart).
  await expect
    .poll(
      async () => {
        const ys = (await snapshot(page)).daggers.map((d) => d.y).sort((a, b) => a - b);
        const [top = 0, mid = 0, low = 0] = ys;
        return ys.length === 3 && mid - top > 4 && low - mid > 4;
      },
      { intervals: [20] },
    )
    .toBe(true);
  expect(watched.errors).toEqual([]);
});

test('Crimson Manor’s archway in the ruins opens once Jarrett holds six shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(12, 5);
    window.__game?.clearEnemies();
    for (const n of [1, 2, 3, 4, 5]) window.__game?.takeShard(n);
  });
  await page.evaluate(() => window.__game?.placeHero(160, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  await page.evaluate(() => {
    window.__game?.takeShard(6);
    window.__game?.placeHero(160, 70, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon7');
  expect(s.room).toEqual({ col: 1, row: 2 });
  expect(watched.errors).toEqual([]);
});

test('Crimson Manor’s prize: the Triple Daggers, behind rubble the Axe smashes', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=7'); // with the Axe, among the rest
  await chooseItem(page, 'near', 'Axe');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(2, 2); // the east wing
    window.__game?.clearEnemies();
    window.__game?.placeHero(232, 110, 'up'); // below the rubble (column 14, row 5)
  });
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon7/2,2/14,5');
  // In, under the chest (column 14, row 4): it opens and the Triple Daggers drop right where
  // he stands, so he takes them at once, holds them up, and has them in hand.
  await page.evaluate(() => window.__game?.placeHero(232, 94, 'up'));
  await page.evaluate(() => window.__game?.bump(14, 4));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon7/2,2/14,4');
  await expect.poll(async () => (await snapshot(page)).sounds.found).toBe(1);
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  expect((await snapshot(page)).pickups).toEqual([]);
  await page.keyboard.press('Tab');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots['far'])
    .toBe('Triple Daggers');
  await page.keyboard.press('Escape');
  expect(watched.errors).toEqual([]);
});

/** Into Crimson Manor's top hall (by the test hook), Jarrett placed at once at `at`. */
async function enterVampireRoom(page: Page, at: { x: number; y: number }): Promise<void> {
  await openGame(page, '?dungeon=7');
  await page.evaluate(({ x, y }) => {
    window.__game?.goToRoom(1, 0);
    window.__game?.placeHero(x, y, 'up');
  }, at);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('vampire');
}

test('the Vampire’s touch drains Jarrett and heals it', async ({ page }) => {
  const watched = watchPage(page);
  await enterVampireRoom(page, { x: 40, y: 126 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(6);
  });
  const boss = (await snapshot(page)).boss;
  // Right against it.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), {
    x: boss?.x ?? 0,
    y: boss?.y ?? 0,
  });
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(5);
  expect((await snapshot(page)).boss?.health).toBe(7);
  expect(watched.errors).toEqual([]);
});

test('the Vampire bursts into a ring of dark purple shots and re-forms somewhere else', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterVampireRoom(page, { x: 40, y: 126 });
  const start = (await snapshot(page)).boss;
  // Watched in the page, frame by frame: the art of the shots in the air on the frame they burst out.
  const arts = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        window.__game?.enemiesShootNow();
        const look = (): void => {
          const s = window.__game?.snapshot();
          if (s && s.shotsFired >= 8) resolve(s.enemyShots.map((shot) => shot.art));
          else requestAnimationFrame(look);
        };
        look();
      }),
  );
  expect(arts.length).toBeGreaterThan(0);
  expect(arts).toEqual(arts.map(() => 'dark-shot'));
  await expect.poll(async () => (await snapshot(page)).shotsFired).toBe(8);
  expect((await snapshot(page)).boss?.gone).toBe(true);
  await expect
    .poll(async () => (await snapshot(page)).boss?.gone, { timeout: 10_000, intervals: [50] })
    .toBe(false);
  const back = (await snapshot(page)).boss;
  expect({ x: back?.x, y: back?.y }).not.toEqual({ x: start?.x, y: start?.y });
  expect(watched.errors).toEqual([]);
});

test('the beaten Vampire leaves a heart container and Crimson Manor’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterVampireRoom(page, { x: 40, y: 126 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
    window.__game?.setBossHealth(1);
  });
  const boss = (await snapshot(page)).boss;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 28, y, 'right'), {
    x: boss?.x ?? 0,
    y: boss?.y ?? 0,
  });
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(kinds).toEqual(['heart-container', 'shard']);
  expect(watched.errors).toEqual([]);
});

test('Dragon’s Maw’s cave on the volcano edge opens once Jarrett holds seven shards', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(14, 0);
    window.__game?.clearEnemies();
    for (const n of [1, 2, 3, 4, 5, 6]) window.__game?.takeShard(n);
  });
  // With six shards, he stands in the cave's mouth and nothing happens.
  await page.evaluate(() => window.__game?.placeHero(168, 70, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(48);
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // The seventh, and the way opens.
  await page.evaluate(() => {
    window.__game?.takeShard(7);
    window.__game?.placeHero(168, 70, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const s = await snapshot(page);
  expect(s.map).toBe('dungeon8');
  expect(s.room).toEqual({ col: 1, row: 3 });
  expect(s.enteredAt).toEqual({ x: 160, y: 140 });
  expect(watched.errors).toEqual([]);
});

test('Dragon’s Maw’s prize: the Star Blade, caged until the forge’s eye is shut', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=8'); // with the Steel Sword, among the rest
  await chooseItem(page, 'near', 'Steel Sword');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the forge
    window.__game?.clearEnemies();
    window.__game?.placeHero(224, 80, 'down'); // above the cage's gate (columns 13–14, row 6)
  });
  // The gate holds him back: his feet stop at its top edge (row 6 starts at y 96).
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(96);
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowDown');
  expect((await snapshot(page)).player.y).toBe(96);
  // The eye (column 13, row 1) fires straight down; held still once its orb is out.
  await page.evaluate(() => {
    window.__game?.placeHero(160, 120, 'up');
    window.__game?.holdEnemies(false);
    window.__game?.enemiesShootNow();
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const shots = window.__game?.snapshot()?.enemyShots ?? [];
          if (shots.length > 0) window.__game?.holdEnemies(true);
          return shots.length;
        }),
      { intervals: [20] },
    )
    .toBe(1);
  const orb = (await snapshot(page)).enemyShots[0] ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 28, 'up'), orb);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon8/1,2/13,1');
  // The gate is open: down into the cage, to the chest (column 14, row 7).
  await page.evaluate(() => window.__game?.placeHero(224, 80, 'down'));
  await holdUntil(page, 'ArrowDown', async () => (await snapshot(page)).player.y > 104);
  await page.evaluate(() => window.__game?.bump(14, 7));
  await expect.poll(async () => (await snapshot(page)).opened).toContain('dungeon8/1,2/14,7');
  // The Star Blade drops beside him, or right under him if he stands close: either way he
  // takes it and holds it up, with the finding tune.
  await expect
    .poll(async () => {
      const s = await snapshot(page);
      const blade = s.pickups.find((p) => p.kind === 'item');
      if (blade) await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), blade);
      return s.sounds.found;
    })
    .toBe(1);
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  expect((await snapshot(page)).pickups).toEqual([]);
  // In his hand: the bag's near slot shows it.
  await page.keyboard.press('Tab');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.inventory()))?.slots['near'])
    .toBe('Star Blade');
  await page.keyboard.press('Escape');
  expect(watched.errors).toEqual([]);
});

/** Into Dragon's Maw's lair (by the test hook), Jarrett placed at once at `at`. */
async function enterDragonRoom(page: Page, at: { x: number; y: number }): Promise<void> {
  await openGame(page, '?dungeon=8');
  await page.evaluate(({ x, y }) => {
    window.__game?.goToRoom(1, 0);
    window.__game?.placeHero(x, y, 'up');
  }, at);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('dragon');
}

test('the Dragon rears, then sweeps its fire across Jarrett, burst by burst', async ({ page }) => {
  const watched = watchPage(page);
  await enterDragonRoom(page, { x: 60, y: 120 });
  await page.evaluate(() => {
    window.__game?.clearEnemies();
    window.__game?.enemiesShootNow();
  });
  // The warning: it rears. Then it breathes, and when it is done, five bursts have flown.
  await expect
    .poll(async () => (await snapshot(page)).boss?.crouching, { intervals: [20] })
    .toBe(true);
  expect((await snapshot(page)).shotsFired).toBe(0);
  await expect
    .poll(async () => (await snapshot(page)).boss?.breathing, { intervals: [20] })
    .toBe(true);
  await expect.poll(async () => (await snapshot(page)).boss?.breathing).toBe(false);
  const s = await snapshot(page);
  expect(s.shotsFired).toBe(5);
  expect(s.sounds.rumble).toBe(1);
  expect(s.sounds.burn).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('the shield held up towards the Dragon stops its fire', async ({ page }) => {
  const watched = watchPage(page);
  await enterDragonRoom(page, { x: 60, y: 120 });
  await page.evaluate(() => {
    window.__game?.clearEnemies();
    window.__game?.holdEnemies(true);
  });
  // Straight below it, out of its tail's reach, facing it.
  const boss = (await snapshot(page)).boss;
  await page.evaluate(({ x }) => window.__game?.placeHero(x, 124, 'up'), { x: boss?.x ?? 0 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(false);
    window.__game?.enemiesShootNow();
  });
  expect((await untilGame(page, (s) => s.boss?.breathing === true)).boss?.breathing).toBe(true);
  expect((await untilGame(page, (s) => s.boss?.breathing === false)).boss?.breathing).toBe(false);
  const s = await untilGame(page, (now) => now.enemyShots.length === 0);
  expect(s.enemyShots).toEqual([]);
  expect(s.blocked).toBeGreaterThan(0);
  expect(s.health.points).toBe(s.health.max);
  expect(watched.errors).toEqual([]);
});

test('the Dragon’s tail lashes Jarrett when he comes close; stepping back in time dodges it', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterDragonRoom(page, { x: 60, y: 120 });
  await page.evaluate(() => window.__game?.clearEnemies());
  // Close below it, not touching it: its body ends at its feet, and his reaches 20 px above his.
  const close = await page.evaluate(() => {
    const b = window.__game?.snapshot()?.boss ?? { x: 0, y: 0 };
    window.__game?.placeHero(b.x, b.y + 24, 'up');
    return { x: b.x, y: b.y };
  });
  const lashed = await untilGame(page, (s) => s.lashes === 1);
  expect(lashed.lashes).toBe(1);
  expect(lashed.health.points).toBe(4);
  // Once his moment of safety is over: close again, and the moment the tail starts (watched
  // frame by frame in the page), back out of reach.
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  expect((await untilGame(page, (s) => !s.boss?.lashing)).boss?.lashing).toBe(false);
  const dodged = await page.evaluate(async ({ x, y }) => {
    const g = window.__game;
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(null)));
    g?.placeHero(x, y + 24, 'up');
    const start = g?.snapshot()?.playMs ?? 0;
    for (let s = g?.snapshot(); s && s.playMs - start < 5_000; s = g?.snapshot()) {
      if (s.boss?.lashing) {
        g?.placeHero(s.boss.x, s.boss.y + 48, 'up');
        return true;
      }
      await frame();
    }
    return false;
  }, close);
  expect(dodged).toBe(true);
  const after = await untilGame(page, (s) => !s.boss?.lashing);
  expect(after.boss?.lashing).toBe(false);
  expect(after.lashes).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('the beaten Dragon leaves a heart container and Dragon’s Maw’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterDragonRoom(page, { x: 60, y: 120 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
    window.__game?.setBossHealth(1);
  });
  // Below it, the blade's reach up into its body.
  const boss = (await snapshot(page)).boss;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 26, 'up'), {
    x: boss?.x ?? 0,
    y: boss?.y ?? 0,
  });
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(kinds).toEqual(['heart-container', 'shard']);
  expect(watched.errors).toEqual([]);
});

test('the Star Blade sends a beam at full hearts, and none with a heart missing', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.giveItem('star-blade'));
  await chooseItem(page, 'near', 'Star Blade');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the hub
    window.__game?.clearEnemies();
    window.__game?.placeHero(60, 94, 'right');
    window.__game?.spawnEnemy('robot', 220, 94); // far across the room
  });
  // Every heart full: the swing sends a beam, which beats the robot (2 of its 2).
  await swingOnce(page);
  expect((await snapshot(page)).beams).toBe(1);
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(1);
  // A heart down: a swing is only a swing.
  await page.evaluate(() => {
    window.__game?.setHealth(5);
    window.__game?.spawnEnemy('robot', 220, 94);
  });
  await swingOnce(page);
  await page.waitForTimeout(500);
  const s = await snapshot(page);
  expect(s.beams).toBe(1);
  expect(s.defeated).toBe(1);
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
  // He holds them up for a moment, while the game waits; then he can throw them.
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  await page.keyboard.press('x');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).thrown).toBe(1);
  expect(watched.errors).toEqual([]);
});

/** From the great hall, north into dungeon 1's boss room. */
async function enterBossRoom(page: Page): Promise<void> {
  await openGame(page, '?dungeon=1');
  await walkIntoBossRoom(page);
}

/**
 * From the great hall up into the Treant's room. The arrow is let go while the
 * view slides, so he stops just inside instead of walking on into the Treant.
 */
async function walkIntoBossRoom(page: Page): Promise<void> {
  await page.evaluate(() => window.__game?.goToRoom(1, 1)); // the great hall
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).sliding, { timeout: 15_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).room).toEqual({ col: 1, row: 0 });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
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

/**
 * Into Bog Grotto's boss room from the bog hall, through its locked door (a key given).
 * The arrow is let go while the view slides, so he stops just inside.
 */
async function enterFrogRoom(page: Page): Promise<void> {
  await openGame(page, '?dungeon=2');
  await page.evaluate(() => window.__game?.goToRoom(1, 1)); // the bog hall
  await page.evaluate(() => {
    window.__game?.clearEnemies();
    window.__game?.giveKey();
    window.__game?.placeHero(160, 60, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).sliding, { timeout: 15_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).room).toEqual({ col: 1, row: 0 });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('frog');
}

/**
 * Holds the boss still on the ground (if it is mid-leap, lets it land first). Each try
 * looks and holds in one call, so the boss can't move between the two.
 */
async function holdBossOnGround(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__game;
          g?.holdEnemies(true);
          if (!g?.snapshot()?.boss?.airborne) return true;
          g.holdEnemies(false);
          return false;
        }),
      { intervals: [50] },
    )
    .toBe(true);
}

test('the Giant Frog crouches, then leaps at Jarrett: out of reach in the air, and each landing throws a ring of four', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterFrogRoom(page);
  const boss = async () => (await snapshot(page)).boss;
  const start = await boss();
  expect(start).toMatchObject({ health: 12, airborne: false });
  // Jarrett stands to the left and below it. It crouches (the warning), then leaps.
  await page.evaluate(() => window.__game?.placeHero(80, 120, 'right'));
  const often = { timeout: 10_000, intervals: [50] };
  await expect.poll(async () => (await boss())?.crouching, often).toBe(true);
  // Held still the moment it is seen in the air (looking and holding in one call: a
  // leap can be over before a second call arrives).
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = window.__game;
          if (!g?.snapshot()?.boss?.airborne) return false;
          g.holdEnemies(true);
          return true;
        }),
      often,
    )
    .toBe(true);
  // Once Jarrett has no blink of safety left from any earlier hit, he stands right
  // under it: touching it costs nothing, and a swing doesn't land.
  const air = await boss();
  expect(air?.airborne).toBe(true);
  const fired = (await snapshot(page)).shotsFired;
  await expect
    .poll(async () => {
      const s = await snapshot(page);
      return !s.invulnerable && !s.knockedBack;
    })
    .toBe(true);
  const hearts = (await snapshot(page)).health.points;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'up'), {
    x: air?.x ?? 0,
    y: air?.y ?? 0,
  });
  await swingOnce(page);
  expect((await boss())?.health).toBe(air?.health);
  expect((await snapshot(page)).health.points).toBe(hearts);
  // Out of the way, and let go: it lands nearer where he stood, throwing its ring.
  await page.evaluate(() => window.__game?.placeHero(260, 120, 'left'));
  await page.evaluate(() => window.__game?.holdEnemies(false));
  await expect.poll(async () => (await boss())?.airborne).toBe(false);
  await expect.poll(async () => (await snapshot(page)).shotsFired).toBe(fired + 4);
  expect((await boss())?.x).toBeLessThan(start?.x ?? 0);
  expect(watched.errors).toEqual([]);
});

test('the beaten Giant Frog leaves a heart container and Bog Grotto’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterFrogRoom(page);
  await holdBossOnGround(page);
  await page.evaluate(() => window.__game?.setBossHealth(1));
  await expect.poll(() => settled(page)).toBe(true); // a press is ignored while knocked back
  const b = (await snapshot(page)).boss;
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), {
    x: b?.x ?? 0,
    y: b?.y ?? 0,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = async () => (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(await kinds()).toEqual(['heart-container', 'shard']);
  const shard = (await snapshot(page)).pickups.find((p) => p.kind === 'shard');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), shard ?? { x: 0, y: 0 });
  await expect.poll(kinds).toEqual(['heart-container']);
  const s = await snapshot(page);
  expect(s.shards).toBe(1);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon2/1,0/boss', 'dungeon2/shard']));
  expect(s.sealed).toBe(false);
  expect(watched.errors).toEqual([]);
});

/** Dungeon 1's hub, emptied, with the Ward in hand (Thunder Spire's prize) and full mana. */
async function wardInHub(page: Page): Promise<void> {
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => {
    window.__game?.giveItem('ward');
    window.__game?.holdEnemies(true);
    window.__game?.goToRoom(1, 2); // the hub
    window.__game?.clearEnemies();
    window.__game?.holdEnemies(false); // the room is empty; shots must fly
    window.__game?.setMana(100);
  });
}

test('the Ward: a bubble that blocks every hit for a few seconds, cast once at a time', async ({
  page,
}) => {
  const watched = watchPage(page);
  await wardInHub(page);
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'up'));
  // Cast, and at once again while it is up: the second does nothing.
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).warded).toBe(true);
  // A shot from just behind, which the shield can't stop: the bubble does.
  await page.evaluate(() => window.__game?.fireEnemyShot(160, 112, 0, -1));
  await expect.poll(async () => (await snapshot(page)).blocked).toBe(1);
  const up = await snapshot(page);
  expect(up.health.points).toBe(up.health.max);
  expect(up.casts).toBe(1);
  expect(up.sounds.ward).toBe(1);
  // One cast's mana spent (40 of 100; it may have begun to refill since), not two.
  expect(up.mana.current).toBeGreaterThanOrEqual(60);
  expect(up.mana.current).toBeLessThan(100);
  // It drops after its time, and then a shot from behind hurts.
  await expect.poll(async () => (await snapshot(page)).warded, { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => window.__game?.fireEnemyShot(160, 112, 0, -1));
  await expect.poll(async () => (await snapshot(page)).health.points).toBe(up.health.max - 1);
  expect(watched.errors).toEqual([]);
});

test('a spark barrier zaps Jarrett back; inside the Ward he walks through it', async ({ page }) => {
  const watched = watchPage(page);
  await wardInHub(page);
  // A barrier across the way north (columns 9-10, row 1).
  await page.evaluate(() => {
    window.__game?.setCell(9, 1, 'e');
    window.__game?.setCell(10, 1, 'e');
    window.__game?.placeHero(160, 60, 'up');
  });
  // Without the Ward, walking into it zaps him (half a heart) and throws him back.
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).zaps).toBe(1);
  await page.keyboard.up('ArrowUp');
  const zapped = await snapshot(page);
  expect(zapped.health.points).toBe(zapped.health.max - 1);
  expect(zapped.sounds.spark).toBe(1);
  expect(zapped.room).toEqual({ col: 1, row: 2 });
  expect(zapped.player.y).toBeGreaterThanOrEqual(32);
  // Inside the Ward, he walks through and on north. (Cast once he is free to: a press while
  // he is knocked back is dropped.)
  await untilGame(page, (s) => !s.invulnerable && !s.knockedBack);
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.press('c');
  expect((await untilGame(page, (s) => s.warded)).warded).toBe(true);
  await page.keyboard.down('ArrowUp');
  // The slide north lasts half a second of game time, which a slow browser's round trips
  // could miss, so it is watched frame by frame inside the page (for up to 10 s of game time).
  const slid = await page.evaluate(async () => {
    const g = window.__game;
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(null)));
    const start = g?.snapshot()?.playMs ?? 0;
    for (let s = g?.snapshot(); s && s.playMs - start < 10_000; s = g?.snapshot()) {
      if (s.sliding) return true;
      await frame();
    }
    return false;
  });
  expect(slid).toBe(true);
  await page.keyboard.up('ArrowUp');
  const north = await untilGame(page, (s) => s.room.col === 1 && s.room.row === 1);
  expect(north.room).toEqual({ col: 1, row: 1 });
  expect(north.zaps).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('if the Ward drops while Jarrett stands in a spark barrier, it zaps him and he walks out', async ({
  page,
}) => {
  const watched = watchPage(page);
  await wardInHub(page);
  await page.evaluate(() => {
    window.__game?.setCell(9, 5, 'e');
    window.__game?.setCell(10, 5, 'e');
    window.__game?.placeHero(160, 60, 'down');
  });
  await page.keyboard.press('c');
  expect((await untilGame(page, (s) => s.warded)).warded).toBe(true);
  // In the middle of the barrier (row 5), standing still.
  await page.evaluate(() => window.__game?.placeHero(160, 90, 'down'));
  expect((await untilGame(page, (s) => !s.warded, 10_000)).warded).toBe(false);
  expect((await untilGame(page, (s) => s.zaps === 1)).zaps).toBe(1);
  // Thrown back the way he faced (up), out of the barrier, or free to walk out of it.
  await page.keyboard.down('ArrowUp');
  expect((await untilGame(page, (s) => s.player.y < 74)).player.y).toBeLessThan(74);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).health.points).toBe((await snapshot(page)).health.max - 1);
  expect(watched.errors).toEqual([]);
});

/**
 * Into Sunken Crypt's boss room from the tomb hall (a key given), with Lightning in hand:
 * given, then chosen in the bag, since the Fireball holds the spell slot.
 */
async function enterMummyRoom(page: Page): Promise<void> {
  await openGame(page, '?dungeon=3');
  await page.evaluate(() => window.__game?.giveItem('lightning'));
  const inv = () => page.evaluate(() => window.__game?.inventory());
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await inv())?.cursor).toBe(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await inv())?.cursor).toBe(2);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await inv())?.slots['spell']).toBe('Lightning');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
  await page.evaluate(() => {
    window.__game?.goToRoom(1, 1); // the tomb hall
    window.__game?.clearEnemies();
    window.__game?.giveKey();
    window.__game?.placeHero(160, 60, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).sliding, { timeout: 15_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).room).toEqual({ col: 1, row: 0 });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('mummy');
}

test('the Mummy: blows glance off until a Lightning bolt stuns it; then it shambles after Jarrett', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterMummyRoom(page);
  const boss = async () => (await snapshot(page)).boss;
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const b = await boss();
  expect(b).toMatchObject({ health: 10, stunned: false });
  const at = { x: b?.x ?? 0, y: b?.y ?? 0 };
  // Wrapped tight: a sword blow glances off.
  await expect.poll(() => settled(page)).toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), at);
  await swingOnce(page);
  expect((await boss())?.health).toBe(10);
  expect((await snapshot(page)).sounds.block).toBeGreaterThanOrEqual(1);
  // A bolt stuns it (held still, it stays stunned); now the blow lands.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 40, 'up'), at);
  await page.keyboard.press('c');
  await expect.poll(async () => (await boss())?.stunned, { intervals: [50] }).toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), at);
  await swingOnce(page);
  await expect.poll(async () => (await boss())?.health).toBe(9);
  // Let go: once the stun wears off, it shambles down towards him.
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'up'));
  await page.evaluate(() => window.__game?.holdEnemies(false));
  await expect.poll(async () => (await boss())?.stunned, { timeout: 10_000 }).toBe(false);
  await expect
    .poll(async () => (await boss())?.y ?? 0, { timeout: 10_000 })
    .toBeGreaterThan(at.y + 4);
  expect(watched.errors).toEqual([]);
});

test('the beaten Mummy leaves a heart container and Sunken Crypt’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterMummyRoom(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(1);
  });
  const b = (await snapshot(page)).boss;
  const at = { x: b?.x ?? 0, y: b?.y ?? 0 };
  await expect.poll(() => settled(page)).toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 40, 'up'), at);
  await page.keyboard.press('c');
  await expect
    .poll(async () => (await snapshot(page)).boss?.stunned, { intervals: [50] })
    .toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), at);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = async () => (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(await kinds()).toEqual(['heart-container', 'shard']);
  const shard = (await snapshot(page)).pickups.find((p) => p.kind === 'shard');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), shard ?? { x: 0, y: 0 });
  await expect.poll(kinds).toEqual(['heart-container']);
  const s = await snapshot(page);
  expect(s.shards).toBe(1);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon3/1,0/boss', 'dungeon3/shard']));
  expect(s.sealed).toBe(false);
  expect(watched.errors).toEqual([]);
});

/** Into Stonecrag Mine's boss room from the deep shaft (a key given), sword in hand. */
async function enterOgreRoom(page: Page): Promise<void> {
  await openGame(page, '?dungeon=4');
  await page.evaluate(() => {
    window.__game?.giveItem('axe'); // the mine's prize, in the bag beside the sword
    window.__game?.goToRoom(1, 1); // the deep shaft
    window.__game?.clearEnemies();
    window.__game?.giveKey();
    window.__game?.placeHero(160, 60, 'up');
  });
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).sliding, { timeout: 15_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).room).toEqual({ col: 1, row: 0 });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('ogre');
}

/** Takes the Axe in hand: in the bag, the near weapon (the first slot), Space to switch. */
async function takeAxeInHand(page: Page): Promise<void> {
  const inv = () => page.evaluate(() => window.__game?.inventory());
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await inv())?.cursor).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await inv())?.slots['near']).toBe('Axe');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game?.scene() ?? null)).toBe('Game');
}

test('the Ogre: the sword glances off its hide, the Axe bites; it winds up, then slams a ring of eight', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterOgreRoom(page);
  const boss = async () => (await snapshot(page)).boss;
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const b = await boss();
  expect(b).toMatchObject({ health: 10, crouching: false });
  const at = { x: b?.x ?? 0, y: b?.y ?? 0 };
  // The sword glances off.
  await expect.poll(() => settled(page)).toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), at);
  await swingOnce(page);
  expect((await boss())?.health).toBe(10);
  expect((await snapshot(page)).sounds.block).toBeGreaterThanOrEqual(1);
  // The Axe bites.
  await takeAxeInHand(page);
  await swingOnce(page);
  await expect.poll(async () => (await boss())?.health).toBe(9);
  // Let go: it winds up (standing still), then slams down a ring of eight shockwaves.
  await page.evaluate(() => window.__game?.placeHero(40, 126, 'up'));
  const fired = (await snapshot(page)).shotsFired;
  await page.evaluate(() => window.__game?.holdEnemies(false));
  await expect
    .poll(async () => (await boss())?.crouching, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await expect
    .poll(async () => (await snapshot(page)).shotsFired, { timeout: 10_000 })
    .toBe(fired + 8);
  expect(watched.errors).toEqual([]);
});

test('the beaten Ogre leaves a heart container and Stonecrag Mine’s shard', async ({ page }) => {
  const watched = watchPage(page);
  await enterOgreRoom(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(1);
  });
  const b = (await snapshot(page)).boss;
  await takeAxeInHand(page);
  await expect.poll(() => settled(page)).toBe(true);
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y + 25, 'up'), {
    x: b?.x ?? 0,
    y: b?.y ?? 0,
  });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const kinds = async () => (await snapshot(page)).pickups.map((p) => p.kind).sort();
  expect(await kinds()).toEqual(['heart-container', 'shard']);
  const shard = (await snapshot(page)).pickups.find((p) => p.kind === 'shard');
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y), shard ?? { x: 0, y: 0 });
  await expect.poll(kinds).toEqual(['heart-container']);
  const s = await snapshot(page);
  expect(s.shards).toBe(1);
  expect(s.opened).toEqual(expect.arrayContaining(['dungeon4/1,0/boss', 'dungeon4/shard']));
  expect(s.sealed).toBe(false);
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
  expect(await titleShows(page)).toEqual({
    screen: 'menu',
    options: ['NEW GAME', 'CONTROLS'],
    cursor: 0,
    fastest: null,
  });
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  const s = await snapshot(page);
  expect(s.map).toBe('overworld');
  expect(s.saves).toBe(1);
  expect(s.cheated).toBe(false);
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['CONTINUE', 'NEW GAME', 'CONTROLS']);
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
    .toEqual({ screen: 'confirm', options: ['NO', 'YES'], cursor: 0, fastest: null });
  await page.keyboard.press('Enter'); // NO
  await expect
    .poll(() => titleShows(page))
    .toEqual({
      screen: 'menu',
      options: ['CONTINUE', 'NEW GAME', 'CONTROLS'],
      cursor: 1,
      fastest: null,
    });
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

test('the title shows the controls, and Q goes back to the arcade', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./?seed=1');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  // CONTROLS (the second line without a save) shows the controls; Esc goes back, on CONTROLS.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await titleShows(page))?.screen).toBe('controls');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => titleShows(page))
    .toEqual({ screen: 'menu', options: ['NEW GAME', 'CONTROLS'], cursor: 1, fastest: null });
  // Q: up one folder, to the arcade (here the test server's root, without the ?seed=1).
  const here = page.url();
  await page.keyboard.press('q');
  await expect.poll(() => page.url()).not.toBe(here);
  expect(new URL(page.url()).search).toBe('');
  expect(watched.errors).toEqual([]);
});

test('a damaged save is ignored: the title offers no CONTINUE', async ({ page }) => {
  const watched = watchPage(page);
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  await page.evaluate(() => {
    window.localStorage.setItem('dungeon-delve:save', '{"version":1,"map":"the-moon"}');
  });
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['NEW GAME', 'CONTROLS']);
  await page.evaluate(() => window.localStorage.setItem('dungeon-delve:save', '{oops'));
  await reloadToTitle(page);
  expect((await titleShows(page))?.options).toEqual(['NEW GAME', 'CONTROLS']);
  expect(watched.errors).toEqual([]);
});

test('on the overworld, the bag turns to a world map of the screens Jarrett has been in', async ({
  page,
}) => {
  const watched = watchPage(page);
  const bag = () => page.evaluate(() => window.__game?.inventory());
  await openGame(page);
  // North from the village to Hollow Oak's screen, its shard found, and one screen on.
  await page.evaluate(() => {
    const g = window.__game;
    g?.holdEnemies(true);
    for (const [c, r] of [
      [8, 10],
      [8, 9],
      [7, 9],
      [6, 9],
      [6, 8],
      [7, 8],
    ] as const) {
      g?.goToRoom(c, r);
    }
    g?.takeShard(1);
  });
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Inventory');
  expect((await bag())?.page).toBe('items');
  // Right: the map page. Every screen he has been in, gold where he is, Hollow Oak done.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await bag())?.page).toBe('map');
  const world = (await bag())?.world;
  expect(world?.cols).toBe(16);
  expect(world?.rows).toBe(12);
  expect(world?.cells.map((c) => `${c.x},${c.y}`)).toEqual([
    '6,8',
    '7,8',
    '6,9',
    '7,9',
    '8,9',
    '8,10',
    '8,11',
  ]);
  expect(world?.cells.find((c) => c.current)).toMatchObject({ x: 7, y: 8 });
  expect(world?.cells.find((c) => c.x === 6 && c.y === 8)?.entrance).toBe('done');
  expect(world?.cells.find((c) => c.x === 8 && c.y === 11)?.region).toBe('village');
  // Left: back to the items; I closes it.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await bag())?.page).toBe('items');
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  // In a dungeon there is no world map, and right stays on the items.
  await openGame(page, '?dungeon=1');
  await page.keyboard.press('i');
  await expect.poll(() => sceneNow(page)).toBe('Inventory');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  expect((await bag())?.world).toBeNull();
  expect((await bag())?.page).toBe('items');
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
  // Empty-handed: Space by himself does nothing. Keys are handled
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
      spell: '',
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

test('Walker gives a hint at dungeon 1’s entrance, then goes', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect((await snapshot(page)).walker).toEqual({ x: 232, y: 111 });
  const hint = await talkToWalker(page);
  expect(hint[0]?.join(' ')).toContain('THIS IS HOLLOW OAK.');
  expect(hint.flat().join(' ')).toContain('THROWING DAGGERS');
  const s = await snapshot(page);
  expect(s.walker).toBeNull();
  expect(s.opened).toContain('walker/dungeon1');
  expect(watched.errors).toEqual([]);
});

test('once dungeon 1’s shard is found, Walker waits outside, thanks Jarrett and teaches him the Fireball', async ({
  page,
}) => {
  // Split from the test above: both talks, the boss fight and the trip out took up to
  // 34 s of the 30 s a test may take in WebKit here. The shard is put at Jarrett's feet
  // (the Treant's own tests beat it and take the shard the long way).
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const at = (await snapshot(page)).player;
  await page.evaluate(({ x, y }) => window.__game?.spawnPickup('shard', x, y), at);
  await expect.poll(async () => (await snapshot(page)).shards).toBe(1);
  // He holds it up first, and can't move until he's done.
  expect((await untilGame(page, (s) => !s.holding)).holding).toBe(false);
  expect((await snapshot(page)).opened).toContain('dungeon1/shard');

  // No magic yet: no spell, and no mana bar.
  const hud = () => page.evaluate(() => window.__game?.hud());
  expect((await hud())?.manaBar).toBe(0);

  // Out through the entrance's doorway (letting go once the trip starts): Walker is
  // waiting by the archway.
  await page.evaluate(() => window.__game?.goToRoom(1, 3));
  await page.evaluate(() => window.__game?.placeHero(160, 140, 'down'));
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  expect((await snapshot(page)).map).toBe('overworld');
  // The archway room's enemies appear where he comes out; this test is about Walker.
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.clearEnemies());
  expect((await snapshot(page)).walker).toEqual({ x: 216, y: 79 });
  const after = await talkToWalker(page);
  expect(after[0]?.join(' ')).toContain('SEVEN MORE TO FIND.');
  const said = after.flat().join(' ');
  expect(said).toContain('THANK YOU, JARRETT');
  expect(said).toContain('THIS IS FIREBALL');
  expect(said).toContain('PRESS X TO SWITCH');
  const s = await snapshot(page);
  expect(s.walker).toBeNull();
  expect(s.opened).toContain('walker/dungeon1-done');
  // He taught Jarrett the Fireball: the mana bar shows, and C casts.
  await expect.poll(async () => (await hud())?.manaBar).toBe(44);
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).casts).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('Walker gives a hint at each dungeon’s entrance, and waits outside once its shard is found', async ({
  page,
}) => {
  const watched = watchPage(page);
  // At Bog Grotto's entrance: a hint about the frog and the thorns.
  await openGame(page, '?dungeon=2');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect((await snapshot(page)).walker).toEqual({ x: 72, y: 111 });
  let said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain('THIS IS BOG GROTTO');
  expect(said).toContain('FIREBALL BURNS THEM');
  // At Stonecrag Mine's entrance: the Axe and the Ogre.
  await openGame(page, '?dungeon=4');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain('THIS IS STONECRAG MINE');
  expect(said).toContain('ONLY THE AXE WILL HURT IT');
  // Outside Sunken Crypt once its shard is found: how to choose a spell, and the way on.
  // (A new game: the runs above saved, so the title would offer to continue them.)
  await page.evaluate(() => localStorage.clear());
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.takeShard(3);
    window.__game?.goToRoom(10, 6);
    window.__game?.clearEnemies();
  });
  expect((await snapshot(page)).walker).toEqual({ x: 200, y: 63 });
  said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain('THREE SHARDS');
  expect(said).toContain('CHOOSE ONE IN YOUR BAG: PRESS I');
  expect(said).toContain('STONECRAG MINE');
  expect((await snapshot(page)).opened).toContain('walker/dungeon3-done');
  expect(watched.errors).toEqual([]);
});

test('Walker gives a hint at Dragon’s Maw, and after the last shard sends Jarrett to the vault', async ({
  page,
}) => {
  const watched = watchPage(page);
  // At Dragon's Maw's entrance: the Dragon's fire and tail, and the Star Blade.
  await openGame(page, '?dungeon=8');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  expect((await snapshot(page)).walker).toEqual({ x: 72, y: 111 });
  let said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain("THIS IS DRAGON'S MAW");
  expect(said).toContain('STAR BLADE');
  // Outside the Maw once the eighth shard is found: on to the Shadow Vault.
  await page.evaluate(() => localStorage.clear());
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.takeShard(8);
    window.__game?.goToRoom(14, 0);
    window.__game?.clearEnemies();
  });
  expect((await snapshot(page)).walker).toEqual({ x: 200, y: 63 });
  said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain('ALL EIGHT SHARDS');
  expect(said).toContain('SHADOW VAULT');
  expect((await snapshot(page)).opened).toContain('walker/dungeon8-done');
  expect(watched.errors).toEqual([]);
});

test('with all 8 shards, Walker opens the Shadow Vault’s door, and Jarrett goes in', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    for (const n of [1, 2, 3, 4, 5, 6, 7]) window.__game?.takeShard(n);
    window.__game?.goToRoom(6, 6);
    window.__game?.clearEnemies();
  });
  // Seven shards: no Walker, and the door (columns 14–15, row 3) holds fast.
  expect((await snapshot(page)).walker).toBeNull();
  await page.evaluate(() => window.__game?.placeHero(240, 90, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).player.y).toBe(70); // row 4's top + his feet box
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).map).toBe('overworld');
  // The eighth: Walker waits beside the door. When he has spoken, it is open.
  await page.evaluate(() => {
    window.__game?.takeShard(8);
    window.__game?.goToRoom(6, 6);
    window.__game?.clearEnemies();
  });
  expect((await snapshot(page)).walker).toEqual({ x: 200, y: 79 });
  const said = (await talkToWalker(page)).flat().join(' ');
  expect(said).toContain('SHADOW VAULT');
  expect(said).toContain('OPEN THE WAY');
  const s = await snapshot(page);
  expect(s.opened).toEqual(
    expect.arrayContaining(['walker/vault', 'overworld/6,6/14,3', 'overworld/6,6/15,3']),
  );
  expect(s.sounds.unlock).toBe(1);
  // Up through the open door and down into the vault's entry hall.
  await page.evaluate(() => window.__game?.placeHero(240, 90, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const inside = await snapshot(page);
  expect(inside.map).toBe('vault');
  expect(inside.room).toEqual({ col: 1, row: 2 });
  expect(watched.errors).toEqual([]);
});

test('in the Shadow Vault, Lightning opens the way to the east trial, whose stone slides aside', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=9'); // with every prize
  await chooseSpell(page, 'Lightning');
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.clearEnemies();
  });
  // The gate east (column 18, rows 4–5) stops him at its edge.
  await page.evaluate(() => window.__game?.placeHero(260, 78, 'right'));
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).player.x).toBe(283); // x 288 less his half-width
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).room).toEqual({ col: 1, row: 2 });
  // A bolt up into the crystal switch (column 4, row 1) powers it, and the gate opens.
  await page.evaluate(() => window.__game?.placeHero(72, 46, 'up'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('vault/1,2/4,1');
  await page.evaluate(() => window.__game?.placeHero(260, 78, 'right'));
  await holdUntil(page, 'ArrowRight', async () => {
    const room = (await snapshot(page)).room;
    return room.col === 2 && room.row === 2;
  });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  // In the east trial: the stone in the wall (column 7, row 4) slides aside, and he is through.
  await page.evaluate(() => {
    window.__game?.clearEnemies();
    window.__game?.placeHero(96, 78, 'right');
  });
  await holdUntil(page, 'ArrowRight', async () => (await snapshot(page)).player.x > 136);
  expect((await snapshot(page)).room).toEqual({ col: 2, row: 2 });
  expect(watched.errors).toEqual([]);
});

/** Into the Shadow Vault's top hall (by the test hook), the Steel Sword in hand, Jarrett at `at`. */
async function enterSorcererHall(page: Page, at: { x: number; y: number }): Promise<void> {
  await openGame(page, '?dungeon=9');
  await chooseItem(page, 'near', 'Steel Sword');
  await page.evaluate(({ x, y }) => {
    window.__game?.goToRoom(1, 1);
    window.__game?.placeHero(x, y, 'right');
  }, at);
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('sorcerer');
}

test('the Sorcerer’s shield turns every blow, until one of his orbs batted back breaks it', async ({
  page,
}) => {
  const watched = watchPage(page);
  await enterSorcererHall(page, { x: 150, y: 100 });
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const first = (await snapshot(page)).boss;
  expect(first?.shielded).toBe(true);
  const boss = { x: first?.x ?? 0, y: first?.y ?? 0 };
  // Beside him, facing him (not touching): a blow glances off.
  const beside = { x: boss.x - 20, y: boss.y - 8 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'right'), beside);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  let s = await snapshot(page);
  expect(s.boss?.health).toBe(24);
  expect(s.sounds.block).toBeGreaterThanOrEqual(1);
  // He casts at Jarrett, off to the left; the orb is held once it has flown a little way.
  await page.evaluate(() => {
    window.__game?.placeHero(150, 100, 'right');
    window.__game?.holdEnemies(false);
    window.__game?.enemiesShootNow();
  });
  await expect
    .poll(
      () =>
        page.evaluate((bx) => {
          const shots = window.__game?.snapshot()?.enemyShots ?? [];
          const out = shots.length > 0 && (shots[0]?.x ?? bx) < bx - 20;
          if (out) window.__game?.holdEnemies(true);
          return out;
        }, boss.x),
      { intervals: [20] },
    )
    .toBe(true);
  // Under the blade, facing him: batted back, it flies into him and breaks the shield.
  const orb = (await snapshot(page)).enemyShots[0] ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y + 10, 'right'), orb);
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).shieldsBroken).toBe(1);
  s = await snapshot(page);
  expect(s.boss?.shielded).toBe(false);
  expect(s.boss?.health).toBe(24);
  // Now a blow lands: the Steel Sword's 2.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'right'), beside);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss?.health).toBe(22);
  expect(watched.errors).toEqual([]);
});

/** In the Sorcerer's hall: brings him down to half his health, so he shows his true shape. */
async function toTheDemon(page: Page): Promise<void> {
  await enterSorcererHall(page, { x: 150, y: 100 });
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(13);
    window.__game?.breakBossShield();
  });
  const b = (await snapshot(page)).boss ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 20, y - 8, 'right'), b);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page); // the Steel Sword's 2: down to 11
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('demon');
}

test('at half his health the Sorcerer shows his true shape: the Demon, which throws rings of fire', async ({
  page,
}) => {
  const watched = watchPage(page);
  await toTheDemon(page);
  let s = await snapshot(page);
  expect(s.boss?.health).toBe(11);
  expect(s.boss?.shielded).toBe(false);
  expect(s.sounds.rumble).toBeGreaterThanOrEqual(1);
  // Away up the hall (not level with it): it crouches, then throws a ring of ten.
  await page.evaluate(() => {
    window.__game?.placeHero(100, 60, 'down');
    window.__game?.holdEnemies(false);
    window.__game?.enemiesShootNow();
  });
  const fired = s.shotsFired;
  await expect
    .poll(async () => (await snapshot(page)).boss?.crouching, { intervals: [20] })
    .toBe(true);
  await expect.poll(async () => (await snapshot(page)).shotsFired).toBe(fired + 10);
  s = await snapshot(page);
  expect(s.boss?.kind).toBe('demon');
  expect(watched.errors).toEqual([]);
});

test('the beaten Demon ends the fight, and leaves no heart or shard', async ({ page }) => {
  const watched = watchPage(page);
  await toTheDemon(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(1);
  });
  // Beside it, facing it, clear of its body.
  const d = (await snapshot(page)).boss ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 27, y - 8, 'right'), d);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  const s = await snapshot(page);
  expect(s.pickups).toEqual([]);
  expect(s.opened).toContain('vault/1,1/boss');
  expect(s.sealed).toBe(false);
  expect(watched.errors).toEqual([]);
});

test('beating the Demon opens Kira’s cell; her rescue ends the game, with the time it took', async ({
  page,
}) => {
  const watched = watchPage(page);
  await toTheDemon(page);
  // Kira waits in her cell (column 10, row 3), but there's no talking to her yet.
  let s = await snapshot(page);
  expect(s.walkerWho).toBe('kira');
  const kira = s.walker ?? { x: 0, y: 0 };
  expect(kira).toEqual({ x: 168, y: 63 });
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), kira);
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await swingOnce(page); // Space only swings
  expect((await snapshot(page)).talking).toBeNull();
  // The Demon beaten: the gates of her cell (columns 9–10, row 4) open.
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(1);
  });
  const d = (await snapshot(page)).boss ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 27, y - 8, 'right'), d);
  expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
  await swingOnce(page);
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
  s = await snapshot(page);
  expect(s.opened).toEqual(expect.arrayContaining(['vault/1,1/9,4', 'vault/1,1/10,4']));
  // Up through the open gate to her.
  await page.evaluate(() => window.__game?.placeHero(168, 100, 'up'));
  await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).player.y < 80);
  // She and Walker speak, by name; after the last page, the ending.
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), kira);
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).talking?.who).toBe('KIRA');
  // (Read in one go: after the last page the game gives way to the ending at any moment.)
  const talkNow = () =>
    page.evaluate(() => {
      const g = window.__game;
      return g?.scene() === 'Game' ? (g.snapshot()?.talking ?? null) : null;
    });
  const speakers = new Set<string>();
  for (let talking = await talkNow(); talking; talking = await talkNow()) {
    speakers.add(talking.who);
    const at = talking.page;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await talkNow())?.page ?? -1).not.toBe(at);
  }
  expect(speakers).toEqual(new Set(['KIRA', 'WALKER']));
  await expect.poll(() => sceneNow(page)).toBe('Ending');
  const ending = await page.evaluate(() => window.__game?.ending());
  expect(ending?.time).toMatch(/^\d+:\d\d:\d\d$/);
  // A moment, then Enter goes back to the title.
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.ending()))?.ready)
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Title');
  expect(watched.errors).toEqual([]);
});

/**
 * In the Sorcerer's hall: beats him (by the test hooks, with any sword) and then the
 * Demon he becomes, so the gates of Kira's cell open.
 */
async function beatTheFinalBoss(page: Page): Promise<void> {
  const hit = async () => {
    const b = (await snapshot(page)).boss ?? { x: 0, y: 0, kind: '' };
    const gap = b.kind === 'demon' ? 27 : 20;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y, 'right'), {
      x: b.x - gap,
      y: b.y - 8,
    });
    expect((await untilGame(page, (s) => !s.invulnerable)).invulnerable).toBe(false);
    await swingOnce(page);
  };
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    window.__game?.setBossHealth(13);
    window.__game?.breakBossShield();
  });
  await hit(); // even the Wooden Sword's 1 brings him to half
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('demon');
  await page.evaluate(() => window.__game?.setBossHealth(1));
  await hit();
  await expect.poll(async () => (await snapshot(page)).boss).toBeNull();
}

/**
 * Starts a talk with whoever waits here (Walker, or Kira) and turns all its pages at
 * once (the finishTalk hook); the paging itself is tested on its own.
 */
async function talkThrough(page: Page): Promise<void> {
  const w = (await snapshot(page)).walker ?? { x: 0, y: 0 };
  await page.evaluate(({ x, y }) => window.__game?.placeHero(x - 12, y, 'right'), w);
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).talking).not.toBeNull();
  await page.evaluate(() => window.__game?.finishTalk());
}

test('a whole run with no skip sets the fastest time, and the title shows it', async ({ page }) => {
  const watched = watchPage(page);
  // A new game; all 8 shards (by the test hook); Walker opens the vault door.
  await openGame(page);
  await page.evaluate(() => {
    window.__game?.holdEnemies(true);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) window.__game?.takeShard(n);
    window.__game?.goToRoom(6, 6);
    window.__game?.clearEnemies();
  });
  await talkThrough(page);
  await page.evaluate(() => window.__game?.placeHero(240, 90, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).travelling, { timeout: 10_000, intervals: [50] })
    .toBe(true);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  expect((await snapshot(page)).cheated).toBe(false);
  // Up to the Sorcerer's hall, through him and the Demon, and Kira is free.
  await page.evaluate(() => window.__game?.goToRoom(1, 1));
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('sorcerer');
  await beatTheFinalBoss(page);
  await talkThrough(page); // Kira, and her rescue
  await expect.poll(() => sceneNow(page)).toBe('Ending');
  const ending = await page.evaluate(() => window.__game?.ending());
  expect(ending?.newBest).toBe(true);
  expect(ending?.best).toBe(ending?.time);
  // Back at the title: the fastest time.
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.ending()))?.ready)
    .toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Title');
  const title = await page.evaluate(() => window.__game?.title());
  expect(title?.fastest).toBe(ending?.time);
  expect(watched.errors).toEqual([]);
});

test('a play-test run (?dungeon=n) never sets the fastest time', async ({ page }) => {
  const watched = watchPage(page);
  // A fastest time set once the title is up: leaving a page still loading its art makes
  // WebKit log each cancelled load as an error.
  await page.goto('./');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Title');
  await page.evaluate(() => localStorage.setItem('dungeon-delve:fastest', '3600000'));
  await openGame(page, '?dungeon=9');
  await page.evaluate(() => window.__game?.goToRoom(1, 1));
  await expect.poll(async () => (await snapshot(page)).boss?.kind).toBe('sorcerer');
  await beatTheFinalBoss(page);
  await talkThrough(page); // Kira, and her rescue
  await expect.poll(() => sceneNow(page)).toBe('Ending');
  const ending = await page.evaluate(() => window.__game?.ending());
  expect(ending?.newBest).toBe(false);
  expect(ending?.best).toBe('1:00:00');
  expect(await page.evaluate(() => localStorage.getItem('dungeon-delve:fastest'))).toBe('3600000');
  expect(watched.errors).toEqual([]);
});

test('P pauses: the controls show and the game waits, its play time too; Esc resumes', async ({
  page,
}) => {
  const watched = watchPage(page);
  await openGame(page);
  const before = (await snapshot(page)).playMs;
  await page.keyboard.press('p');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.pause()))?.screen)
    .toBe('paused');
  expect(await sceneNow(page)).toBe('Pause');
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  // A second paused: the clock stood still for it.
  expect((await snapshot(page)).playMs - before).toBeLessThan(600);
  expect(await page.evaluate(() => window.__game?.pause())).toBeNull();
  expect(watched.errors).toEqual([]);
});

test('Q on the pause screen asks first; N goes back, Y goes up to the arcade', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=1');
  await page.keyboard.press('p');
  await expect.poll(() => sceneNow(page)).toBe('Pause');
  await page.keyboard.press('q');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.pause()))?.screen)
    .toBe('confirmQuit');
  await page.keyboard.press('n');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.pause()))?.screen)
    .toBe('paused');
  // Yes: up one folder, to the arcade (here the test server's root, without the ?dungeon=1).
  await page.keyboard.press('q');
  await expect
    .poll(async () => (await page.evaluate(() => window.__game?.pause()))?.screen)
    .toBe('confirmQuit');
  const here = page.url();
  await page.keyboard.press('y');
  await expect.poll(() => page.url()).not.toBe(here);
  expect(new URL(page.url()).search).toBe('');
  expect(watched.errors).toEqual([]);
});

test('?dungeon=9 starts in the Shadow Vault, with every prize', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page, '?dungeon=9');
  const s = await snapshot(page);
  expect(s.map).toBe('vault');
  expect(s.room).toEqual({ col: 1, row: 2 });
  // The last dungeons' prizes are in the bag.
  await chooseItem(page, 'near', 'Star Blade');
  await chooseItem(page, 'spell', 'Ward');
  expect(watched.errors).toEqual([]);
});

test('a new game starts at the village gate; a house’s walls stop Jarrett', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  let s = await snapshot(page);
  expect(s.room).toEqual({ col: 8, row: 11 });
  expect(s.region).toBe('village');
  // The west street: a house whose walls fill columns 3–7, rows 5–7. Its steps (column 5,
  // below the door) lead into the shop, so walk up into the wall beside them, at column 4.
  await page.evaluate(() => window.__game?.goToRoom(6, 9));
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
  await page.evaluate(() => window.__game?.goToRoom(8, 8));
  await page.evaluate(() => window.__game?.clearEnemies());
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 8, row: 7 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('vault');

  // The vault's door, in the room to the west: columns 14–15 of its south face (row 3).
  await page.evaluate(() => window.__game?.goToRoom(6, 6));
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
  await page.evaluate(() => window.__game?.goToRoom(6, 11));
  await page.evaluate(() => window.__game?.clearEnemies());
  // goToRoom puts him at the room's start cell, which can be next to a robot: let any knockback end.
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(60, 94, 'left'));
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 5, row: 11 });
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('marsh');

  // A pond in the north-west of the marsh fills columns 7–10, rows 4–6: walk up into it.
  await page.evaluate(() => window.__game?.goToRoom(0, 6));
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
  // From the vault grounds' south-east room, east through the grounds' edge (rows 4–5).
  await page.evaluate(() => window.__game?.goToRoom(8, 6));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(260, 94, 'right'));
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 9, row: 6 });
  await expect.poll(async () => (await snapshot(page)).sliding).toBe(false);
  expect((await snapshot(page)).region).toBe('vault');
  // On across it (its ghosts cleared, so none is in his way), into the ruins.
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 10, row: 6 });
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
  await page.evaluate(() => window.__game?.goToRoom(6, 3));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(160, 60, 'up'));
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).room, { timeout: 15_000 })
    .toEqual({ col: 6, row: 2 });
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
  await page.evaluate(() => window.__game?.goToRoom(14, 0));
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
  await page.evaluate(() => window.__game?.goToRoom(6, 9));
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
  expect((await snapshot(page)).room).toEqual({ col: 6, row: 9 });
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
  await page.evaluate(() => window.__game?.goToRoom(0, 5));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(56, 78, 'left'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.hollow).toBe(1);
  expect((await snapshot(page)).opened).not.toContain('overworld/0,5/2,4');
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('overworld/0,5/2,4');
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
  expect((await snapshot(page)).room).toEqual({ col: 0, row: 5 });
  expect(watched.errors).toEqual([]);
});

test('a secret cave in the ruins holds a heart container, kept in the save', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(14, 6));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  // The false wall at column 16, row 3, struck twice from the left.
  await page.evaluate(() => window.__game?.placeHero(248, 62, 'right'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.hollow).toBe(1);
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();
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
  await page.evaluate(() => window.__game?.goToRoom(8, 11));
  await reloadToTitle(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  expect((await snapshot(page)).health.max).toBe(8);
});

test('a stone in the east meadow hides a hole down to a cave', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(10, 11));
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
  await page.evaluate(() => window.__game?.giveItem('fireball')); // dungeon 2's prize
  const opened = async () =>
    (await snapshot(page)).opened.filter((id) => id.startsWith('overworld/'));
  // The start room's boulder fills columns 4–5, rows 6–7. Strike it from above with the sword.
  await page.evaluate(() => window.__game?.placeHero(72, 92, 'down'));
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).sounds.block).toBe(1);
  expect(await opened()).toEqual([]);
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();

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
    .toEqual([
      'overworld/8,11/4,6',
      'overworld/8,11/5,6',
      'overworld/8,11/4,7',
      'overworld/8,11/5,7',
    ]);
  expect((await snapshot(page)).sounds.crumble).toBe(1);
  // Where it stood, he walks on through.
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(120);
  await page.keyboard.up('ArrowDown');

  // A cracked wall (put here for the test; they're placed in M4.4/M5) smashes too.
  await page.evaluate(() => window.__game?.setCell(11, 5, 'x'));
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'right'));
  expect((await untilGame(page, (s) => s.sword === null)).sword).toBeNull();
  await page.keyboard.press('Space');
  await expect.poll(opened).toContain('overworld/8,11/11,5');

  // A thorn bush, two cells to his left: a Fireball burns it.
  await page.evaluate(() => window.__game?.setCell(7, 5, 't'));
  await page.evaluate(() => window.__game?.placeHero(160, 94, 'left'));
  await page.keyboard.press('c');
  await expect.poll(opened).toContain('overworld/8,11/7,5');
  expect((await snapshot(page)).sounds.burn).toBe(1);
  expect(watched.errors).toEqual([]);
});

test('a Fireball burns the thorns in front of a secret cave in the forest', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.giveItem('fireball')); // dungeon 2's prize
  await page.evaluate(() => window.__game?.holdEnemies(true));
  // West of the vault grounds: thorns at column 1, row 7, with a hole behind them.
  await page.evaluate(() => window.__game?.goToRoom(4, 5));
  await page.evaluate(() => window.__game?.clearEnemies());
  await expect.poll(async () => (await snapshot(page)).knockedBack).toBe(false);
  await page.evaluate(() => window.__game?.placeHero(44, 126, 'left'));
  await page.keyboard.press('c');
  await expect.poll(async () => (await snapshot(page)).opened).toContain('overworld/4,5/1,7');
  await holdUntil(page, 'ArrowLeft', async () => (await snapshot(page)).map === 'caves');
  await expect.poll(async () => (await snapshot(page)).travelling).toBe(false);
  const gems = (await snapshot(page)).gems;
  await page.evaluate(() => window.__game?.placeHero(152, 86, 'up'));
  await holdUntil(page, 'ArrowUp', async () => (await snapshot(page)).gems === gems + 30);
  expect(watched.errors).toEqual([]);
});

/** Defeats the room's first enemy with the sword (enemies held still), swinging from above it. */
async function defeatFirstEnemy(page: Page): Promise<void> {
  const before = (await snapshot(page)).defeated;
  for (let swing = 0; swing < 6 && (await snapshot(page)).defeated === before; swing++) {
    await expect.poll(() => settled(page)).toBe(true);
    const e = (await snapshot(page)).enemies[0];
    if (!e) break;
    await page.evaluate(({ x, y }) => window.__game?.placeHero(x, y - 16, 'down'), e);
    await swingOnce(page);
  }
  await expect.poll(async () => (await snapshot(page)).defeated).toBe(before + 1);
}

// (Split in two, overworld and dungeon, to keep each well inside WebKit's 30 s per test.)
test('overworld enemies come back after four rooms away', async ({ page }) => {
  const watched = watchPage(page);
  await openGame(page);
  await page.evaluate(() => window.__game?.holdEnemies(true));
  const enemies = async () => (await snapshot(page)).enemies.length;
  // The west meadow's two robots: defeat one.
  await page.evaluate(() => window.__game?.goToRoom(6, 11));
  expect(await enemies()).toBe(2);
  await defeatFirstEnemy(page);
  // One room away and back: still gone.
  await page.evaluate(() => window.__game?.goToRoom(8, 11));
  await page.evaluate(() => window.__game?.goToRoom(6, 11));
  expect(await enemies()).toBe(1);
  // Four rooms away (none of them this one) and back: both are back.
  for (const [c, r] of [
    [8, 11],
    [8, 9],
    [6, 9],
    [10, 9],
  ] as const) {
    await page.evaluate(({ c, r }) => window.__game?.goToRoom(c, r), { c, r });
  }
  await page.evaluate(() => window.__game?.goToRoom(6, 11));
  expect(await enemies()).toBe(2);
  expect(watched.errors).toEqual([]);
});

test('dungeon enemies never come back', async ({ page }) => {
  const watched = watchPage(page);
  const enemies = async () => (await snapshot(page)).enemies.length;
  // In dungeon 1, a defeated enemy stays gone: through other rooms, and after saving and continuing.
  await page.goto('./?dungeon=1');
  await expect.poll(() => sceneNow(page), { timeout: 15_000 }).toBe('Game');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(1, 2)); // the hub: two robots
  expect(await enemies()).toBe(2);
  await defeatFirstEnemy(page);
  for (const [c, r] of [
    [1, 3],
    [0, 2],
    [2, 2],
    [1, 1],
    [1, 3],
  ] as const) {
    await page.evaluate(({ c, r }) => window.__game?.goToRoom(c, r), { c, r });
  }
  await page.evaluate(() => window.__game?.goToRoom(1, 2));
  expect(await enemies()).toBe(1);
  // Saved at the entrance (its save point) just before; continue, and it's still gone.
  await reloadToTitle(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => sceneNow(page)).toBe('Game');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  await page.evaluate(() => window.__game?.goToRoom(1, 2));
  expect(await enemies()).toBe(1);
  expect(watched.errors).toEqual([]);
});
