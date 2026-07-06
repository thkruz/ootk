import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
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
