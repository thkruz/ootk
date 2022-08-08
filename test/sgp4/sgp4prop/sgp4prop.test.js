/**
 * @file   Test Suite to verify results match Appendix D from Revisiting Spacetrack Report #3
 * @author Theodore Kruczek.
 * @since  1.5.5
 */

/**
 * sgp4Data is from SGP4Prop 8.3 Build: Apr 27 2022
 */
import { Sgp4 } from '@lib/ootk';
import { compareVectors } from '@test/lib/compareVectors';
import sgp4Data from './sgp4prop.json';

describe('HQ AFSPC Sgp4Prop DLL - Version: v8.3 - Build: Apr 27 2022 - Platform: Windows 64-bit', () => {
  sgp4Data.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.tle1, sgp4DataItem.tle2);

    test(`if ${sgp4DataItem.tle1.slice(2, 7)} passes`, () => {
      sgp4DataItem.results.forEach((expected) => {
        const sgp4Result = Sgp4.propagate(satrec, expected.time, 'a');

        compareVectors(sgp4Result.position, expected.position, 7); // Sgp4Prop only recorded to 8 decimal places
        compareVectors(sgp4Result.velocity, expected.velocity, 7); // Sgp4Prop only recorded to 8 decimal places
      });
    });
  });
});
