import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Engine tests run in node; screen tests need a DOM. Keeping the engine on
  // the node environment is deliberate — `src/` must not acquire a browser
  // dependency by way of its tests.
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['test/**/*.test.ts', 'web/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [['web/**', 'jsdom']],
    /*
     * Well above vitest's 5 s default, because several screen tests walk a whole year of
     * the farm through jsdom and take seconds of wall clock on their own. At the default,
     * whichever of them happened to run while the machine was busiest failed — a different
     * one on every run — which is a suite that reports load rather than correctness. A
     * hanging test still fails here; it just fails for hanging.
     */
    testTimeout: 30000,
  },
})
