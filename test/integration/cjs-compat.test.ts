/**
 * Integration test: Verify CJS output works and matches ESM exports.
 */
import { createRequire } from 'node:module';
import * as esmExports from '../../dist/main.js';

describe('CJS Compatibility', () => {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cjs = require('../../dist/main.cjs');

  it('should load via require()', () => {
    expect(cjs).toBeDefined();
  });

  it('should export core classes', () => {
    expect(cjs.Satellite).toBeDefined();
    expect(cjs.Tle).toBeDefined();
    expect(cjs.Sun).toBeDefined();
    expect(cjs.Moon).toBeDefined();
    expect(cjs.Sgp4).toBeDefined();
    expect(cjs.Vector3D).toBeDefined();
    expect(cjs.EpochUTC).toBeDefined();
    expect(cjs.ForceModel).toBeDefined();
    expect(cjs.Earth).toBeDefined();
  });

  it('should have matching exports between ESM and CJS', () => {
    const esmKeys = Object.keys(esmExports).sort();
    const cjsKeys = Object.keys(cjs)
      .filter((k) => k !== 'default' && k !== '__esModule')
      .sort();

    expect(cjsKeys).toEqual(esmKeys);
  });

  it('should allow instantiation of core classes', () => {
    const tle1 = '1 25544U 98067A   21203.91986111  .00000884  00000-0  24396-4 0  9997';
    const tle2 = '2 25544  51.6442 207.2585 0001375 324.3422 180.8032 15.48919840294437';

    expect(cjs.Tle.satNum(tle1)).toBe(25544);

    const epoch = new cjs.EpochUTC(0);

    expect(epoch).toBeDefined();
  });
});
