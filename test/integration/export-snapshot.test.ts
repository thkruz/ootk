/**
 * Integration test: Export snapshot regression detection.
 * Catches accidental removal/renaming of any export from the public API.
 */
import * as ootk from '../../dist/main.js';

describe('Export Snapshot', () => {
  it('should export the expected public API surface', () => {
    const exportKeys = Object.keys(ootk).sort();

    expect(exportKeys).toMatchSnapshot();
  });

  it('should have at least 250 exports', () => {
    // Sanity check: catches catastrophic barrel export breakage
    const count = Object.keys(ootk).length;

    expect(count).toBeGreaterThan(250);
  });
});
