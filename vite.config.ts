import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at games.soncrant.com/<slug>/
  // and on GitHub Pages staging (ADR-004).
  base: './',
  server: { port: 5184, strictPort: true },
  preview: { port: 6184, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/logic/**'],
      // The owner's rule: every line and branch of the game rules is tested.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
