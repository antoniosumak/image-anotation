import { defineConfig } from 'vitest/config'

// Deliberately not the app's `vite.config.ts`. The tested seam is the editor
// core, which is plain TypeScript with no DOM dependency, so the test run has
// no reason to boot the TanStack Start plugin.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
