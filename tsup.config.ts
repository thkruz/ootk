import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm', 'cjs'],
  dts: { resolve: ['astronomy-engine'] },
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  treeshake: true,
  noExternal: ['astronomy-engine'],
});
