/**
 * @file   Test Suite to verify results match Appendix D from Revisiting Spacetrack Report #3
 * @author Theodore Kruczek.
 * @since  0.2.0
 */

import { Sgp4 } from '@lib/ootk';
import sgp4FailData from './sgp4-full-cov-fail.json';
import sgp4Data from './sgp4-full-cov.json';

describe('Verification TLE Data in Appendix D of Revisiting Spacetrack Report #3: Rev 1', () => {
  sgp4Data.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.tleLine1, sgp4DataItem.tleLine2);

    if (sgp4DataItem.error) {
      test(`if ${sgp4DataItem.description} fails`, () => {
        expect(satrec.error).toEqual(sgp4DataItem.error);
      });
    } else {
      test(`if ${sgp4DataItem.description} passes`, () => {
        sgp4DataItem.results.forEach((expected) => {
          const sgp4Result = Sgp4.propagate(satrec, expected.time, 'a');

          expect(sgp4Result.position.x).toBeCloseTo(expected.position.x);
          expect(sgp4Result.position.y).toBeCloseTo(expected.position.y);
          expect(sgp4Result.position.z).toBeCloseTo(expected.position.z);
          expect(sgp4Result.velocity.x).toBeCloseTo(expected.velocity.x);
          expect(sgp4Result.velocity.y).toBeCloseTo(expected.velocity.y);
          expect(sgp4Result.velocity.z).toBeCloseTo(expected.velocity.z);
        });
      });
    }
  });
});

describe('Verify getgravconst options', () => {
  const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753';
  const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';

  test('if wgs72old can be selected', () => {
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72old', 'a');

    expect(satrec.xmcof).toEqual(-1.8859361255715234e-11);
  });
  test('if wgs84 can be selected', () => {
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs84', 'a');

    expect(satrec.xmcof).toEqual(-1.8859472970032445e-11);
  });
  test('if other gravconst values cause an error', () => {
    expect(() => Sgp4.createSatrec(line1, line2, 'wgs96', 'a')).toThrowError(new Error('unknown gravity option wgs96'));
  });
});

describe('Verification of Fail Cases', () => {
  sgp4FailData.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(sgp4DataItem.tleLine1, sgp4DataItem.tleLine2);

    test(`if ${sgp4DataItem.description} fails`, () => {
      expect(satrec.error).toEqual(sgp4DataItem.error);
    });
  });
});

describe('Test vector equations in SGP4', () => {
  test('if invjday calculates date', () => {
    expect(Sgp4.invjday(2450000, 0)).toEqual({
      day: 9,
      hr: 12,
      min: 0,
      mon: 10,
      sec: 0,
      year: 1995,
    });
    expect(Sgp4.jday(1995, 10, 9, 12, 0, 0)).toEqual({
      jd: 2449999.5,
      jdFrac: 0.5,
    });

    const jday1 = { jd: 2450000, jdFrac: 0 };
    const epoch1 = jday1.jd + jday1.jdFrac;
    const jday2 = Sgp4.jday(1995, 10, 9, 12, 0, 0);
    const epoch2 = jday2.jd + jday2.jdFrac;

    expect(epoch1).toEqual(epoch2);
  });
});

/*
 * Describe('Test conversions in sgp4-utils', () => {
 *   test('If degreesLat is accurate', () => {
 *     expect(Sgp4Utils.degreesLat(0.5)).toEqual(28.64788975654116);
 *   });
 *   test('If degreesLong is accurate', () => {
 *     expect(Sgp4Utils.degreesLong(0.5)).toEqual(28.64788975654116);
 *   });
 *   test('If radiansLat is accurate', () => {
 *     expect(Sgp4Utils.radiansLat(45)).toEqual(0.7853981633974483);
 *   });
 *   test('If radiansLong is accurate', () => {
 *     expect(Sgp4Utils.radiansLong(45)).toEqual(0.7853981633974483);
 *   });
 */

/*
 *   Test(`if sgp4-utils checks for errors`, () => {
 *     expect(() => Sgp4Utils.degreesLat(-100)).toThrowError(
 *       new RangeError('Latitude radians must be in range [-PI/2; PI/2].')
 *     );
 *     expect(() => Sgp4Utils.degreesLat(100)).toThrowError(
 *       new RangeError('Latitude radians must be in range [-PI/2; PI/2].')
 *     );
 *     expect(() => Sgp4Utils.degreesLong(-100)).toThrowError(
 *       new RangeError('Longitude radians must be in range [-PI; PI].')
 *     );
 *     expect(() => Sgp4Utils.degreesLong(100)).toThrowError(
 *       new RangeError('Longitude radians must be in range [-PI; PI].')
 *     );
 */

/*
 *     Expect(() => Sgp4Utils.radiansLat(-100)).toThrowError(
 *       new RangeError('Latitude degrees must be in range [-90; 90].')
 *     );
 *     expect(() => Sgp4Utils.radiansLat(100)).toThrowError(
 *       new RangeError('Latitude degrees must be in range [-90; 90].')
 *     );
 *     expect(() => Sgp4Utils.radiansLong(-300)).toThrowError(
 *       new RangeError('Longitude degrees must be in range [-180; 180].')
 *     );
 *     expect(() => Sgp4Utils.radiansLong(300)).toThrowError(
 *       new RangeError('Longitude degrees must be in range [-180; 180].')
 *     );
 *   });
 * });
 */

describe('Ensure bstar and ndot account for leading zeros', () => {
  test('if bstar reads in leading zero without exponent', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  00098-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.bstar).toEqual(0.00098);
  });
  test('if bstar reads in leading zero when doing exponents', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  00098-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.bstar).toEqual(0.0000000098);
  });
  test('if bstar reads in negative number', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0 -00098-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.bstar).toEqual(-0.0000000098);
  });
  test('if ndot reads in leading zero', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .10000000  00023-0  12398-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.nddot).toEqual(0.00023);
  });
  test('if ndot reads in leading zero and applies exponents', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .10000000  00023-4  12398-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.nddot).toEqual(0.000000023);
  });
  test('if ndot reads in negative value with leading zeroes', () => {
    const line1 = '1 00005U 58002B   00179.78495062 -.10000000 -00023-0  12398-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72', 'i');

    expect(satrec.nddot).toEqual(-0.00023);
  });
});
