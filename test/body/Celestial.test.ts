import { Degrees, Radians } from './../../src/types/types';
import { Celestial } from './../../src/body/Celestial';

describe('Celestial', () => {
  /*
   * Calculates the azimuth and elevation of a celestial object at a given date,
   * latitude, longitude, right ascension, and declination.
   */
  it('should calculate the azimuth and elevation when given valid inputs', () => {
    const mockExampleDate = new Date(1705109326817);
    const lat = 37.7749 as Degrees; // latitude of San Francisco
    const lon = -122.4194 as Degrees; // longitude of San Francisco
    const ra = 1.3963 as Radians; // right ascension of a celestial object
    const dec = 0.7854 as Radians; // declination of a celestial object

    const azEl = Celestial.azEl(mockExampleDate, lat, lon, ra, dec);

    expect(azEl).toMatchSnapshot();
  });

  // Calculates the atmospheric refraction for a given elevation.
  it('should calculate the atmospheric refraction when given a valid elevation', () => {
    const elevation = 0.5 as Radians;
    const refraction = Celestial.atmosphericRefraction(elevation);

    expect(refraction).toMatchSnapshot();
  });

  // Calculates the declination of a celestial object given its ecliptic longitude and latitude.
  it('should calculate the declination when given valid ecliptic longitude and latitude', () => {
    const longitude = 0.5 as Radians;
    const latitude = 0.3 as Radians;

    const declination = Celestial.declination(longitude, latitude);

    expect(declination).toMatchSnapshot();
  });

  // Calculates the right ascension of a celestial object given its ecliptic longitude and latitude.
  it('should calculate the right ascension when given valid ecliptic longitude and latitude', () => {
    const longitude = 0.5 as Radians;
    const latitude = 0.3 as Radians;

    const rightAscension = Celestial.rightAscension(longitude, latitude);

    expect(rightAscension).toMatchSnapshot();
  });

  // Calculates the elevation of a celestial object given its sidereal time, latitude, and declination.
  it('should calculate the elevation when given valid sidereal time, latitude, and declination', () => {
    const siderealTime = 1.2;
    const latitude = 0.5 as Radians;
    const declination = 0.3 as Radians;

    const elevation = Celestial.elevation(siderealTime, latitude, declination);

    expect(elevation).toMatchSnapshot();
  });

  // Calculates the azimuth of a celestial object given its sidereal time, latitude, and declination.
  it('should calculate the azimuth when given valid sidereal time, latitude, and declination', () => {
    const siderealTime = 1.2;
    const latitude = 0.5 as Radians;
    const declination = 0.3 as Radians;

    const azimuth = Celestial.azimuth(siderealTime, latitude, declination);

    expect(azimuth).toMatchSnapshot();
  });

  // Calculates the atmospheric refraction for an elevation of 0.
  it('should calculate the atmospheric refraction when elevation is 0', () => {
    const elevation = 0 as Radians;

    const refraction = Celestial.atmosphericRefraction(elevation);

    expect(refraction).toMatchSnapshot();
  });
});
