/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file SunMath is a collection of functions for calculating the position of the sun
 * and other stars. This was originally created by Vladimir Agafonkin. Robert Gester's
 * update was referenced for documentation. There were a couple of bugs in both versions
 * so there will be some differences if you are migrating from either to this library.
 *
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2022 Theodore Kruczek
 *
 * @Copyright (c) 2011-2015, Vladimir Agafonkin
 * SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 * https://github.com/mourner/suncalc
 *
 * Reworked and enhanced by Robert Gester
 * @Copyright (c) 2022 Robert Gester
 * https://github.com/hypnos3/suncalc3
 *
 * sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable max-params */

import { AzEl, Meters, SunTime } from '../types/types';
import { DEG2RAD, MS_PER_DAY } from './constants';
import { Degrees, Radians } from '../ootk';

type J2000Value = number;
const TAU = Math.PI * 2; // https://tauday.com/tau-manifesto

export class SunMath {
  private static readonly J1970 = 2440587.5;
  private static readonly J2000 = 2451545;
  private static readonly J0 = 0.0009;
  private static readonly e = DEG2RAD * 23.4397;

  private static times = [
    [6, 'goldenHourDawnEnd', 'goldenHourDuskStart'], // GOLDEN_HOUR_2
    [-0.3, 'sunriseEnd', 'sunsetStart'], // SUNRISE_END
    [-0.833, 'sunriseStart', 'sunsetEnd'], // SUNRISE
    [-1, 'goldenHourDawnStart', 'goldenHourDuskEnd'], // GOLDEN_HOUR_1
    [-4, 'blueHourDawnEnd', 'blueHourDuskStart'], // BLUE_HOUR
    [-6, 'civilDawn', 'civilDusk'], // DAWN
    [-8, 'blueHourDawnStart', 'blueHourDuskEnd'], // BLUE_HOUR
    [-12, 'nauticalDawn', 'nauticalDusk'], // NAUTIC_DAWN
    [-15, 'amateurDawn', 'amateurDusk'],
    [-18, 'astronomicalDawn', 'astronomicalDusk'], // ASTRO_DAWN
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static julianCycle(d: number, lw: number): number {
    const lonOffset = lw / TAU;

    return Math.round(d - SunMath.J0 - lonOffset);
  }

  /**
   * calculates the obderver angle
   * @param {number} alt  the observer altitude (in meters) relative to the horizon
   * @returns {number} height for further calculations
   */
  private static observerAngle(alt: Meters): Degrees {
    return (-2.076 * Math.sqrt(alt)) / 60;
  }

  /**
   * get solar mean anomaly
   * @param {number} d - julian day
   * @returns {number} solar mean anomaly
   */
  private static solarMeanAnomaly(d: number): number {
    return DEG2RAD * (357.5291 + 0.98560028 * d);
  }

  /**
   * convert Julian calendar to date object
   * @param {number} julian day number in Julian calendar to convert
   * @return {number} result date as timestamp
   */
  static julian2date(julian: number): Date {
    return new Date((julian - SunMath.J1970) * MS_PER_DAY);
  }

  /**
   * get number of days for a dateValue since 2000
   *
   * See: https://en.wikipedia.org/wiki/Epoch_(astronomy)
   *
   * @param {number} date date as timestamp to get days
   * @return {number} count of days
   */
  static date2jSince2000(date: Date): number {
    return date.getTime() / MS_PER_DAY + SunMath.J1970 - SunMath.J2000;
  }

  /**
   * get right ascension
   * @param {number} l - ecliptic longitude
   * @param {number} b - ecliptic latitude
   * @returns {number} right ascension
   */
  static rightAscension(l: number, b: number): Radians {
    return Math.atan2(Math.sin(l) * Math.cos(SunMath.e) - Math.tan(b) * Math.sin(SunMath.e), Math.cos(l));
  }

  /**
   * get declination
   * @param {number} l - ecliptic longitude
   * @param {number} b - ecliptic latitude
   * @returns {number} declination
   */
  static declination(l: number, b: number): Radians {
    return Math.asin(Math.sin(b) * Math.cos(SunMath.e) + Math.cos(b) * Math.sin(SunMath.e) * Math.sin(l));
  }

  /**
   * get azimuth
   * @param {number} H - siderealTime
   * @param {Radians} phi - latitude
   * @param {Radians} dec - The declination of the sun
   * @returns {Radians} azimuth in rad
   */
  static azimuth(H: number, phi: Radians, dec: Radians): Radians {
    return Math.PI + Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  }

  /**
   * get elevation (sometimes called altitude)
   * @param {number} H - siderealTime
   * @param {Radians} phi - latitude
   * @param {Radians} dec - The declination of the sun
   * @returns {Radians} elevation
   */
  static elevation(H: number, phi: Radians, dec: Radians): Radians {
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  }

  /**
   * side real time
   * @param {number} d - julian day
   * @param {Radians} lw - longitude of the observer
   * @returns {number} sidereal time
   */
  static siderealTime(d: number, lw: Radians): number {
    return DEG2RAD * (280.16 + 360.9856235 * d) - lw;
  }

  /**
   * get astro refraction
   * @param {Radians} h - elevation
   * @returns {number} refraction
   */
  static astroRefraction(h: Degrees): Radians {
    if (h < 0) {
      h = 0;
    }

    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  }

  /**
   * ecliptic longitude
   * @param {number} M - solar mean anomaly
   * @returns {number} ecliptic longitude
   */
  static eclipticLongitude(M: number): number {
    const C = DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = DEG2RAD * 102.9372; // perihelion of Earth

    return M + C + P + Math.PI; // Sun's mean longitude
  }

  /**
   * ecliptic latitude
   * @param {number} B - ?
   * @returns {number} ecliptic latitude
   */
  static eclipticLatitude(B: number): number {
    const C = TAU / 360;
    const L = B - 0.00569 - 0.00478 * Math.sin(C * B);

    return TAU * (L + 0.0003 * Math.sin(C * 2 * L));
  }

  /**
   * Julian cycle
   * @param {number} d - number of days
   * @param {number} lw - rad * -lng;
   * @returns {number} julian cycle
   */
  static julianCyle(d: number, lw: number): number {
    return Math.round(d - SunMath.J0 - lw / ((2 * TAU) / 2));
  }

  /**
   * approx transit
   * @param {number} Ht - hourAngle
   * @param {number} lw - rad * -lng
   * @param {number} n - Julian cycle
   * @returns {number} approx transit
   */
  static approxTransit(Ht: number, lw: number, n: number): number {
    return SunMath.J0 + (Ht + lw) / TAU + n;
  }

  /**
   * solar transit in Julian
   * @param {number} ds - approxTransit
   * @param {number} M - solar mean anomal
   * @param {number} L - ecliptic longitude
   * @returns {number} solar transit in Julian
   */
  static solarTransitJulian(ds: number, M: number, L: number): number {
    return SunMath.J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  }

  /**
   * hour angle
   * @param {number} h - heigh at 0
   * @param {number} phi -  rad * lat;
   * @param {number} dec - declination
   * @returns {number} hour angle
   */
  static hourAngle(h: number, phi: number, dec: number): number {
    return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  }

  /**
   * returns set time for the given sun altitude
   * @param {number} h - heigh at 0
   * @param {number} lw - rad * -lng
   * @param {number} phi -  rad * lat;
   * @param {number} dec - declination
   * @param {number} n - Julian cycle
   * @param {number} M - solar mean anomal
   * @param {number} L - ecliptic longitude
   * @returns {number} set time
   */
  static getSetJulian(h: number, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
    const w = SunMath.hourAngle(h, phi, dec);
    const a = SunMath.approxTransit(w, lw, n);

    return SunMath.solarTransitJulian(a, M, L);
  }

  /**
   * returns set time for the given sun altitude
   * @param {Meters} alt - altitude at 0
   * @param {Radians} lw - -lng
   * @param {Radians} phi - lat;
   * @param {Radians} dec - declination
   * @param {number} n - Julian cycle
   * @param {number} M - solar mean anomal
   * @param {number} L - ecliptic longitude
   * @return {J2000Value} sunset time in days since 2000
   */
  private static getSetJ(
    alt: Meters,
    lw: Radians,
    phi: Radians,
    dec: Radians,
    n: number,
    M: number,
    L: Radians,
  ): J2000Value {
    const w = SunMath.hourAngle(alt, phi, dec);
    const a = SunMath.approxTransit(w, lw, n);

    return SunMath.solarTransitJulian(a, M, L);
  }

  /**
   * calculates sun times for a given date and latitude/longitude
   * @param {Date|number} dateVal Date object for calculating sun-times
   * @param {number} lat latitude for calculating sun-times
   * @param {number} lon longitude for calculating sun-times
   * @param {number} [alt=0]  the observer height (in meters) relative to the horizon
   * @param {boolean} [isUtc=false] defines if the calculation should be in utc or local time (default is local)
   * @return {SunTime} result object of sunTime
   */
  static getTimes(dateVal: Date, lat: Degrees, lon: Degrees, alt: Meters = 0, isUtc = false): SunTime {
    if (isNaN(lat)) {
      throw new Error('latitude missing');
    }
    if (isNaN(lon)) {
      throw new Error('longitude missing');
    }

    const date = new Date(dateVal);

    if (isUtc) {
      date.setUTCHours(12, 0, 0, 0);
    } else {
      date.setHours(12, 0, 0, 0);
    }

    let i = 0;
    let len = 0;
    let time = [];
    let h0 = 0;
    let Jset = 0;
    let Jrise = 0;

    const { Jnoon, dh, lw, phi, dec, n, M, L } = SunMath.calculateJnoon(lon, lat, alt, date);

    // Determine when the sun is at its highest and lowest (darkest) points.
    const result = {
      solarNoon: SunMath.julian2date(Jnoon),
      nadir: SunMath.julian2date(Jnoon + 0.5), // https://github.com/mourner/suncalc/pull/125
    };

    // Add all other unique times using Jnoon as a reference
    for (i = 0, len = SunMath.times.length; i < len; i += 1) {
      time = SunMath.times[i];
      h0 = (time[0] + dh) * DEG2RAD;

      Jset = SunMath.getSetJ(h0, lw, phi, dec, n, M, L);
      Jrise = Jnoon - (Jset - Jnoon);

      result[time[1]] = SunMath.julian2date(Jrise);
      result[time[2]] = SunMath.julian2date(Jset);
    }

    return result;
  }

  private static calculateJnoon(lon: number, lat: number, alt: number, date: Date) {
    const lw = DEG2RAD * -lon;
    const phi = DEG2RAD * lat;
    const dh = SunMath.observerAngle(alt);
    const d = SunMath.date2jSince2000(date);

    const n = SunMath.julianCycle(d, lw);
    const ds = SunMath.approxTransit(0, lw, n);
    const M = SunMath.solarMeanAnomaly(ds);
    const L = SunMath.eclipticLongitude(M);
    const dec = SunMath.declination(L, 0);
    const Jnoon = SunMath.solarTransitJulian(ds, M, L);

    return { Jnoon, dh, lw, phi, dec, n, M, L };
  }

  /**
   * calculates time for a given azimuth angle for a given date and latitude/longitude
   * @param {number|Date} dateValue Date object or timestamp for calculating sun-time
   * @param {Degrees} lat latitude for calculating sun-time
   * @param {Degrees} lon longitude for calculating sun-time
   * @param {Radians | Degrees} az azimuth for calculating sun-time
   * @param {boolean} [isDegrees] true if the az angle is in degree and not in rad
   * @return {Date} result time of sun-time
   */
  static getSunTimeByAzimuth(dateValue, lat: Degrees, lon: Degrees, az: Radians | Degrees, isDegrees = false) {
    if (isNaN(az)) {
      throw new Error('azimuth missing');
    }
    if (isNaN(lat)) {
      throw new Error('latitude missing');
    }
    if (isNaN(lon)) {
      throw new Error('longitude missing');
    }

    if (isDegrees) {
      az *= DEG2RAD;
    }
    const date = new Date(dateValue);
    const lw = DEG2RAD * -lon;
    const phi = DEG2RAD * lat;

    let dateVal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).getTime();
    let addval = MS_PER_DAY; // / 2);

    dateVal += addval;

    while (addval > 200) {
      // let nazi = this.getPosition(dateVal, lat, lng).azimuth;
      const d = SunMath.date2jSince2000(new Date(dateVal));
      const c = SunMath.getSunRaDec(d);
      const H = SunMath.siderealTime(d, lw) - c.ra;
      const newAz = SunMath.getAzimuth(H, phi, c.dec);

      addval /= 2;
      if (newAz < az) {
        dateVal += addval;
      } else {
        dateVal -= addval;
      }
    }

    return new Date(Math.floor(dateVal));
  }

  /**
   * get azimuth
   * @param {number} H - siderealTime
   * @param {Radians} phi - latitude
   * @param {Radians} dec - The declination of the sun
   * @returns {Radians} azimuth
   */
  private static getAzimuth(H, phi, dec) {
    return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
  }

  /**
   * Convert Date to Solar Date/Time
   *
   * Based on https://www.pveducation.org/pvcdrom/properties-of-sunlight/solar-time
   *
   * See: https://github.com/mourner/suncalc/pull/156
   *
   * @param {date} date - Date to calculate for
   * @param {number} utcOffset - UTC offset in hours
   * @param {Degrees} lon - Longitude in degrees
   * @returns {Date} - Date Object in Solar Time
   */
  static getSolarTime(date: Date, utcOffset: number, lon: number) {
    // calculate the day of year
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const dayOfYear = Math.floor(diff / MS_PER_DAY);

    const b = (360 / 365) * (dayOfYear - 81) * DEG2RAD;
    const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    const localSolarTimeMeridian = 15 * utcOffset;
    const timeCorrection = equationOfTime + 4 * (lon - localSolarTimeMeridian);

    return new Date(date.getTime() + timeCorrection * 60 * 1000);
  }

  static getStarAzEl(date: Date, lat: Degrees, lon: Degrees, ra: number, dec: number): AzEl {
    const lw = -lon * DEG2RAD;
    const phi = lat * DEG2RAD;
    const d = SunMath.date2jSince2000(date);
    const H = SunMath.siderealTime(d, lw) - (ra / 12) * Math.PI;
    let h = SunMath.elevation(H, phi, (dec / 180) * Math.PI);

    h += SunMath.astroRefraction(h); // elevation correction for refraction

    return {
      az: SunMath.azimuth(H, phi, (dec / 180) * Math.PI),
      el: h,
    };
  }

  static getSunAzEl(date: Date, lat: Degrees, lon: Degrees): AzEl {
    const lw = -lon * DEG2RAD;
    const phi = lat * DEG2RAD;
    const d = SunMath.date2jSince2000(date);
    const c = SunMath.getSunRaDec(d);
    const H = SunMath.siderealTime(d, lw) - c.ra;

    return {
      az: SunMath.azimuth(H, phi, c.dec),
      el: SunMath.elevation(H, phi, c.dec),
    };
  }

  static getSunRaDec(d: number) {
    const M = SunMath.solarMeanAnomaly(d);
    const L = SunMath.eclipticLongitude(M);

    return {
      dec: SunMath.declination(L, 0),
      ra: SunMath.rightAscension(L, 0),
    };
  }
}
