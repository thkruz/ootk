import { AzEl, Degrees, Kilometers, Meters, Radians, SunTime } from '@src/ootk';
import { RaDec } from '@src/types/types';
import { astronomicalUnit, deg2rad, speedOfLight, tau } from '../operations/constants';
import { angularDiameter, AngularDiameterMethod } from '../operations/functions';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD, MS_PER_DAY } from '../utils/constants';
import { Celestial } from './Celestial';
import { Earth } from './Earth';

/**
 * Sun metrics and operations.
 */
export class Sun {
  private static readonly J0_ = 0.0009;
  private static readonly J1970_ = 2440587.5;
  private static readonly J2000_ = 2451545;
  static readonly e = DEG2RAD * 23.4397;

  /**
   * Array representing the times for different phases of the sun.
   * Each element in the array contains:
   * - The angle in degrees representing the time offset from solar noon.
   * - The name of the start time for the phase.
   * - The name of the end time for the phase.
   */
  private static times_ = [
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

  /**
   * Gravitational parameter of the Sun. (km³/s²)
   */
  static readonly mu = 1.32712428e11;
  /**
   * The angle of the penumbra of the Sun, in radians.
   */
  static readonly penumbraAngle = (0.26900424 * deg2rad) as Radians;
  /**
   * The radius of the Sun in kilometers.
   */
  static readonly radius = 695500.0 as Kilometers;
  /**
   * The mean solar flux of the Sun. (W/m²)
   */
  static readonly solarFlux = 1367.0;
  /**
   * The solar pressure exerted by the Sun. (N/m²)
   * It is calculated as the solar flux divided by the speed of light.
   */
  static readonly solarPressure = Sun.solarFlux / (speedOfLight * 1000);
  /**
   * The angle of the umbra, in radians.
   */
  static readonly umbraAngle = (0.26411888 * deg2rad) as Radians;

  private constructor() {
    // disable constructor
  }

  /**
   * Calculates the azimuth and elevation of the Sun for a given date, latitude, and longitude.
   * @param date - The date for which to calculate the azimuth and elevation.
   * @param lat - The latitude in degrees.
   * @param lon - The longitude in degrees.
   * @param c - The right ascension and declination of the target. Defaults to the Sun's right ascension and declination
   * @returns An object containing the azimuth and elevation of the Sun in radians.
   */
  static azEl(date: Date, lat: Degrees, lon: Degrees, c?: RaDec): AzEl<Radians> {
    const lw = <Radians>(-lon * DEG2RAD);
    const phi = <Radians>(lat * DEG2RAD);
    const d = Sun.date2jSince2000(date);

    c ??= Sun.raDec(date);
    const H = Sun.siderealTime(d, lw) - c.ra;

    return {
      az: Celestial.azimuth(H, phi, c.dec),
      el: Celestial.elevation(H, phi, c.dec),
    };
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
    return date.getTime() / MS_PER_DAY + Sun.J1970_ - Sun.J2000_;
  }

  /**
   * Calculate the Sun's angular diameter _(rad)_ from an ECI observer
   * position [obsPos] and Sun position [sunPos] _(km)_.
   */
  static diameter(obsPos: Vector3D, sunPos: Vector3D): number {
    return angularDiameter(this.radius * 2, obsPos.subtract(sunPos).magnitude(), AngularDiameterMethod.Sphere);
  }

  /**
   * Calculate eclipse angles given a satellite ECI position [satPos] _(km)_
   * and Sun ECI position [sunPos] _(km)_.
   *
   * Returns a tuple containing the following three values:
   *   - central body angle _(rad)_
   *   - central body apparant radius _(rad)_
   *   - sun apparant radius _(rad)_
   */
  static eclipseAngles(satPos: Vector3D, sunPos: Vector3D): [number, number, number] {
    const satSun = sunPos.subtract(satPos);
    const r = satPos.magnitude();

    return [
      // central body angle
      satSun.angle(satPos.negate()),
      // central body apparent radius
      Math.asin(Earth.radiusEquator / r),
      // sun apparent radius
      Math.asin(this.radius / satSun.magnitude()),
    ];
  }

  /**
   * Ecliptic latitude measures the distance north or south of the ecliptic, attaining +90° at the north ecliptic
   * pole (NEP) and -90° at the south ecliptic pole (SEP). The ecliptic itself is 0° latitude.
   *
   * @param {number} B - ?
   * @returns {number} ecliptic latitude
   */
  static eclipticLatitude(B: number): number {
    const C = tau / 360;
    const L = B - 0.00569 - 0.00478 * Math.sin(C * B);

    return tau * (L + 0.0003 * Math.sin(C * 2 * L));
  }

  /**
   * Ecliptic longitude, also known as celestial longitude, measures the angular distance of an
   * object along the ecliptic from the primary direction. It is measured positive eastwards in
   * the fundamental plane (the ecliptic) from 0° to 360°. The primary direction
   * (0° ecliptic longitude) points from the Earth towards the Sun at the vernal equinox of the
   * Northern Hemisphere. Due to axial precession, the ecliptic longitude of most "fixed stars"
   * increases by about 50.3 arcseconds per year, or 83.8 arcminutes per century.
   * @param {number} M - solar mean anomaly
   * @returns {number} ecliptic longitude
   */
  static eclipticLongitude(M: number): Radians {
    const C = DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = DEG2RAD * 102.9372; // perihelion of Earth

    return <Radians>(M + C + P + Math.PI); // Sun's mean longitude
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
  static getSetJulian(h: Meters, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
    const w = Sun.hourAngle(h, phi, dec);
    const a = Sun.approxTransit_(w, lw, n);

    return Sun.solarTransitJulian(a, M, L);
  }

  /**
   * Convert Date to Solar Date/Time
   *
   * Based on https://www.pveducation.org/pvcdrom/properties-of-sunlight/solar-time
   *
   * See: https://github.com/mourner/suncalc/pull/156
   */
  static getSolarTime(date: Date, utcOffset: number, lon: Degrees) {
    // calculate the day of year
    const start = new Date();

    start.setUTCFullYear(date.getUTCFullYear(), 0, 1);
    start.setUTCHours(0, 0, 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / MS_PER_DAY);

    const b = (360 / 365) * (dayOfYear - 81) * DEG2RAD;
    const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    const localSolarTimeMeridian = 15 * utcOffset;
    const timeCorrection = equationOfTime + 4 * (lon - localSolarTimeMeridian);

    return new Date(date.getTime() + timeCorrection * 60 * 1000);
  }

  /**
   * Calculates time for a given azimuth angle for a given date and latitude/longitude
   */
  static getSunTimeByAz(
    dateValue: number | Date,
    lat: Degrees,
    lon: Degrees,
    az: Radians | Degrees,
    isDegrees = false,
  ) {
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
      az = <Radians>(az * DEG2RAD);
    }
    const date = new Date(dateValue);
    const lw = <Radians>(DEG2RAD * -lon);
    const phi = <Radians>(DEG2RAD * lat);

    let dateVal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).getTime();
    let addval = MS_PER_DAY; // / 2);

    dateVal += addval;

    while (addval > 200) {
      const newDate = new Date(dateVal);
      const d = Sun.date2jSince2000(newDate);
      const c = Sun.raDec(newDate);
      const H = Sun.siderealTime(d, lw) - c.ra;
      const newAz = Celestial.azimuth(H, phi, c.dec);

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
   * Calculates sun times for a given date and latitude/longitude
   *
   * Default altitude is 0 meters.
   * If `isUtc` is `true`, the times are returned as UTC, otherwise in local time.
   */
  static getTimes(dateVal: Date | number, lat: Degrees, lon: Degrees, alt: Meters = <Meters>0, isUtc = false): SunTime {
    if (isNaN(lat)) {
      throw new Error('latitude missing');
    }
    if (isNaN(lon)) {
      throw new Error('longitude missing');
    }

    // Ensure date is a Date object
    const date = new Date(dateVal);

    if (isUtc) {
      date.setUTCHours(12, 0, 0, 0);
    } else {
      date.setHours(12, 0, 0, 0);
    }

    let time = [];
    let h0 = <Meters>0;
    let Jset = 0;
    let Jrise = 0;

    const { Jnoon, dh, lw, phi, dec, n, M, L } = Sun.calculateJnoon_(lon, lat, alt, date);

    // Determine when the sun is at its highest and lowest (darkest) points.
    const result = {
      solarNoon: Sun.julian2date(Jnoon),
      nadir: Sun.julian2date(Jnoon + 0.5), // https://github.com/mourner/suncalc/pull/125
    };

    // Add all other unique times using Jnoon as a reference
    for (let i = 0, len = Sun.times_.length; i < len; i += 1) {
      time = Sun.times_[i];
      h0 = <Meters>((time[0] + dh) * DEG2RAD);

      Jset = Sun.getSetJ_(h0, lw, phi, dec, n, M, L);
      Jrise = Jnoon - (Jset - Jnoon);

      result[time[1]] = Sun.julian2date(Jrise);
      result[time[2]] = Sun.julian2date(Jset);
    }

    return result;
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
   * convert Julian calendar to date object
   * @param {number} julian day number in Julian calendar to convert
   * @return {number} result date as timestamp
   */
  static julian2date(julian: number): Date {
    return new Date((julian - Sun.J1970_) * MS_PER_DAY);
  }

  /**
   * Julian cycle
   *
   * The Julian cycle is a period of 7980 years after which the positions of the
   * Sun, Moon, and planets repeat. It is used in astronomical calculations to
   * determine the position of celestial bodies.
   *
   * The Julian Period starts at noon on January 1, 4713 B.C.E. (Julian calendar) and
   * lasts for 7980 years. This was determined because it is a time period long enough
   * to include all of recorded history and includes some time in the future that would
   * incorporate the three important calendrical cycles, the Golden Number Cycle, the
   * Solar Cycle, and the Roman Indiction.
   *
   * The Golden Number Cycle is a cycle of 19 years, while the Solar Cycle is a cycle of
   * 28 years and the Roman Indiction repeats every 15 years. Thus the Julian Period is
   * calculated to be 7980 years long or 2,914,695 days because 19*28*15 = 7980.
   *
   * @param {Date} date - Date object for calculating julian cycle
   * @param {Degrees} lon - Degrees longitude
   * @returns {number} julian cycle
   */
  static julianCyle(date: Date, lon: Degrees): number {
    const lw = <Radians>(-lon * DEG2RAD);
    const d = Sun.date2jSince2000(date);

    return Math.round(d - Sun.J0_ - lw / ((2 * tau) / 2));
  }

  /**
   * Calculate the lighting ratio given a satellite ECI position [satPos]
   * _(km)_ and Sun ECI position [sunPos] _(km)_.
   *
   * Returns `1.0` if the satellite is fully illuminated and `0.0` when
   * fully eclipsed.
   */
  static lightingRatio(satPos: Vector3D, sunPos: Vector3D): number {
    const [sunSatAngle, aCent, aSun] = Sun.eclipseAngles(satPos, sunPos);

    if (sunSatAngle - aCent + aSun <= 1e-10) {
      return 0.0;
    } else if (sunSatAngle - aCent - aSun < -1e-10) {
      const ssa2 = sunSatAngle * sunSatAngle;
      const ssaInv = 1.0 / (2.0 * sunSatAngle);
      const ac2 = aCent * aCent;
      const as2 = aSun * aSun;
      const acAsDiff = ac2 - as2;
      const a1 = (ssa2 - acAsDiff) * ssaInv;
      const a2 = (ssa2 + acAsDiff) * ssaInv;
      const asr1 = a1 / aSun;
      const asr2 = as2 - a1 * a1;
      const acr1 = a2 / aCent;
      const acr2 = ac2 - a2 * a2;
      const p1 = as2 * Math.acos(asr1) - a1 * Math.sqrt(asr2);
      const p2 = ac2 * Math.acos(acr1) - a2 * Math.sqrt(acr2);

      return 1.0 - (p1 + p2) / (Math.PI * as2);
    }

    return 1.0;
  }

  /**
   * Calculates the position vector of the Sun at a given epoch in the Earth-centered inertial (ECI) coordinate system.
   * @param epoch - The epoch in UTC.
   * @returns The position vector of the Sun in meters.
   */
  static position(epoch: EpochUTC): Vector3D<Meters> {
    const jc = epoch.toJulianCenturies();
    const dtr = deg2rad;
    const lamSun = 280.46 + 36000.77 * jc;
    const mSun = 357.5291092 + 35999.05034 * jc;
    const lamEc = lamSun + 1.914666471 * Math.sin(mSun * dtr) + 0.019994643 * Math.sin(2.0 * mSun * dtr);
    const obliq = 23.439291 - 0.0130042 * jc;
    const rMag = 1.000140612 - 0.016708617 * Math.cos(mSun * dtr) - 0.000139589 * Math.cos(2.0 * mSun * dtr);
    const r = new Vector3D(
      rMag * Math.cos(lamEc * dtr),
      rMag * Math.cos(obliq * dtr) * Math.sin(lamEc * dtr),
      rMag * Math.sin(obliq * dtr) * Math.sin(lamEc * dtr),
    );
    const rMOD = r.scale(astronomicalUnit);
    const p = Earth.precession(epoch);

    return rMOD.rotZ(p.zed).rotY(-p.theta).rotZ(p.zeta) as Vector3D<Meters>;
  }

  /**
   * Calculate the Sun's apparent ECI position _(km)_ from Earth for a given UTC [epoch].
   */
  static positionApparent(epoch: EpochUTC): Vector3D {
    const distance = Sun.position(epoch).magnitude();
    const dSec = distance / speedOfLight;

    return Sun.position(epoch.roll(-dSec));
  }

  /**
   * Calculates the right ascension and declination of the Sun for a given date.
   *
   * @param date - The date for which to calculate the right ascension and declination.
   * @returns An object containing the declination and right ascension of the Sun.
   */
  static raDec(date: Date): RaDec {
    const d = Sun.date2jSince2000(date);
    const M = Sun.solarMeanAnomaly_(d);
    const L = Sun.eclipticLongitude(M);

    return {
      dec: Celestial.declination(L, 0),
      ra: Celestial.rightAscension(L, 0),
    };
  }

  /**
   * Return `true` if the ECI satellite position [posSat] is in eclipse at the given UTC [epoch].
   */
  static shadow(epoch: EpochUTC, posSat: Vector3D): boolean {
    const posSun = Sun.positionApparent(epoch);
    let shadow = false;

    if (posSun.dot(posSat) < 0) {
      const angle = posSun.angle(posSat);
      const r = posSat.magnitude();
      const satHoriz = r * Math.cos(angle);
      const satVert = r * Math.sin(angle);
      const penVert = Earth.radiusEquator + Math.tan(this.penumbraAngle) * satHoriz;

      if (satVert <= penVert) {
        shadow = true;
      }
    }

    return shadow;
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
   * solar transit in Julian
   * @param {number} ds - approxTransit
   * @param {number} M - solar mean anomal
   * @param {number} L - ecliptic longitude
   * @returns {number} solar transit in Julian
   */
  static solarTransitJulian(ds: number, M: number, L: number): number {
    return Sun.J2000_ + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  }

  /**
   * The approximate transit time
   * @param {number} Ht - hourAngle
   * @param {number} lw - rad * -lng
   * @param {number} n - Julian cycle
   * @returns {number} approx transit
   */
  private static approxTransit_(Ht: number, lw: number, n: number): number {
    return Sun.J0_ + (Ht + lw) / tau + n;
  }

  private static calculateJnoon_(lon: Degrees, lat: Degrees, alt: Meters, date: Date) {
    const lw = <Radians>(DEG2RAD * -lon);
    const phi = <Radians>(DEG2RAD * lat);
    const dh = Sun.observerAngle_(alt);
    const d = Sun.date2jSince2000(date);

    const n = Sun.julianCycle_(d, lw);
    const ds = Sun.approxTransit_(0, lw, n);
    const M = Sun.solarMeanAnomaly_(ds);
    const L = Sun.eclipticLongitude(M);
    const dec = Celestial.declination(L, 0);
    const Jnoon = Sun.solarTransitJulian(ds, M, L);

    return { Jnoon, dh, lw, phi, dec, n, M, L };
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
   * @return {number} sunset time in days since 2000
   */
  private static getSetJ_(
    alt: Meters,
    lw: Radians,
    phi: Radians,
    dec: Radians,
    n: number,
    M: number,
    L: Radians,
  ): number {
    const w = Sun.hourAngle(alt, phi, dec);
    const a = Sun.approxTransit_(w, lw, n);

    return Sun.solarTransitJulian(a, M, L);
  }

  private static julianCycle_(d: number, lw: number): number {
    const lonOffset = lw / tau;

    return Math.round(d - Sun.J0_ - lonOffset);
  }

  /**
   * calculates the obderver angle
   * @param {number} alt  the observer altitude (in meters) relative to the horizon
   * @returns {Degrees} height for further calculations
   */
  private static observerAngle_(alt: Meters): Degrees {
    return <Degrees>((-2.076 * Math.sqrt(alt)) / 60);
  }

  /**
   * get solar mean anomaly
   * @param {number} d - julian day
   * @returns {number} solar mean anomaly
   */
  private static solarMeanAnomaly_(d: number): number {
    return DEG2RAD * (357.5291 + 0.98560028 * d);
  }
}
