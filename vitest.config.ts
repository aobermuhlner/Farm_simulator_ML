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
  },
})
