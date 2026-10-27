import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'path';

export default defineConfig({
  test: {
    /*
     * Cap fork concurrency. The default (one fork per logical core - 32 on the
     * dev box) makes the initial worker burst exceed what Windows will commit,
     * and forks die semi-randomly with "Zone Allocation failed - process out
     * of memory". Same cap as the keeptrack-space parent's vitest.config.ts.
     */
    maxWorkers: Math.min(12, Math.max(1, os.availableParallelism() - 1)),
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    root: path.resolve(__dirname),
    alias: {
      // Not needed - we import directly from ../../dist/main.js
    },
  },
  resolve: {
    alias: {
      // Direct path resolution for dist imports
    },
  },
});
