import { Sgp4OpsMode } from '../../src/enums/Sgp4OpsMode';
import { EciVec3, KilometersPerSecond, Sgp4, Vec3Flat } from '../../src/main';
import { Sgp4GravConstants } from '../../src/sgp4/sgp4';
import { sgp4FullCov } from './sgp4-full-cov';
import { sgp4FullCovFail } from './sgp4-full-cov-fail';

describe('Verification TLE Data in Appendix D of Revisiting Spacetrack Report #3: Rev 1', () => {
  sgp4FullCov.forEach((sgp4DataItem) => {
    // Fetching satellite record from TLE lines
    const satrec = Sgp4.createSatrec(
      sgp4DataItem.tleLine1,
      sgp4DataItem.tleLine2,
      Sgp4GravConstants.wgs72,
      Sgp4OpsMode.AFSPC,
    );

    if ((sgp4DataItem as unknown as { error: true }).error) {
      test(`if ${sgp4DataItem.description} fails`, () => {
        expect(satrec.error).toEqual((sgp4DataItem as unknown as { error: true }).error);
      });
    } else {
      test(`if ${sgp4DataItem.description} passes`, () => {
        sgp4DataItem.results.forEach((expected) => {
          const sgp4Result = Sgp4.propagate(satrec, expected.time);

          expect(sgp4Result).not.toBe(false);
          const position = sgp4Result?.position as EciVec3;
          const velocity = sgp4Result?.velocity as EciVec3<KilometersPerSecond>;

          expect(position.x).toBeCloseTo(expected.position.x);
          expect(position.y).toBeCloseTo(expected.position.y);
          expect(position.z).toBeCloseTo(expected.position.z);
          expect(velocity.x).toBeCloseTo(expected.velocity.x);
          expect(velocity.y).toBeCloseTo(expected.velocity.y);
          expect(velocity.z).toBeCloseTo(expected.velocity.z);
        });
      });
    }
  });
});

describe('Verify getgravconst options', () => {
  const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753';
  const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';

  test('if wgs72old can be selected', () => {
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72old, Sgp4OpsMode.AFSPC);

    expect(satrec.xmcof).toEqual(-1.8859361255715234e-11);
  });
  test('if wgs84 can be selected', () => {
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs84, Sgp4OpsMode.AFSPC);

    expect(satrec.xmcof).toEqual(-1.8859472970032445e-11);
  });
  test('if other gravconst values cause an error', () => {
    expect(() => Sgp4.createSatrec(line1, line2, 'wgs96' as Sgp4GravConstants, Sgp4OpsMode.AFSPC)).toThrow(
      new Error('unknown gravity option wgs96'),
    );
  });
});

describe('Verification of Fail Cases', () => {
  sgp4FullCovFail.forEach((sgp4DataItem) => {
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

describe('Ensure bstar and ndot account for leading zeros', () => {
  test('if bstar reads in leading zero without exponent', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  00098-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.bstar).toEqual(0.00098);
  });
  test('if bstar reads in leading zero when doing exponents', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  00098-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.bstar).toEqual(0.0000000098);
  });
  test('if bstar reads in negative number', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0 -00098-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.bstar).toEqual(-0.0000000098);
  });
  test('if ndot reads in leading zero', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .10000000  00023-0  12398-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.nddot).toEqual(0.00023);
  });
  test('if ndot reads in leading zero and applies exponents', () => {
    const line1 = '1 00005U 58002B   00179.78495062  .10000000  00023-4  12398-0 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.nddot).toEqual(0.000000023);
  });
  test('if ndot reads in negative value with leading zeroes', () => {
    const line1 = '1 00005U 58002B   00179.78495062 -.10000000 -00023-0  12398-5 0  4753';
    const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
    const satrec = Sgp4.createSatrec(line1, line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.IMPROVED);

    expect(satrec.nddot).toEqual(-0.00023);
  });

  test('rv2coe', () => {
    const r = [6524.834, 6862.875, 6448.296] as Vec3Flat;
    const v = [4.901327, 5.533756, -1.976341] as Vec3Flat;

    expect(Sgp4.rv2coe(r, v, 398600.8)).toMatchSnapshot();
  });
});
