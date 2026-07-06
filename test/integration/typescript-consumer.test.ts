/**
 * Integration test: Verify TypeScript consumers can compile against dist/main.d.ts.
 * Writes a small .ts file and runs tsc --noEmit to check declarations are valid.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('TypeScript Consumer', () => {
  let tempDir: string;
  const rootDir = path.resolve(__dirname, '../..');
  const dtsPath = path.resolve(rootDir, 'dist/main.d.ts').replace(/\\/gu, '/');
  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ootk-ts-test-'));

    writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'bundler',
            noEmit: true,
            skipLibCheck: true,
            baseUrl: '.',
            paths: { ootk: [dtsPath] },
          },
          include: ['test.ts'],
        },
        null,
        2,
      ),
    );

    writeFileSync(
      path.join(tempDir, 'test.ts'),
      [
        '/// <reference path="' + dtsPath + '" />',
        'import type { Kilometers, Seconds, TleLine1, TleLine2 } from "ootk";',
        'import { Tle, EpochUTC, Vector3D } from "ootk";',
        '',
        'const epoch: EpochUTC = new EpochUTC(0 as Seconds);',
        'const vec: Vector3D<Kilometers> = new Vector3D<Kilometers>(1 as Kilometers, 2 as Kilometers, 3 as Kilometers);',
        'const line1 = "1 25544U 98067A   21203.91986111  .00000884  00000-0  24396-4 0  9997" as TleLine1;',
        'const satNum: number = Tle.satNum(line1);',
        '',
        'void epoch; void vec; void satNum;',
      ].join('\n'),
    );
  });

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should compile without errors', () => {
    // Resolve tsc.js via Node's module resolution (works cross-platform)
    const tscJs = require.resolve('typescript/lib/tsc.js');

    try {
      execSync(`node "${tscJs}" --project tsconfig.json`, {
        cwd: tempDir,
        encoding: 'utf-8',
      });
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string };

      // Re-throw with the actual tsc output for diagnostics
      throw new Error(`tsc compilation failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    }
  });
});
