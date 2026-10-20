import { defineConfig, devices } from '@playwright/test';

const PORT = 6185;
// An explicit address, so the test server and the browsers always agree on
// where to connect, however "localhost" resolves on the machine.
const HOST = '127.0.0.1';
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://${HOST}:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec\.ts/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /phone\.spec\.ts/ },
    // Safari's engine (owner 2026-10-20). Linux WebKit, so it checks the game's
    // behaviour in WebKit, not Safari's macOS graphics.
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /phone\.spec\.ts/ },
    // A phone (owner 2026-10-20), on Chromium's Pixel 7 emulation.
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.ts/ },
  ],
  webServer: {
    // The e2e build is the normal build plus the test hook (src/debug/testHook.ts).
    command: `npm run build:e2e && vite preview --outDir dist-e2e --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}/`,
    // Never reuse a server already on the port: one that isn't ours can vanish
    // mid-run. Better to stop at once with "port already in use".
    reuseExistingServer: false,
    // Show the server's own output, so a crash explains itself in the test log.
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
