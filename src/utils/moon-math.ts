/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file MoonMath is a an extension to SunMath for calculating the position of the moon
 * and its phases. This was originally created by Vladimir Agafonkin. Robert Gester's
 * update was referenced for documentation. There were a couple of bugs in both versions
 * so there will be some differences if you are migrating from either to this library.
 *
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
 *
 * @Copyright (c) 2011-2015, Vladimir Agafonkin
 * SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 * https://github.com/mourner/suncalc
 *
 * Reworked and enhanced by Robert Gester
 * @Copyright (c) 2022 Robert Gester
 * https://github.com/hypnos3/suncalc3
 *
 * moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas
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

import { Degrees, Radians } from '../ootk';
import { MS_PER_DAY } from '../utils/constants';
import { DEG2RAD } from './constants';
import { SunMath } from './sun-math';

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

export class MoonMath {
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

  /**
   * calculations for illumination parameters of the moon,
   * based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
   * Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
   * @param {number | Date} date Date object or timestamp for calculating moon-illumination
   * @return {MoonIlluminationData} result object of moon-illumination
   */
  // eslint-disable-next-line max-statements
  static getMoonIllumination(date: number | Date): MoonIlluminationData {
    const dateValue = date instanceof Date ? date.getTime() : date;

    const lunarDaysMs = 2551442778; // The duration in days of a lunar cycle is 29.53058770576 days.
    const firstNewMoon2000 = 947178840000; // first newMoon in the year 2000 2000-01-06 18:14
    const d = SunMath.date2jSince2000(new Date(dateValue));
    const s = SunMath.getSunRaDec(d);
    const m = MoonMath.moonCoords(d);
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

    // calculates the difference in ms between the sirst fullMoon 2000 and given Date
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
     * Calculate the fraction of the moon cycle
     * const currentfrac = cycleModMs / lunarDaysMs;
     */
    const next = Math.min(nextNewMoon, nextFirstQuarter, nextFullMoon, nextThirdQuarter);
    // eslint-disable-next-line init-declarations
    let phase;

    for (let index = 0; index < MoonMath.moonCycles_.length; index++) {
      const element = MoonMath.moonCycles_[index];

      if (phaseValue >= element.from && phaseValue <= element.to) {
        phase = element;
        break;
      }
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

  static getMoonPosition(date: Date, lat: Degrees, lon: Degrees) {
    const lw = <Radians>(DEG2RAD * -lon);
    const phi = <Radians>(DEG2RAD * lat);
    const d = SunMath.date2jSince2000(date);
    const c = MoonMath.moonCoords(d);
    const H = SunMath.siderealTime(d, lw) - c.ra;
    let h = SunMath.elevation(H, phi, c.dec);
    // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));

    h = <Radians>(h + SunMath.astroRefraction(h)); // altitude correction for refraction

    return {
      az: SunMath.azimuth(H, phi, c.dec),
      el: h,
      rng: c.dist,
      parallacticAngle: pa,
    };
  }

  /**
   * calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
   * @param {number|Date} dateValue Date object or timestamp for calculating moon-times
   * @param {Degrees} lat latitude for calculating moon-times
   * @param {Degrees} lon longitude for calculating moon-times
   * @param {boolean} [isUtc] defines if the calculation should be in utc or local time (default is local)
   * @return {IMoonTimes} result object of sunTime
   */
  static getMoonTimes(dateValue: number | Date, lat: Degrees, lon: Degrees, isUtc = false) {
    const t = new Date(dateValue);

    if (isUtc) {
      t.setUTCHours(0, 0, 0, 0);
    } else {
      t.setHours(0, 0, 0, 0);
    }

    const { rise, set, ye } = MoonMath.calculateRiseSetTimes_(t, lat, lon);

    const result = {
      rise: null,
      set: null,
      ye: null,
      alwaysUp: null,
      alwaysDown: null,
      highest: null,
    };

    if (rise) {
      result.rise = new Date(MoonMath.hoursLater(t, rise));
    } else {
      result.rise = NaN;
    }

    if (set) {
      result.set = new Date(MoonMath.hoursLater(t, set));
    } else {
      result.set = NaN;
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
      result.highest = new Date(MoonMath.hoursLater(t, Math.min(rise, set) + Math.abs(set - rise) / 2));
    } else {
      result.alwaysUp = false;
      result.alwaysDown = false;
    }

    return result;
  }

  static hoursLater(date: Date, h: number) {
    return new Date(date.getTime() + (h * MS_PER_DAY) / 24);
  }

  static moonCoords(d) {
    // geocentric ecliptic coordinates of the moon

    const L = DEG2RAD * (218.316 + 13.176396 * d); // ecliptic longitude
    const M = DEG2RAD * (134.963 + 13.064993 * d); // mean anomaly
    const F = DEG2RAD * (93.272 + 13.22935 * d); // mean distance
    const l = L + DEG2RAD * 6.289 * Math.sin(M); // longitude
    const b = DEG2RAD * 5.128 * Math.sin(F); // latitude
    const dt = 385001 - 20905 * Math.cos(M); // distance to the moon in km

    return {
      ra: SunMath.rightAscension(l, b),
      dec: SunMath.declination(l, b),
      dist: dt,
    };
  }

  // eslint-disable-next-line max-statements
  private static calculateRiseSetTimes_(t: Date, lat: Degrees, lon: Degrees) {
    const hc = 0.133 * DEG2RAD;
    let h0 = MoonMath.getMoonPosition(t, lat, lon).el - hc;
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

    // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
    for (let i = 1; i <= 24; i += 2) {
      h1 = MoonMath.getMoonPosition(MoonMath.hoursLater(t, i), lat, lon).el - hc;
      h2 = MoonMath.getMoonPosition(MoonMath.hoursLater(t, i + 1), lat, lon).el - hc;

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
}
