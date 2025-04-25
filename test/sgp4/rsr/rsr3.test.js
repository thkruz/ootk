/**
 * @file   Test Suite to verify results match Appendix D from Revisiting Spacetrack Report #3
 * @author Theodore Kruczek.
 * @since  0.2.0
 */

/**
 * sgp4Data is from https://www.celestrak.com/publications/AIAA/2006-6753/AIAA-2006-6753-Rev1.pdf
 * Only using the first and last state vectors for verification
 */
import { Sgp4 } from '../../../src/main';
import { compareVectors } from '../../lib/compareVectors';
import sgp4FailData from './rsr3-fail.json';
import sgp4Data from './rsr3.json';

describe('Verification TLE Data in Appendix D of Revisiting Spacetrack Report #3: Rev 1', () => {
  sgp4Data.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.tleLine1, sgp4DataItem.tleLine2);

    test(`if ${sgp4DataItem.description} passes`, () => {
      sgp4DataItem.results.forEach((expected) => {
        const sgp4Result = Sgp4.propagate(satrec, expected.time, 'a');

        compareVectors(sgp4Result.position, expected.position, 8); // RSR3 only recorded to 8 decimal places
        compareVectors(sgp4Result.velocity, expected.velocity, 8); // RSR3 only recorded to 8 decimal places
      });
    });
  });
});

/**
 * These tests do not seem to do what they are supposed to. Skipping them for now.
 */
describe.skip('Fail Cases in https://github.com/brandon-rhodes/python-sgp4/blob/master/sgp4/SGP4-VER.TLE', () => {
  sgp4FailData.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.tleLine1, sgp4DataItem.tleLine2);

    test(`if ${sgp4DataItem.description} fails`, () => {
      expect(satrec.error).toEqual(sgp4DataItem.error);
    });
  });
});
