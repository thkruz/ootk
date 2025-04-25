import { Degrees, EpochUTC, Kilometers, Meters, Sun, Vector3D } from '../../src/main';

describe('Sun', () => {
  let exampleDate: Date;

  beforeEach(() => {
    const mockExampleDate = new Date(1705109326817);

    exampleDate = new Date(mockExampleDate.getTime());
  });

  /*
   * The 'azEl' method should return the azimuth and elevation of the sun given
   * a date, latitude, and longitude.
   */
  it('should return the azimuth and elevation of the sun given a date, latitude, and longitude', () => {
    const lat = 37.7749 as Degrees;
    const lon = -122.4194 as Degrees;
    const result = Sun.azEl(exampleDate, lat, lon);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'date2jSince2000' method should return the number of days since January
   * 1, 2000, for a given date.
   */
  it('should return the number of days since January 1, 2000, for a given date', () => {
    const result = Sun.date2jSince2000(exampleDate);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'diameter' method should return the angular diameter of the sun given
   * the observer's position and the sun's position.
   */
  it('should return the angular diameter of the sun given the observers position and the suns position', () => {
    const obsPos = new Vector3D<Kilometers>(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const sunPos = new Vector3D<Kilometers>(1 as Kilometers, 1 as Kilometers, 1 as Kilometers);
    const result = Sun.diameter(obsPos, sunPos);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipseAngles' method should return the angles necessary to determine
   * if a satellite is in the shadow of the earth.
   */
  it('should return the angles necessary to determine if a satellite is in the shadow of the earth', () => {
    const satPos = new Vector3D<Kilometers>(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const sunPos = new Vector3D<Kilometers>(1 as Kilometers, 1 as Kilometers, 1 as Kilometers);
    const result = Sun.eclipseAngles(satPos, sunPos);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipticLatitude' method should return the ecliptic latitude of the
   * sun given the solar latitude.
   */
  it('should return the ecliptic latitude of the sun given the solar latitude', () => {
    const B = 23.4397;
    const result = Sun.eclipticLatitude(B);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipticLongitude' method should return the ecliptic longitude of the
   * sun given the solar mean anomaly.
   */
  it('should return the ecliptic longitude of the sun given the solar mean anomaly', () => {
    const M = 0;
    const result = Sun.eclipticLongitude(M);

    expect(result).toMatchSnapshot();
  });

  // The 'date2jSince2000' method should handle invalid dates.
  it('should handle invalid dates', () => {
    const date = new Date('invalid');
    const result = Sun.date2jSince2000(date);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'diameter' method should handle cases where the observer's position is
   * the same as the sun's position.
   */
  it('should handle cases where the observers position is the same as the suns position', () => {
    const obsPos = new Vector3D<Kilometers>(1 as Kilometers, 1 as Kilometers, 1 as Kilometers);
    const sunPos = new Vector3D<Kilometers>(1 as Kilometers, 1 as Kilometers, 1 as Kilometers);
    const result = Sun.diameter(obsPos, sunPos);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipseAngles' method should handle cases where the satellite is
   * directly above or below the earth.
   */
  it('should handle cases where the satellite is directly above or below the earth', () => {
    const satPos = new Vector3D<Kilometers>(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const sunPos = new Vector3D<Kilometers>(0 as Kilometers, 0 as Kilometers, 1 as Kilometers);
    const result = Sun.eclipseAngles(satPos, sunPos);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipticLatitude' method should handle extreme values of solar
   * latitude.
   */
  it('should handle extreme values of solar latitude', () => {
    const B = 90;
    const result = Sun.eclipticLatitude(B);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'eclipticLongitude' method should handle extreme values of solar mean
   * anomaly.
   */
  it('should handle extreme values of solar mean anomaly', () => {
    const M = 360;
    const result = Sun.eclipticLongitude(M);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'getSetJulian' method should return the Julian date of the sunrise,
   * sunset, or other solar event given the observer's position, date, and time.
   */
  it('should return the Julian date of the sunrise when the observers position, date, and time are provided', () => {
    // Mock input values
    const lat = 40;
    const lon = -75;
    const c = { ra: 0, dec: 0 };

    // Call the method
    const result = Sun.getSetJulian(0 as Meters, lon, lat, c.dec, 0, 0, 0);

    // Assert the result
    expect(result).toMatchSnapshot();
  });

  /*
   * The 'getSunTimeByAz' method should return the date and time of the sun's
   * position given a specific azimuth.
   */
  it('should return the date and time of the suns position given a specific azimuth', () => {
    const lat = 37.7749 as Degrees;
    const lon = -122.4194 as Degrees;
    const az = 1.5 as Degrees;
    const result = Sun.getSunTimeByAz(exampleDate, lat, lon, az);

    expect(result).toMatchSnapshot();
  });

  /*
   * The 'getTimes' method should return the sunrise, sunset, and other solar
   * event times for a given date, latitude, and longitude.
   */
  it('should return the sunrise, sunset, and other event times when given a date, latitude, and longitude', () => {
    // Mock input values
    const lat = 37.7749 as Degrees;
    const lon = -122.4194 as Degrees;

    // Call the getTimes method
    const result = Sun.getTimes(exampleDate, lat, lon);

    // Use toMatchSnapshot to test output of the getTimes method
    expect(result).toMatchSnapshot();
  });

  it('should return the same shadow result given the same time and position', () => {
    const result = Sun.shadow(
      EpochUTC.fromDateTime(exampleDate),
      new Vector3D<Kilometers>(8000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    );

    expect(result).toMatchSnapshot();
  });

  // positionApparent
  it('should return the same apparent position result given the same time and position', () => {
    const result = Sun.positionApparent(EpochUTC.fromDateTime(exampleDate));

    expect(result).toMatchSnapshot();
  });

  // sunlightLegacy
  it('should return the same sunlight result given the same positions', () => {
    const result = Sun.sunlightLegacy(new Vector3D(8000, 0, 0), new Vector3D(1000000, 0, 0));

    expect(result).toMatchSnapshot();
  });

  // lightingRatio
  it('should return the same lighting ratio result given the same positions', () => {
    const result = Sun.lightingRatio(
      new Vector3D<Kilometers>(8000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
      new Vector3D<Kilometers>(1000000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    );

    expect(result).toMatchSnapshot();
  });

  // julianCyle
  it('should return the same julian cycle result given the same date', () => {
    const result = Sun.julianCycle(exampleDate, -75 as Degrees);

    expect(result).toMatchSnapshot();
  });
});
