import { Degrees, EpochUTC, Moon, Vector3D } from '../../src/main';

describe('Moon', () => {
  let exampleDate: Date;

  beforeEach(() => {
    const mockExampleDate = new Date(1705109326817);

    exampleDate = new Date(mockExampleDate.getTime());
  });

  // The static property 'mu' should be accessible and have a value of 4902.799.
  it('should have a static property "mu" with value 4902.799', () => {
    expect(Moon.mu).toBe(4902.799);
  });

  /*
   * The static property 'radiusEquator' should be accessible and have a value
   * of 1738.0.
   */
  it('should have a static property "radiusEquator" with value 1738.0', () => {
    expect(Moon.radiusEquator).toBe(1738.0);
  });

  /*
   * The static method 'eci' should be callable with an "EpochUTC" parameter and
   * return a 'Vector3D' object.
   */
  it('should be callable with an "EpochUTC" parameter and return a "Vector3D" object', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const result = Moon.eci(epoch);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'illumination' should be callable with an "EpochUTC"
   * parameter and an optional 'origin' parameter, and return a number between 0
   * and 1.
   */
  it('should be callable with an "EpochUTC" parameter and an optional "origin" parameter', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const result = Moon.illumination(epoch);

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  /*
   * The static method 'diameter' should be callable with two 'Vector3D'
   * parameters and return a number.
   */
  it('should be callable with two "Vector3D" parameters and return a number', () => {
    const obsPos = new Vector3D(1, 2, 3);
    const moonPos = new Vector3D(4, 5, 6);
    const result = Moon.diameter(obsPos, moonPos);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'eci' should throw an error if the "EpochUTC" parameter
   * is not provided.
   */
  it('should throw an error if the "EpochUTC" parameter is not provided', () => {
    expect(() => {
      Moon.eci();
    }).not.toThrow('EpochUTC parameter is required');
  });

  /*
   * The static method 'illumination' should return 0.5 if the 'origin'
   * parameter is not provided.
   */
  it('should return 0.5 if the "origin" parameter is not provided', () => {
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const result = Moon.illumination(epoch);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'diameter' should return 0 if the two 'Vector3D'
   * parameters are the same.
   */
  it('should return NaN if the two "Vector3D" parameters are the same', () => {
    const pos = new Vector3D(1, 2, 3);
    const result = Moon.diameter(pos, pos);

    expect(result).toBeNaN();
  });

  /*
   * The static method 'getMoonIllumination' should be callable with a 'number'
   * or 'Date' parameter and return a 'MoonIlluminationData' object.
   */
  it('should return a MoonIlluminationData object when called with a number parameter', () => {
    const date = 1635724800000; // November 1, 2021
    const result = Moon.getMoonIllumination(date);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'rae' should be callable with a 'Date', 'Degrees', and
   * 'Degrees' parameters and return an object with 'az', 'el', 'rng', and
   * 'parallacticAngle' properties.
   */
  it('should return an object with \'az\', \'el\', \'rng\', and \'parallacticAngle\' properties', () => {
    const date = new Date(1635724800000); // November 1, 2021
    const lat = 37.7749 as Degrees; // San Francisco latitude
    const lon = -122.4194 as Degrees; // San Francisco longitude
    const result = Moon.rae(date, lat, lon);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'getMoonTimes' should be callable with a 'Date',
   * 'Degrees', 'Degrees', and 'boolean' parameters and return an object with
   * 'rise', 'set', 'ye', 'alwaysUp', 'alwaysDown', and 'highest' properties.
   */
  it('should return with \'rise\', \'set\', \'ye\', \'alwaysUp\', \'alwaysDown\', \'highest\' properties', () => {
    const date = exampleDate;
    const lat = 37.7749 as Degrees; // San Francisco latitude
    const lon = -122.4194 as Degrees; // San Francisco longitude
    const isUtc = false;
    const result = Moon.getMoonTimes(date, lat, lon, isUtc);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'rae' should be callable with a 'Date', 'Degrees', and
   * 'Degrees' parameters and return an object with 'az', 'el', 'rng', and
   * 'parallacticAngle' properties.
   */
  it('should return an object with \'az\', \'el\', \'rng\', and \'parallacticAngle\' properties', () => {
    const date = new Date(exampleDate); // November 1, 2021
    const lat = 37.7749 as Degrees; // San Francisco latitude
    const lon = -122.4194 as Degrees; // San Francisco longitude
    const result = Moon.rae(date, lat, lon);

    expect(result).toMatchSnapshot();
  });

  /*
   * The static method 'getMoonTimes' should be callable with a 'Date',
   * 'Degrees', 'Degrees', and 'boolean' parameters and return an object with
   * 'rise', 'set', 'ye', 'alwaysUp', 'alwaysDown', and 'highest' properties.
   */
  it('should return with \'rise\', \'set\', \'ye\', \'alwaysUp\', \'alwaysDown\', and \'highest\' properties', () => {
    const date = new Date(exampleDate.getTime() - exampleDate.getTimezoneOffset() * 60000);
    const lat = 37.7749 as Degrees; // San Francisco latitude
    const lon = -122.4194 as Degrees; // San Francisco longitude
    const isUtc = false;
    const result = Moon.getMoonTimes(date, lat, lon, isUtc);

    expect(result).toMatchSnapshot();
  });

  /*
   * The private method 'moonCoords' should be callable with a 'number'
   * parameter and return a 'RaDec' object.
   */
  it('should call the private method \'moonCoords\' with a number parameter and return a RaDec object', () => {
    const d = 123456789;
    const result = Moon.moonCoords(d);

    expect(result).toMatchSnapshot();
  });
});
