import { expect, test, type Page } from '@playwright/test';
import { MAPS, type MapId } from '../../src/world/maps';

/**
 * ROADMAP M8.5: every room of every map is drawn, in every browser, with no
 * console errors: the overworld, all eight dungeons, the Shadow Vault, the
 * secret caves and the shop. (The game's own tests play through each part;
 * this makes sure nothing anywhere fails to draw.)
 */

type Stop = { map: MapId; col: number; row: number };

/** Every room of these maps, in order. */
const roomsOf = (maps: readonly MapId[]): Stop[] =>
  maps.flatMap((map) => MAPS[map].rooms.map(({ col, row }) => ({ map, col, row })));

/** Goes into each room in turn (enemies held still), a frame drawn in each; no errors on the way. */
async function sweep(page: Page, stops: readonly Stop[]): Promise<void> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('./?dungeon=1');
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene() ?? null), { timeout: 15_000 })
    .toBe('Game');
  await page.evaluate(() => window.__game?.holdEnemies(true));
  for (const { map, col, row } of stops) {
    const at = await page.evaluate(
      async ([m, c, r]) => {
        window.__game?.goToMap(m, c, r);
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        const s = window.__game?.snapshot();
        return s ? `${s.map} ${s.room.col},${s.room.row}` : null;
      },
      [map, col, row] as const,
    );
    expect(at).toBe(`${map} ${col},${row}`);
  }
  expect(errors).toEqual([]);
}

// The overworld is big (each room takes WebKit a moment): four quarters, each its own test.
const overworld = roomsOf(['overworld']);
const quarter = Math.ceil(overworld.length / 4);
for (const n of [1, 2, 3, 4]) {
  test(`every room of the overworld draws with no errors (quarter ${n})`, async ({ page }) => {
    await sweep(page, overworld.slice((n - 1) * quarter, n * quarter));
  });
}

test('every room of dungeons 1 to 4 draws with no errors', async ({ page }) => {
  await sweep(page, roomsOf(['dungeon1', 'dungeon2', 'dungeon3', 'dungeon4']));
});

test('every room of dungeons 5 to 8 draws with no errors', async ({ page }) => {
  await sweep(page, roomsOf(['dungeon5', 'dungeon6', 'dungeon7', 'dungeon8']));
});

test('every room of the Shadow Vault, the secret caves and the shop draws with no errors', async ({
  page,
}) => {
  await sweep(page, roomsOf(['vault', 'caves', 'shop']));
});
