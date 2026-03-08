/**
 * Integration test: npm pack, install in temp dir, import by package name.
 * Simulates what a real consumer experiences after `npm install ootk`.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('npm pack & install', () => {
  let tempDir: string;
  let tarball: string;
  const rootDir = path.resolve(__dirname, '../..');

  beforeAll(() => {
    // Pack the library
    const packOutput = execSync('npm pack --json', { cwd: rootDir, encoding: 'utf-8' });
    const packInfo = JSON.parse(packOutput);

    tarball = path.join(rootDir, packInfo[0].filename);

    // Create a temp consumer project
    tempDir = mkdtempSync(path.join(tmpdir(), 'ootk-test-'));
    writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-consumer', type: 'module', private: true }),
    );
    execSync(`npm install "${tarball}"`, { cwd: tempDir, stdio: 'pipe' });
  }, 30_000);

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    if (tarball) {
      rmSync(tarball, { force: true });
    }
  });

  it('should import ESM via package name', () => {
    // Write script to file to avoid shell quoting issues
    const scriptPath = path.join(tempDir, 'test-esm.mjs');

    writeFileSync(
      scriptPath,
      [
        'import { Tle, Satellite, Sun, EpochUTC, Vector3D } from "ootk";',
        'const ok = typeof Tle === "function" && typeof Satellite === "function"',
        '  && typeof Sun === "object" && typeof EpochUTC === "function"',
        '  && typeof Vector3D === "function";',
        'console.log(JSON.stringify({ ok, Tle: typeof Tle, Satellite: typeof Satellite, Sun: typeof Sun }));',
        'if (!ok) process.exit(1);',
      ].join('\n'),
    );

    const result = execSync(`node "${scriptPath}"`, {
      cwd: tempDir,
      encoding: 'utf-8',
    });
    const info = JSON.parse(result.trim());

    expect(info.ok).toBe(true);
    expect(info.Tle).toBe('function');
    expect(info.Satellite).toBe('function');
    expect(info.Sun).toBe('object'); // Sun is a singleton instance
  });

  it('should require CJS via package name', () => {
    // Write script to file to avoid shell quoting issues
    const scriptPath = path.join(tempDir, 'test-cjs.cjs');

    writeFileSync(
      scriptPath,
      [
        'const { Tle, Satellite, Sun, EpochUTC, Vector3D } = require("ootk");',
        'const ok = typeof Tle === "function" && typeof Satellite === "function"',
        '  && typeof Sun === "object" && typeof EpochUTC === "function"',
        '  && typeof Vector3D === "function";',
        'console.log(JSON.stringify({ ok, Tle: typeof Tle, Satellite: typeof Satellite, Sun: typeof Sun }));',
        'if (!ok) process.exit(1);',
      ].join('\n'),
    );

    const result = execSync(`node "${scriptPath}"`, {
      cwd: tempDir,
      encoding: 'utf-8',
    });
    const info = JSON.parse(result.trim());

    expect(info.ok).toBe(true);
    expect(info.Tle).toBe('function');
    expect(info.Satellite).toBe('function');
    expect(info.Sun).toBe('object'); // Sun is a singleton instance
  });

  it('should have no production dependencies', () => {
    const pkg = JSON.parse(readFileSync(path.join(tempDir, 'node_modules/ootk/package.json'), 'utf-8'));

    expect(pkg.dependencies).toBeUndefined();
  });

  it('should only contain dist files', () => {
    const entries = readdirSync(path.join(tempDir, 'node_modules/ootk'));

    // Should have dist/, package.json, README, LICENSE — but NOT src/, test/, etc.
    expect(entries).toContain('dist');
    expect(entries).toContain('package.json');
    expect(entries).not.toContain('src');
    expect(entries).not.toContain('test');
    expect(entries).not.toContain('node_modules');
  });
});
