/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import {
  Body,
  Illumination,
  Libration,
  MakeTime,
  MoonPhase,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';
import { Vector3D } from '../operations/Vector3D';
import { Degrees, Kilometers, SpaceObjectType } from '../types/types';
import { DEG2RAD, MS_PER_DAY } from '../utils/constants';
import { CelestialBody, CelestialBodyParams } from './CelestialBody';
import { CelestialBodyType } from './CelestialBodyType';
import { GroundObject } from '../objects/GroundObject';
import { Sun } from './SunBody';

/**
 * Moon phase information with display data.
 */
export interface MoonPhaseInfo {
  /** Illuminated fraction (0-1) */
  fraction: number;
  /** Phase details with emoji and name */
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
  /** Phase value (0-1) */
  phaseValue: number;
  /** Phase angle in radians */
  angle: number;
  /** Next phase event times */
  next: {
    value: number;
    date: string;
    type: string;
    newMoon: { value: number; date: string };
    fullMoon: { value: number; date: string };
    firstQuarter: { value: number; date: string };
    thirdQuarter: { value: number; date: string };
  };
}

/**
 * Moon rise/set times result.
 */
export interface MoonTimes {
  rise: Date | null;
  set: Date | null;
  ye: number | null;
  alwaysUp: boolean | null;
  alwaysDown: boolean | null;
  highest: Date | null;
}

/**
 * Libration information for the Moon.
 */
export interface LibrationData {
  /** Sub-Earth libration ecliptic latitude (degrees) */
  elat: number;
  /** Sub-Earth libration ecliptic longitude (degrees) */
  elon: number;
  /** Moon's geocentric ecliptic latitude (degrees) */
  mlat: number;
  /** Moon's geocentric ecliptic longitude (degrees) */
  mlon: number;
  /** Distance to Moon (km) */
  distanceKm: Kilometers;
  /** Apparent angular diameter (degrees) */
  diameterDeg: Degrees;
}

/**
 * Moon body with position calculations and phase information.
 *
 * MoonBody provides:
 * - High-precision position calculations via astronomy-engine
 * - Moon phase and illumination calculations
 * - Moonrise/moonset times
 * - Libration data
 *
 * @example
 * ```typescript
 * // Get Moon position
 * const moonPos = Moon.eci(new Date());
 *
 * // Get moon phase
 * const phase = Moon.getPhase(new Date());
 *
 * // Get moonrise/moonset
 * const times = Moon.getMoonTimes(new Date(), observer);
 * ```
 */
export class MoonBody extends CelestialBody {
  // ==================== Physical Constants ====================

  /** Gravitational parameter (km³/s²) */
  static readonly MU = 4902.799;

  /** Equatorial radius (km) */
  static readonly RADIUS = 1738.0 as Kilometers;

  // ==================== Moon Phase Data ====================

  private static readonly moonCycles_ = [
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
      name: 'Third Quarter',
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

  // ==================== Singleton Instance ====================

  private static instance_: MoonBody | null = null;

  /**
   * Gets the singleton Moon instance.
   */
  static getInstance(): MoonBody {
    if (!MoonBody.instance_) {
      MoonBody.instance_ = new MoonBody();
    }

    return MoonBody.instance_;
  }

  private constructor() {
    super({
      id: 10,
      name: 'Moon',
      type: SpaceObjectType.MOON,
      bodyType: CelestialBodyType.MOON,
      mu: MoonBody.MU,
      radius: MoonBody.RADIUS,
      astronomyBody: Body.Moon,
    } as CelestialBodyParams);
  }

  // ==================== Position Methods ====================

  /**
   * Gets the Moon's position in Earth-Centered Inertial (J2000) coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  eci(date: Date = new Date()): Vector3D<Kilometers> {
    return this.geoVectorToKm(Body.Moon, date);
  }

  /**
   * Gets the Moon's position in heliocentric coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers (Sun-centered)
   */
  heliocentric(date: Date = new Date()): Vector3D<Kilometers> {
    return this.helioVectorToKm(Body.Moon, date);
  }

  /**
   * Moon's velocity is not provided by astronomy-engine, returns null.
   */
  velocity(_date?: Date): Vector3D | null {
    return null;
  }

  // ==================== Illumination Methods ====================

  /**
   * Gets the Moon's illumination fraction as seen from a position.
   * @param date - The date/time for the calculation
   * @param origin - Optional observer position (defaults to Earth center)
   * @returns Illumination fraction (0-1)
   */
  getIlluminationFraction(date: Date = new Date(), origin?: Vector3D<Kilometers>): number {
    if (origin) {
      // Calculate illumination from specific observer position
      const sunPos = Sun.eci(date).subtract(origin);
      const moonPos = this.eci(date).subtract(origin);
      const phaseAngle = sunPos.angle(moonPos);

      return 0.5 * (1 - Math.cos(phaseAngle));
    }

    // Use astronomy-engine for geocentric illumination
    const time = MakeTime(date);
    const illum = Illumination(Body.Moon, time);

    return illum.phase_fraction;
  }

  /**
   * Gets the current moon phase angle (0-360 degrees).
   * 0 = new moon, 90 = first quarter, 180 = full moon, 270 = third quarter
   * @param date - The date/time for the calculation
   * @returns Phase angle in degrees
   */
  getPhaseAngle(date: Date = new Date()): Degrees {
    const time = MakeTime(date);

    return MoonPhase(time) as Degrees;
  }

  /**
   * Gets detailed moon phase information including emoji and next phase times.
   * @param date - The date/time for the calculation
   * @returns Detailed phase information
   */
  getPhase(date: Date | number = new Date()): MoonPhaseInfo {
    const dateValue = date instanceof Date ? date.getTime() : date;

    const lunarDaysMs = 2551442778;
    const firstNewMoon2000 = 947178840000;
    const dateObj = new Date(dateValue);
    const d = this.date2jSince2000_(dateObj);
    const s = this.sunCoords_(d);
    const m = this.moonCoords_(d);
    const sdist = 149598000;

    const phi = Math.acos(
      Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
    );
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(
      Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
    );
    const phaseValue = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;

    const diffBase = dateValue - firstNewMoon2000;
    let cycleModMs = diffBase % lunarDaysMs;

    if (cycleModMs < 0) {
      cycleModMs += lunarDaysMs;
    }

    const nextNewMoon = lunarDaysMs - cycleModMs + dateValue;
    let nextFullMoon = lunarDaysMs / 2 - cycleModMs + dateValue;

    if (nextFullMoon < dateValue) {
      nextFullMoon += lunarDaysMs;
    }

    const quarter = lunarDaysMs / 4;
    let nextFirstQuarter = quarter - cycleModMs + dateValue;

    if (nextFirstQuarter < dateValue) {
      nextFirstQuarter += lunarDaysMs;
    }

    let nextThirdQuarter = lunarDaysMs - quarter - cycleModMs + dateValue;

    if (nextThirdQuarter < dateValue) {
      nextThirdQuarter += lunarDaysMs;
    }

    const next = Math.min(nextNewMoon, nextFirstQuarter, nextFullMoon, nextThirdQuarter);
    let phase = MoonBody.moonCycles_.find((mc) => phaseValue >= mc.from && phaseValue <= mc.to);

    if (!phase) {
      phase = MoonBody.moonCycles_[0];
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
        newMoon: { value: nextNewMoon, date: new Date(nextNewMoon).toISOString() },
        fullMoon: { value: nextFullMoon, date: new Date(nextFullMoon).toISOString() },
        firstQuarter: { value: nextFirstQuarter, date: new Date(nextFirstQuarter).toISOString() },
        thirdQuarter: { value: nextThirdQuarter, date: new Date(nextThirdQuarter).toISOString() },
      },
    };
  }

  // ==================== Rise/Set Methods ====================

  /**
   * Gets moonrise and moonset times for a ground location.
   * @param date - The date for calculation
   * @param observer - Ground observer location
   * @param isUtc - If true, treat date as UTC
   * @returns Moonrise/moonset times and visibility info
   */
  getMoonTimes(date: Date, observer: GroundObject, isUtc = false): MoonTimes {
    const date_ = new Date(date);

    if (isUtc) {
      date_.setUTCHours(0, 0, 0, 0);
    } else {
      date_.setHours(0, 0, 0, 0);
    }

    const obs = new Observer(observer.lat, observer.lon, observer.alt * 1000);
    const time = MakeTime(date_);

    const riseTime = SearchRiseSet(Body.Moon, obs, +1, time, 1, 0);
    const setTime = SearchRiseSet(Body.Moon, obs, -1, time, 1, 0);

    const result: MoonTimes = {
      rise: riseTime?.date ?? null,
      set: setTime?.date ?? null,
      ye: null,
      alwaysUp: null,
      alwaysDown: null,
      highest: null,
    };

    if (!riseTime && !setTime) {
      // Moon is either always up or always down
      const { el } = this.getAzEl(observer, date_);

      if (el > 0) {
        result.alwaysUp = true;
        result.alwaysDown = false;
      } else {
        result.alwaysUp = false;
        result.alwaysDown = true;
      }
    } else if (riseTime && setTime) {
      result.alwaysUp = false;
      result.alwaysDown = false;

      const riseMs = riseTime.date.getTime();
      const setMs = setTime.date.getTime();

      if (setMs > riseMs) {
        result.highest = new Date((riseMs + setMs) / 2);
      }
    } else {
      result.alwaysUp = false;
      result.alwaysDown = false;
    }

    return result;
  }

  // ==================== Libration ====================

  /**
   * Gets the Moon's libration data.
   * @param date - The date/time for the calculation
   * @returns Libration angles and Moon position data
   */
  getLibration(date: Date = new Date()): LibrationData {
    const time = MakeTime(date);
    const lib = Libration(time);

    return {
      elat: lib.elat,
      elon: lib.elon,
      mlat: lib.mlat,
      mlon: lib.mlon,
      distanceKm: lib.dist_km as Kilometers,
      diameterDeg: lib.diam_deg as Degrees,
    };
  }

  /**
   * Gets the Moon's angular diameter.
   * @param date - The date/time for the calculation
   * @returns Angular diameter in degrees
   */
  getAngularDiameterDeg(date: Date = new Date()): Degrees {
    const lib = this.getLibration(date);

    return lib.diameterDeg;
  }

  // ==================== Private Helper Methods ====================

  private static readonly J1970_ = 2440587.5;
  private static readonly J2000_ = 2451545;
  private static readonly OBLIQUITY_ = DEG2RAD * 23.4397;

  private date2jSince2000_(date: Date): number {
    return date.getTime() / MS_PER_DAY + MoonBody.J1970_ - MoonBody.J2000_;
  }

  private sunCoords_(d: number): { ra: number; dec: number } {
    const M = DEG2RAD * (357.5291 + 0.98560028 * d);
    const C = DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = DEG2RAD * 102.9372;
    const L = M + C + P + Math.PI;

    return {
      dec: Math.asin(Math.sin(L) * Math.sin(MoonBody.OBLIQUITY_)),
      ra: Math.atan2(Math.sin(L) * Math.cos(MoonBody.OBLIQUITY_), Math.cos(L)),
    };
  }

  private moonCoords_(d: number): { ra: number; dec: number; dist: number } {
    const L = DEG2RAD * (218.316 + 13.176396 * d);
    const M = DEG2RAD * (134.963 + 13.064993 * d);
    const F = DEG2RAD * (93.272 + 13.22935 * d);
    const l = L + DEG2RAD * 6.289 * Math.sin(M);
    const b = DEG2RAD * 5.128 * Math.sin(F);
    const dt = 385001 - 20905 * Math.cos(M);

    return {
      ra: Math.atan2(
        Math.sin(l) * Math.cos(MoonBody.OBLIQUITY_) - Math.tan(b) * Math.sin(MoonBody.OBLIQUITY_),
        Math.cos(l),
      ),
      dec: Math.asin(
        Math.sin(b) * Math.cos(MoonBody.OBLIQUITY_) + Math.cos(b) * Math.sin(MoonBody.OBLIQUITY_) * Math.sin(l),
      ),
      dist: dt,
    };
  }
}

/**
 * Pre-instantiated Moon singleton for convenience.
 *
 * @example
 * ```typescript
 * import { Moon } from 'ootk';
 *
 * const moonPos = Moon.eci(new Date());
 * const phase = Moon.getPhase(new Date());
 * ```
 */
export const Moon = MoonBody.getInstance();
