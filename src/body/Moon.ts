/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * @copyright (c) 2011-2015, Vladimir Agafonkin
 * @copyright (c) 2022 Robert Gester https://github.com/hypnos3/suncalc3
 * @see suncalc.LICENSE.md
 * Some of the math in this file was originally created by Vladimir Agafonkin.
 * Robert Gester's update was referenced for documentation. There were a couple
 * of bugs in both versions so there will be some differences if you are
 * migrating from either to this library.
 *
 * suncalc is a JavaScript library for calculating sun/moon position and light
 * phases. https://github.com/mourner/suncalc
 * It was reworked and enhanced by Robert Gester.
 *
 * The original suncalc is released under the terms of the BSD 2-Clause License.
 * @see http://aa.quae.nl/en/reken/hemelpositie.html
 * moon calculations are based on formulas from this website
 */

import { AngularDiameterMethod, Celestial, Degrees, Kilometers, RaDec, Radians } from '../main.js';
import { Vector3D } from '../operations/Vector3D.js';
import { EpochUTC } from '../time/EpochUTC.js';
import { DEG2RAD, MS_PER_DAY } from '../utils/constants.js';
import { angularDiameter } from '../utils/functions.js';
import { Earth } from './Earth.js';
import { Sun } from './Sun.js';

type MoonIlluminationData = {
  fraction: number;
  phase: {
    from: number;
    to: number;
    id: string;
    emoji: string;
    code: string;
    name: string;
    weight: number;
    css: string;
  };
  phaseValue: number;
  angle: number;
  next: {
    value: number;
    date: string;
    type: string;
    newMoon: {
      value: number;
      date: string;
    };
    fullMoon: {
      value: number;
      date: string;
    };
    firstQuarter: {
      value: number;
      date: string;
    };
    thirdQuarter: {
      value: number;
      date: string;
    };
  };
};

// / Moon metrics and operations.
export class Moon {
  private constructor() {
    // disable constructor
  }

  // / Moon gravitational parameter _(km³/s²)_.
  static mu = 4902.799;

  // / Moon equatorial radius _(km)_.
  static radiusEquator = 1738.0;

  // / Calculate the Moon's ECI position _(km)_ for a given UTC [epoch].
  static eci(epoch: EpochUTC = EpochUTC.fromDateTime(new Date())): Vector3D<Kilometers> {
    const jc = epoch.toJulianCenturies();
    const dtr = DEG2RAD;
    const lamEcl =
      218.32 +
      481267.8813 * jc +
      6.29 * Math.sin((134.9 + 477198.85 * jc) * dtr) -
      1.27 * Math.sin((259.2 - 413335.38 * jc) * dtr) +
      0.66 * Math.sin((235.7 + 890534.23 * jc) * dtr) +
      0.21 * Math.sin((269.9 + 954397.7 * jc) * dtr) -
      0.19 * Math.sin((357.5 + 35999.05 * jc) * dtr) -
      0.11 * Math.sin((186.6 + 966404.05 * jc) * dtr);
    const phiEcl =
      5.13 * Math.sin((93.3 + 483202.03 * jc) * dtr) +
      0.28 * Math.sin((228.2 + 960400.87 * jc) * dtr) -
      0.28 * Math.sin((318.3 + 6003.18 * jc) * dtr) -
      0.17 * Math.sin((217.6 - 407332.2 * jc) * dtr);
    const pllx =
      0.9508 +
      0.0518 * Math.cos((134.9 + 477198.85 * jc) * dtr) +
      0.0095 * Math.cos((259.2 - 413335.38 * jc) * dtr) +
      0.0078 * Math.cos((235.7 + 890534.23 * jc) * dtr) +
      0.0028 * Math.cos((269.9 + 954397.7 * jc) * dtr);
    const obq = 23.439291 - 0.0130042 * jc;
    const rMag = 1 / Math.sin(pllx * dtr);
    const r = new Vector3D(
      rMag * Math.cos(phiEcl * dtr) * Math.cos(lamEcl * dtr),
      rMag *
        (Math.cos(obq * dtr) * Math.cos(phiEcl * dtr) * Math.sin(lamEcl * dtr) -
          Math.sin(obq * dtr) * Math.sin(phiEcl * dtr)),
      rMag *
        (Math.sin(obq * dtr) * Math.cos(phiEcl * dtr) * Math.sin(lamEcl * dtr) +
          Math.cos(obq * dtr) * Math.sin(phiEcl * dtr)),
    );
    const rMOD = r.scale(Earth.radiusEquator);
    const p = Earth.precession(epoch);

    return rMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<Kilometers>;
  }

  /**
   * Calculates the illumination of the Moon at a given epoch.
   * @param epoch - The epoch in UTC.
   * @param origin - The origin vector. Defaults to the origin vector if not provided.
   * @returns The illumination of the Moon, ranging from 0 to 1.
   */
  static illumination(epoch: EpochUTC, origin?: Vector3D<Kilometers>): number {
    const orig = origin ?? (Vector3D.origin as Vector3D<Kilometers>);
    const sunPos = Sun.position(epoch).subtract(orig);
    const moonPos = this.eci(epoch).subtract(orig);
    const phaseAngle = sunPos.angle(moonPos);

    return 0.5 * (1 - Math.cos(phaseAngle));
  }

  /**
   * Calculates the diameter of the Moon.
   * @param obsPos - The position of the observer.
   * @param moonPos - The position of the Moon.
   * @returns The diameter of the Moon.
   */
  static diameter(obsPos: Vector3D, moonPos: Vector3D): number {
    return angularDiameter(this.radiusEquator * 2, obsPos.subtract(moonPos).magnitude(), AngularDiameterMethod.Sphere);
  }

  /**
   * calculations for illumination parameters of the moon, based on
   * http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and Chapter 48 of "Astronomical Algorithms" 2nd
   * edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
   * @param date Date object or timestamp for calculating moon-illumination
   * @returns result object of moon-illumination
   */
  // eslint-disable-next-line max-statements
  static getMoonIllumination(date: number | Date): MoonIlluminationData {
    const dateValue = date instanceof Date ? date.getTime() : date;

    const lunarDaysMs = 2551442778; // The duration in days of a lunar cycle is 29.53058770576 days.
    const firstNewMoon2000 = 947178840000; // first newMoon in the year 2000 2000-01-06 18:14
    const dateObj = new Date(dateValue);
    const d = Sun.date2jSince2000(dateObj);
    const s = Sun.raDec(dateObj);
    const m = Moon.moonCoords(d);
    const sdist = 149598000; // distance from Earth to Sun in km
    const phi = Math.acos(
      Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
    );
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(
      Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
    );
    const phaseValue = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;

    /*
     * calculates the difference in ms between the sirst fullMoon 2000 and given
     * Date
     */
    const diffBase = dateValue - firstNewMoon2000;
    // Calculate modulus to drop completed cycles
    let cycleModMs = diffBase % lunarDaysMs;
    // If negative number (date before new moon 2000) add lunarDaysMs

    if (cycleModMs < 0) {
      cycleModMs += lunarDaysMs;
    }
    const nextNewMoon = lunarDaysMs - cycleModMs + dateValue;
    let nextFullMoon = lunarDaysMs / 2 - cycleModMs + dateValue;

    if (nextFullMoon < dateValue) {
      nextFullMoon += lunarDaysMs;
    }
    const quater = lunarDaysMs / 4;
    let nextFirstQuarter = quater - cycleModMs + dateValue;

    if (nextFirstQuarter < dateValue) {
      nextFirstQuarter += lunarDaysMs;
    }
    let nextThirdQuarter = lunarDaysMs - quater - cycleModMs + dateValue;

    if (nextThirdQuarter < dateValue) {
      nextThirdQuarter += lunarDaysMs;
    }
    /*
     * Calculate the fraction of the moon cycle const currentfrac = cycleModMs /
     * lunarDaysMs;
     */
    const next = Math.min(nextNewMoon, nextFirstQuarter, nextFullMoon, nextThirdQuarter);
    // eslint-disable-next-line init-declarations
    let phase: (typeof Moon.moonCycles_)[0] | null = null;

    for (const moonCycle of Moon.moonCycles_) {
      if (phaseValue >= moonCycle.from && phaseValue <= moonCycle.to) {
        phase = moonCycle;
        break;
      }
    }

    if (!phase) {
      throw new Error('Moon phase not found');
    }

    let type = '';

    if (next === nextNewMoon) {
      type = 'newMoon';
    } else if (next === nextFirstQuarter) {
      type = 'firstQuarter';
    } else if (next === nextFullMoon) {
      type = 'fullMoon';
    } else {
      type = 'thirdQuarter';
    }

    return {
      fraction: (1 + Math.cos(inc)) / 2,
      phase,
      phaseValue,
      angle,
      next: {
        value: next,
        date: new Date(next).toISOString(),
        type,
        newMoon: {
          value: nextNewMoon,
          date: new Date(nextNewMoon).toISOString(),
        },
        fullMoon: {
          value: nextFullMoon,
          date: new Date(nextFullMoon).toISOString(),
        },
        firstQuarter: {
          value: nextFirstQuarter,
          date: new Date(nextFirstQuarter).toISOString(),
        },
        thirdQuarter: {
          value: nextThirdQuarter,
          date: new Date(nextThirdQuarter).toISOString(),
        },
      },
    };
  }

  static rae(
    date: Date,
    lat: Degrees,
    lon: Degrees,
  ): {
    az: Radians;
    el: Radians;
    rng: Kilometers;
    parallacticAngle: Radians;
  } {
    const lw = <Radians>(DEG2RAD * -lon);
    const phi = <Radians>(DEG2RAD * lat);
    const d = Sun.date2jSince2000(date);
    const c = Moon.moonCoords(d);
    const H = Sun.siderealTime(d, lw) - c.ra;
    let h = Celestial.elevation(H, phi, c.dec);
    /*
     * formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus
     * (Willmann-Bell, Richmond) 1998.
     */
    const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));

    h = <Radians>(h + Celestial.atmosphericRefraction(h)); // altitude correction for refraction

    return {
      az: Celestial.azimuth(H, phi, c.dec),
      el: h,
      rng: c.dist,
      parallacticAngle: pa as Radians,
    };
  }

  /**
   * calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
   * @param date Date object or timestamp for calculating moon rise/set
   * @param lat Latitude of observer in degrees
   * @param lon Longitude of observer in degrees
   * @param isUtc If true, date will be interpreted as UTC
   * @returns result object of moon rise/set
   */
  static getMoonTimes(date: Date, lat: Degrees, lon: Degrees, isUtc = false) {
    // Clone the date so we don't change the original
    const date_ = new Date(date);

    if (isUtc) {
      date_.setUTCHours(0, 0, 0, 0);
    } else {
      date_.setHours(0, 0, 0, 0);
    }

    const { rise, set, ye } = Moon.calculateRiseSetTimes_(date_, lat, lon);

    const result = {
      rise: null as Date | null,
      set: null as Date | null,
      ye: null as number | null,
      alwaysUp: null as boolean | null,
      alwaysDown: null as boolean | null,
      highest: null as Date | null,
    };

    if (rise) {
      result.rise = new Date(Moon.hoursLater_(date_, rise));
    }

    if (set) {
      result.set = new Date(Moon.hoursLater_(date_, set));
    }

    if (!rise && !set) {
      if (ye > 0) {
        result.alwaysUp = true;
        result.alwaysDown = false;
      } else {
        result.alwaysUp = false;
        result.alwaysDown = true;
      }
    } else if (rise && set) {
      result.alwaysUp = false;
      result.alwaysDown = false;
      result.highest = new Date(Moon.hoursLater_(date_, Math.min(rise, set) + Math.abs(set - rise) / 2));
    } else {
      result.alwaysUp = false;
      result.alwaysDown = false;
    }

    return result;
  }

  private static hoursLater_(date: Date, h: number) {
    return new Date(date.getTime() + (h * MS_PER_DAY) / 24);
  }

  /**
   * Calculates the geocentric ecliptic coordinates of the moon.
   * @param d - The number of days since year 2000.
   * @returns An object containing the right ascension, declination, and
   * distance to the moon.
   */
  static moonCoords(d: number): RaDec {
    const L = DEG2RAD * (218.316 + 13.176396 * d); // ecliptic longitude
    const M = DEG2RAD * (134.963 + 13.064993 * d); // mean anomaly
    const F = DEG2RAD * (93.272 + 13.22935 * d); // mean distance
    const l = L + DEG2RAD * 6.289 * Math.sin(M); // longitude
    const b = DEG2RAD * 5.128 * Math.sin(F); // latitude
    const dt = 385001 - 20905 * Math.cos(M); // distance to the moon in km

    return {
      ra: Celestial.rightAscension(l, b),
      dec: Celestial.declination(l, b),
      dist: dt as Kilometers,
    };
  }

  private static calculateRiseSetTimes_(t: Date, lat: Degrees, lon: Degrees) {
    const hc = 0.133 * DEG2RAD;
    let h0 = Moon.rae(t, lat, lon).el - hc;
    let h1 = 0;
    let h2 = 0;
    let rise = 0;
    let set = 0;
    let a = 0;
    let b = 0;
    let xe = 0;
    let ye = 0;
    let d = 0;
    let roots = 0;
    let x1 = 0;
    let x2 = 0;
    let dx = 0;

    /*
     * go in 2-hour chunks, each time seeing if a 3-point quadratic curve
     * crosses zero (which means rise or set)
     */
    for (let i = 1; i <= 24; i += 2) {
      h1 = Moon.rae(Moon.hoursLater_(t, i), lat, lon).el - hc;
      h2 = Moon.rae(Moon.hoursLater_(t, i + 1), lat, lon).el - hc;

      a = (h0 + h2) / 2 - h1;
      b = (h2 - h0) / 2;
      xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      d = b * b - 4 * a * h1;
      roots = 0;

      if (d >= 0) {
        dx = Math.sqrt(d) / (Math.abs(a) * 2);
        x1 = xe - dx;
        x2 = xe + dx;
        if (Math.abs(x1) <= 1) {
          roots++;
        }
        if (Math.abs(x2) <= 1) {
          roots++;
        }
        if (x1 < -1) {
          x1 = x2;
        }
      }

      if (roots === 1) {
        if (h0 < 0) {
          rise = i + x1;
        } else {
          set = i + x1;
        }
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }

      if (rise && set) {
        break;
      }

      h0 = h2;
    }

    return { rise, set, ye };
  }

  private static moonCycles_ = [
    {
      from: 0,
      to: 0.033863193308711,
      id: 'newMoon',
      emoji: '🌚',
      code: ':new_moon_with_face:',
      name: 'New Moon',
      weight: 1,
      css: 'wi-moon-new',
    },
    {
      from: 0.033863193308711,
      to: 0.216136806691289,
      id: 'waxingCrescentMoon',
      emoji: '🌒',
      code: ':waxing_crescent_moon:',
      name: 'Waxing Crescent',
      weight: 6.3825,
      css: 'wi-moon-wax-cres',
    },
    {
      from: 0.216136806691289,
      to: 0.283863193308711,
      id: 'firstQuarterMoon',
      emoji: '🌓',
      code: ':first_quarter_moon:',
      name: 'First Quarter',
      weight: 1,
      css: 'wi-moon-first-quart',
    },
    {
      from: 0.283863193308711,
      to: 0.466136806691289,
      id: 'waxingGibbousMoon',
      emoji: '🌔',
      code: ':waxing_gibbous_moon:',
      name: 'Waxing Gibbous',
      weight: 6.3825,
      css: 'wi-moon-wax-gibb',
    },
    {
      from: 0.466136806691289,
      to: 0.533863193308711,
      id: 'fullMoon',
      emoji: '🌝',
      code: ':full_moon_with_face:',
      name: 'Full Moon',
      weight: 1,
      css: 'wi-moon-full',
    },
    {
      from: 0.533863193308711,
      to: 0.716136806691289,
      id: 'waningGibbousMoon',
      emoji: '🌖',
      code: ':waning_gibbous_moon:',
      name: 'Waning Gibbous',
      weight: 6.3825,
      css: 'wi-moon-wan-gibb',
    },
    {
      from: 0.716136806691289,
      to: 0.783863193308711,
      id: 'thirdQuarterMoon',
      emoji: '🌗',
      code: ':last_quarter_moon:',
      name: 'third Quarter',
      weight: 1,
      css: 'wi-moon-third-quart',
    },
    {
      from: 0.783863193308711,
      to: 0.966136806691289,
      id: 'waningCrescentMoon',
      emoji: '🌘',
      code: ':waning_crescent_moon:',
      name: 'Waning Crescent',
      weight: 6.3825,
      css: 'wi-moon-wan-cres',
    },
    {
      from: 0.966136806691289,
      to: 1,
      id: 'newMoon',
      emoji: '🌚',
      code: ':new_moon_with_face:',
      name: 'New Moon',
      weight: 1,
      css: 'wi-moon-new',
    },
  ];
}
