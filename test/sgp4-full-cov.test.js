/**
 * @file   Test Suite to verify results match Appendix D from Revisiting Spacetrack Report #3
 * @author Theodore Kruczek.
 * @since  0.2.0
 */

import { Sgp4 } from '../lib/ootk-sgp4.es.js';
import sgp4Data from './sgp4-full-cov.json';
import sgp4FailData from './sgp4-full-cov-fail.json';

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
  test(`if wgs72old can be selected`, () => {
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs72old', 'a');
    expect(satrec.xmcof).toEqual(-1.8859361255715234e-11);
  });
  test(`if wgs84 can be selected`, () => {
    const satrec = Sgp4.createSatrec(line1, line2, 'wgs84', 'a');
    expect(satrec.xmcof).toEqual(-1.8859472970032445e-11);
  });
  test(`if other gravconst values cause an error`, () => {
    expect(() => Sgp4.createSatrec(line1, line2, 'wgs96', 'a')).toThrowError(
      new Error('unknown gravity option wgs96'),
    );
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
  test('if mag computes a magnitude', () => {
    expect(Sgp4.mag([10, 10, 10])).toEqual(17.320508075688775);
  });
  test('if cross computes a cross product', () => {
    expect(Sgp4.cross([10, 10, 10], [-10, -10, -10])).toEqual([0, 0, 0]);
  });
  test('if dot computes a dot product', () => {
    expect(Sgp4.dot([10, 10, 10], [-10, -10, -10])).toEqual(-300);
  });
  test('if angle computes an angle in radians', () => {
    expect(Sgp4.angle([10, 10, 10], [-10, -10, -10])).toEqual(3.1415926325163688);
  });
  test('if angle returns a huge number when it is the same value', () => {
    /** This test is dumb and using 99999.1 should be replaced with an actual error */
    expect(Sgp4.angle([0, 0, 10], [0, 0, 0])).toEqual(999999.1);
  });
  test('if asinh computes...', () => {
    expect(Sgp4.asinh(Math.PI)).toEqual(1.8622957433108482);
  });
  test('if newtonnu works for circular orbits', () => {
    expect(Sgp4.newtonnu(0, 0)).toEqual({ e0: 0, m: 0 });
  });
  test('if newtonnu works for elliptical orbits', () => {
    expect(Sgp4.newtonnu(0.5, 0)).toEqual({ e0: 0, m: 0 });
  });
  test('if newtonnu works for hyperbolic orbits', () => {
    expect(Sgp4.newtonnu(1, 0)).toEqual({ e0: 0, m: 0 });
  });
  test('if newtonnu works for parabolic orbits', () => {
    expect(Sgp4.newtonnu(1.5, 0)).toEqual({ e0: 0, m: 0 });
  });
  test('if newtonnu works for negative orbits', () => {
    expect(Sgp4.newtonnu(0, -1)).toEqual({ e0: -1, m: 5.283185307179586 });
  });

  test('if vectors can be converted into elements', () => {
    expect(
      Sgp4.rv2coe(
        [-2469.18115234375, -6742.41845703125, -4302.49951171875],
        [5.526907444000244, -4.195889472961426, 0.920195996761322],
        398600.8,
      ),
    ).toEqual({
      a: 8620.589416586823,
      arglat: 999999.1,
      argp: 3.5324404502518094,
      ecc: 0.1845590057042562,
      incl: 0.5976602330329903,
      lonper: 999999.1,
      m: 1.2308092930674526,
      nu: 1.5991142060024006,
      omega: 5.4377740711189215,
      p: 8326.95467068737,
      truelon: 999999.1,
    });
  });

  test('if invjday calculates date', () => {
    expect(Sgp4.invjday(2450000, 0)).toEqual({
      day: 9,
      hr: 12,
      minute: 0,
      mon: 10,
      sec: 0,
      year: 1995,
    });
    expect(Sgp4.jday(1995, 10, 9, 12, 0, 0)).toEqual({
      jd: 2449999.5,
      jdFrac: 0.5,
    });

    let jday1 = { jd: 2450000, jdFrac: 0 };
    let epoch1 = jday1.jd + jday1.jdFrac;
    let jday2 = Sgp4.jday(1995, 10, 9, 12, 0, 0);
    let epoch2 = jday2.jd + jday2.jdFrac;
    expect(epoch1).toEqual(epoch2);
  });
});

// describe('Test conversions in sgp4-utils', () => {
//   test('If degreesLat is accurate', () => {
//     expect(Sgp4Utils.degreesLat(0.5)).toEqual(28.64788975654116);
//   });
//   test('If degreesLong is accurate', () => {
//     expect(Sgp4Utils.degreesLong(0.5)).toEqual(28.64788975654116);
//   });
//   test('If radiansLat is accurate', () => {
//     expect(Sgp4Utils.radiansLat(45)).toEqual(0.7853981633974483);
//   });
//   test('If radiansLong is accurate', () => {
//     expect(Sgp4Utils.radiansLong(45)).toEqual(0.7853981633974483);
//   });

//   test(`if sgp4-utils checks for errors`, () => {
//     expect(() => Sgp4Utils.degreesLat(-100)).toThrowError(
//       new RangeError('Latitude radians must be in range [-PI/2; PI/2].')
//     );
//     expect(() => Sgp4Utils.degreesLat(100)).toThrowError(
//       new RangeError('Latitude radians must be in range [-PI/2; PI/2].')
//     );
//     expect(() => Sgp4Utils.degreesLong(-100)).toThrowError(
//       new RangeError('Longitude radians must be in range [-PI; PI].')
//     );
//     expect(() => Sgp4Utils.degreesLong(100)).toThrowError(
//       new RangeError('Longitude radians must be in range [-PI; PI].')
//     );

//     expect(() => Sgp4Utils.radiansLat(-100)).toThrowError(
//       new RangeError('Latitude degrees must be in range [-90; 90].')
//     );
//     expect(() => Sgp4Utils.radiansLat(100)).toThrowError(
//       new RangeError('Latitude degrees must be in range [-90; 90].')
//     );
//     expect(() => Sgp4Utils.radiansLong(-300)).toThrowError(
//       new RangeError('Longitude degrees must be in range [-180; 180].')
//     );
//     expect(() => Sgp4Utils.radiansLong(300)).toThrowError(
//       new RangeError('Longitude degrees must be in range [-180; 180].')
//     );
//   });
// });

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

describe('verify sgn exports the sign of a number', () => {
  test('if sign is negative then it exports -1', () => {
    expect(Sgp4.sgn(-50)).toEqual(-1);
  });
  test('if sign is positive then it exports 1', () => {
    expect(Sgp4.sgn(25)).toEqual(1);
  });
});
