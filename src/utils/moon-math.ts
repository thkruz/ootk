import { MS_PER_DAY, PI } from '../utils/constants';

import { DEG2RAD } from './constants';
import { Radians } from '../ootk';
import { SunMath } from './sun-math';

export class MoonMath {
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

  static hoursLater(date: Date, h: number) {
    return new Date(date.getTime() + (h * MS_PER_DAY) / 24);
  }

  static getMoonPosition(date, lat, lon) {
    const lw = DEG2RAD * -lon;
    const phi = DEG2RAD * lat;
    const d = SunMath.toDays(date);
    const c = MoonMath.moonCoords(d);
    const H = SunMath.siderealTime(d, lw) - c.ra;
    let h = SunMath.elevation(H, phi, c.dec);
    // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));

    h += SunMath.astroRefraction(h); // altitude correction for refraction

    return {
      az: SunMath.azimuth(H, phi, c.dec),
      el: h,
      rng: c.dist,
      parallacticAngle: pa,
    };
  }

  /*
   * calculations for illumination parameters of the moon,
   * based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
   * Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
   */
  static getMoonIllumination(date: Date) {
    const d = SunMath.toDays(date || new Date());
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

    const fraction = (1 + Math.cos(inc)) / 2;
    const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI;

    return {
      fraction,
      phase,
      angle,
    };
  }
  /*
   * calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
   */
  static getMoonTimes(date: Date, lat: Radians, lon: Radians, inUTC = false) {
    const t = new Date(date);

    if (inUTC) {
      t.setUTCHours(0, 0, 0, 0);
    } else {
      t.setHours(0, 0, 0, 0);
    }

    const { rise, set, ye } = MoonMath.calculateRiseSetTimes(t, lat, lon);

    const riseDate = rise ? MoonMath.hoursLater(t, rise) : null;
    const setDate = set ? MoonMath.hoursLater(t, set) : null;

    const result = {
      rise: riseDate,
      set: setDate,
      alwaysUp: false,
      alwaysDown: false,
    };

    if (!rise && !set) {
      result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
    }

    return result;
  }

  // eslint-disable-next-line max-statements
  private static calculateRiseSetTimes(t: Date, lat: Radians, lon: Radians) {
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
