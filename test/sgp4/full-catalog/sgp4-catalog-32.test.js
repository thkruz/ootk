
/* eslint-disable no-sync */
/* eslint-disable prefer-destructuring */
/**
 * @file   Test Suite to verify results match OscState32.json which is a subset of the entire catalog from Aug 2022
 * @author Theodore Kruczek.
 * @since  1.5.5
 */

import * as fs from 'fs';

/**
 * sgp4Data is from SGP4Prop 8.3 Build: Apr 27 2022
 */
import { Sgp4 } from '../../../lib/ootk';

const fileName = 'TLE_32';
const rawData = fs.readFileSync(`test/sgp4/full-catalog/${fileName}.json`, 'utf8');
// Convert to JSON
const sgp4Data = JSON.parse(rawData);

describe('OscState32 testing', () => {
  sgp4Data.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.line1, sgp4DataItem.line2);
    const satnum = sgp4DataItem.line1.slice(2, 7);

    it(`${satnum} measurements match snapshot`, () => {
      expect(Sgp4.propagate(satrec, 0)).toMatchSnapshot();
      expect(Sgp4.propagate(satrec, 360)).toMatchSnapshot();
      expect(Sgp4.propagate(satrec, 720)).toMatchSnapshot();
      expect(Sgp4.propagate(satrec, 1080)).toMatchSnapshot();
      expect(Sgp4.propagate(satrec, 1440)).toMatchSnapshot();
    });
  });
});
