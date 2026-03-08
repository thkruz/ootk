/**
 * Integration test: Bundle size and content validation.
 * Guards against unexpected size bloat and verifies bundling invariants.
 */
import { statSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('Bundle Size & Content', () => {
  const distDir = path.resolve(__dirname, '../../dist');

  it('ESM bundle should be under 1.5 MB', () => {
    const size = statSync(path.join(distDir, 'main.js')).size;

    expect(size).toBeLessThan(1.5 * 1024 * 1024);
    expect(size).toBeGreaterThan(100 * 1024); // sanity: at least 100 KB
  });

  it('CJS bundle should be under 1.5 MB', () => {
    const size = statSync(path.join(distDir, 'main.cjs')).size;

    expect(size).toBeLessThan(1.5 * 1024 * 1024);
    expect(size).toBeGreaterThan(100 * 1024);
  });

  it('should have type declaration files', () => {
    expect(() => statSync(path.join(distDir, 'main.d.ts'))).not.toThrow();
    expect(() => statSync(path.join(distDir, 'main.d.cts'))).not.toThrow();
  });

  it('should not contain sourcemap files', () => {
    expect(() => statSync(path.join(distDir, 'main.js.map'))).toThrow();
    expect(() => statSync(path.join(distDir, 'main.cjs.map'))).toThrow();
  });

  it('ESM should not reference external astronomy-engine', () => {
    const esm = readFileSync(path.join(distDir, 'main.js'), 'utf-8');

    expect(esm).not.toContain('from \'astronomy-engine\'');
    expect(esm).not.toContain('from "astronomy-engine"');
  });

  it('CJS should not reference external astronomy-engine', () => {
    const cjs = readFileSync(path.join(distDir, 'main.cjs'), 'utf-8');

    expect(cjs).not.toContain('require(\'astronomy-engine\')');
    expect(cjs).not.toContain('require("astronomy-engine")');
  });

  it('type declarations should not reference astronomy-engine', () => {
    const dts = readFileSync(path.join(distDir, 'main.d.ts'), 'utf-8');

    expect(dts).not.toContain('from \'astronomy-engine\'');
    expect(dts).not.toContain('from "astronomy-engine"');
  });
});
