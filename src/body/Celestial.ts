import { AzEl, Degrees, RaDec, Radians } from '../ootk';
import { RAD2DEG } from '../utils/constants';
import { Sun } from './Sun';

export class Celestial {
  private constructor() {
    // disable constructor
  }

  static getStarAzEl(date: Date, lat: Degrees, lon: Degrees, ra: Radians, dec: Radians): AzEl<Degrees> {
    const c: RaDec = {
      ra,
      dec,
    };
    const azEl = Sun.azEl(date, lat, lon, c);

    const el = <Radians>(azEl.el + Celestial.astroRefraction(azEl.el)); // elevation correction for refraction

    return {
      az: (azEl.az * RAD2DEG) as Degrees,
      el: (el * RAD2DEG) as Degrees,
    };
  }

  /**
   * get astro refraction
   * @param {Radians} h - elevation
   * @returns {number} refraction
   */
  static astroRefraction(h: Radians): Radians {
    if (h < 0) {
      h = <Radians>0;
    }

    return <Radians>(0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)));
  }

  /**
   * get declination
   * @param {number} l - ecliptic longitude
   * @param {number} b - ecliptic latitude
   * @returns {number} declination
   */
  static declination(l: number, b: number): Radians {
    return <Radians>Math.asin(Math.sin(b) * Math.cos(Sun.e) + Math.cos(b) * Math.sin(Sun.e) * Math.sin(l));
  }

  /**
   * get right ascension
   * @param {number} l - ecliptic longitude
   * @param {number} b - ecliptic latitude
   * @returns {number} right ascension
   */
  static rightAscension(l: number, b: number): Radians {
    return <Radians>Math.atan2(Math.sin(l) * Math.cos(Sun.e) - Math.tan(b) * Math.sin(Sun.e), Math.cos(l));
  }

  /**
   * get elevation (sometimes called altitude)
   * @param {number} H - siderealTime
   * @param {Radians} phi - latitude
   * @param {Radians} dec - The declination of the sun
   * @returns {Radians} elevation
   */
  static elevation(H: number, phi: Radians, dec: Radians): Radians {
    return <Radians>Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  }

  /**
   * get azimuth
   * @param {number} H - siderealTime
   * @param {Radians} phi - latitude
   * @param {Radians} dec - The declination of the sun
   * @returns {Radians} azimuth in rad
   */
  static azimuth(H: number, phi: Radians, dec: Radians): Radians {
    return <Radians>(Math.PI + Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)));
  }
}
