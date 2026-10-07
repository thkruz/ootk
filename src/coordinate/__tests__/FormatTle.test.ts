import { FormatTle, TleParams } from '../../main';

describe('FormatTle', () => {
  // Should be able to create a TLE string based on provided TleParams
  it('should create a TLE string when given valid TleParams', () => {
    const tleParams: TleParams = {
      inc: '51.6400',
      meanmo: '15.54225995',
      rasc: '208.9163',
      argPe: '69.9862',
      meana: '25.2906',
      ecen: '0.0006317',
      epochyr: '17',
      epochday: '206.18396726',
      intl: '58001A',
      scc: '00001',
    };

    const tle = FormatTle.createTle(tleParams);

    expect(tle.tle1).toBe('1 00001U 58001A   17206.18396726  .00000000  00000+0  00000+0 0  9991');
    expect(tle.tle2).toBe('2 00001  51.6400 208.9163 0006317  69.9862  25.2906 15.54225995    06');
  });

  // Should be able to convert argument of perigee to a stringified number
  it('should convert argument of perigee to a stringified number when given a number', () => {
    const argPe = 69.9862;

    const result = FormatTle.argumentOfPerigee(argPe);

    expect(result).toBe(' 69.9862');
  });

  // Should be able to return the eccentricity value of a given string
  it('should return the eccentricity value of a given string', () => {
    const ecen = '0.0006317';

    const result = FormatTle.eccentricity(ecen);

    expect(result).toBe('0006317');
  });

  // Should throw an error if the length of the eccentricity string is not 7
  it('should throw an error if the length of the eccentricity string is not 7', () => {
    const ecen = '0.00063171';

    expect(() => {
      FormatTle.eccentricity(ecen);
    }).toThrow('Eccentricity must be 7 characters');
  });

  /*
   * Should be able to convert the mean anomaly to a string representation with
   * 8 digits
   */
  it('should convert the mean anomaly to a string representation with 8 digits', () => {
    const meana = 25.2906;
    const result = FormatTle.meanAnomaly(meana);

    expect(result).toBe(' 25.2906');
  });

  /*
   * Should be able to convert the mean motion value to a string representation
   * with 8 decimal places
   */
  it('should convert the mean motion value to a string representation with 8 decimal places', () => {
    const meanmo = 15.54225995;
    const result = FormatTle.meanMotion(meanmo);

    expect(result).toBe('15.54225995');
  });

  // Should be able to convert the right ascension value to a stringified number
  it('should convert the right ascension value to a stringified number', () => {
    const rasc = 123.4567;
    const result = FormatTle.rightAscension(rasc);

    expect(result).toBe('123.4567');
  });

  // Should be able to set a character at a specific index in a string
  it('should set a character at a specific index in a string when given valid parameters', () => {
    const str = 'Hello, World!';
    const index = 7;
    const chr = '!';

    const result = FormatTle.setCharAt(str, index, chr);

    expect(result).toBe('Hello, !orld!');
  });
});

describe('FormatTle.formatTleExponential', () => {
  it('should format a typical drag term', () => {
    expect(FormatTle.formatTleExponential(0.00017507)).toBe(' 17507-3');
  });

  it('should format zero and non-finite values as an empty field', () => {
    expect(FormatTle.formatTleExponential(0)).toBe(' 00000+0');
    expect(FormatTle.formatTleExponential(NaN)).toBe(' 00000+0');
    expect(FormatTle.formatTleExponential(Infinity)).toBe(' 00000+0');
  });

  it('should mark negative values with a leading minus', () => {
    expect(FormatTle.formatTleExponential(-0.00017507)).toBe('-17507-3');
  });

  /*
   * Regression: BSTAR of exactly 0.01 (NORAD 12833 / COSMOS 1109 DEB) used to
   * produce the 9-character " 100000-2". Math.log10(0.01) is exact, so the
   * mantissa came out as 0.09999999999999999, tripped the "< 0.1" correction and
   * then rounded back up to a 6-digit 100000 — widening the field and shifting
   * every later column of TLE line 1 by one.
   */
  it('should keep exact powers of ten to five mantissa digits', () => {
    expect(FormatTle.formatTleExponential(0.01)).toBe(' 10000-1');
    expect(FormatTle.formatTleExponential(-0.01)).toBe('-10000-1');
    expect(FormatTle.formatTleExponential(0.001)).toBe(' 10000-2');
    expect(FormatTle.formatTleExponential(0.1)).toBe(' 10000+0');
    expect(FormatTle.formatTleExponential(1)).toBe(' 10000+1');
  });

  it('should treat magnitudes below a one-digit exponent as zero', () => {
    expect(FormatTle.formatTleExponential(1e-10)).toBe(' 10000-9');
    expect(FormatTle.formatTleExponential(1e-11)).toBe(' 00000+0');
    expect(FormatTle.formatTleExponential(-1e-11)).toBe(' 00000+0');
  });

  it('should always return exactly eight characters', () => {
    const values = [0, 1e-12, 1e-11, 1e-10, 1e-9, 0.00001, 0.0001, 0.001, 0.01, 0.1, 1, 10, 1e9, 1e12];

    for (const value of values) {
      expect(FormatTle.formatTleExponential(value)).toHaveLength(8);
      expect(FormatTle.formatTleExponential(-value)).toHaveLength(8);
    }

    // Deterministic sweep across the whole representable range, including the
    // mantissa-carry boundary just under each power of ten.
    for (let exponent = -11; exponent <= 2; exponent++) {
      for (const mantissa of [1, 1.000001, 1.5, 9.99999, 9.999999, 9.9999999]) {
        const value = mantissa * 10 ** exponent;

        expect(FormatTle.formatTleExponential(value)).toHaveLength(8);
        expect(FormatTle.formatTleExponential(-value)).toHaveLength(8);
      }
    }
  });

  it('should build a 69-character line 1 for the BSTAR that used to overflow', () => {
    const { tle1 } = FormatTle.createTle({
      inc: '65.5589',
      meanmo: '2.00448581',
      rasc: '143.6094',
      argPe: '158.4276',
      meana: '261.4784',
      ecen: '0.6926485',
      epochyr: '99',
      epochday: '259.61443205',
      intl: '79058E',
      scc: '12833',
      bstar: 0.01,
      meanMotionDot: 0.00000673,
      meanMotionDdot: 0,
    });

    expect(tle1).toHaveLength(69);
    // Ephemeris type must stay in column 63 (0-indexed 62) rather than shifting.
    expect(tle1.substring(62, 63)).toBe('0');
  });
});
