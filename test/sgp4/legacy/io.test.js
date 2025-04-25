/**
 * @file   Tests from Sgp4JsUtils.js to ensure compatibility
 * @since  0.2.0
 */

import { Sgp4 } from '../../../src/main';
import badTleData from './io.json';

describe('Twoline', () => {
  it('twoline to satellite record', () => {
    badTleData.forEach((tleDataItem) => {
      const satrec = Sgp4.createSatrec(tleDataItem.tleLine1, tleDataItem.tleLine2);

      tleDataItem.results.forEach((expected) => {
        // Fetching satellite record from incorrectly formatted TLE lines
        expect(satrec.error).toEqual(expected.error);
      });
    });
  });
});
