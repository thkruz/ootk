import { defineConfig } from 'vitest/config';
import os from 'node:os';
import path from 'node:path';

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
    include: [
      '**/test/**/*.test.ts',
      '**/test/**/*.spec.ts',
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test/integration/**',
      '**/test/sgp4/sgp4prop/**',
      '**/test/sgp4/full-catalog/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['lcov', 'html', 'text'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'lib/**',
        'commonjs/**',
        'test/**',
        'scripts/**',
        'coverage/**',
        '**/__tests__/**',
      ],
    },
    globalSetup: './test/lib/globalSetup.ts',
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
});
