import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
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
