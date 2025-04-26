import { FormatTle, TleParams } from '../../src/main';

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

    expect(tle.tle1).toBe('1 00001U 58001A   17206.18396726 +.00000000 +00000+0 +00000-0 0 09990');
    expect(tle.tle2).toBe('2 00001 051.6400 208.9163 0006317 069.9862 025.2906 15.54225995 00010');
  });

  // Should be able to convert argument of perigee to a stringified number
  it('should convert argument of perigee to a stringified number when given a number', () => {
    const argPe = 69.9862;

    const result = FormatTle.argumentOfPerigee(argPe);

    expect(result).toBe('069.9862');
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
    }).toThrow('ecen length is not 7');
  });

  /*
   * Should be able to convert the mean anomaly to a string representation with
   * 8 digits
   */
  it('should convert the mean anomaly to a string representation with 8 digits', () => {
    const meana = 25.2906;
    const result = FormatTle.meanAnomaly(meana);

    expect(result).toBe('025.2906');
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
