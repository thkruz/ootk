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
 */

import {
  angularDiameter,
  AngularDiameterMethod,
  astronomicalUnit,
  AzEl,
  Celestial,
  cKmPerSec,
  DEG2RAD,
  Degrees,
  Earth,
  EpochUTC,
  Kilometers,
  Meters,
  MS_PER_DAY,
  RAD2DEG,
  RaDec,
  Radians,
  Seconds,
  SunTime,
  TAU,
  Vector3D,
} from '../main.js';

/**
 * Sun metrics and operations.
 */
export class Sun {
  private static readonly J0_ = 0.0009;
  private static readonly J1970_ = 2440587.5;
  private static readonly J2000_ = 2451545;
  static readonly e = DEG2RAD * 23.4397;

  /**
   * Array representing the times for different phases of the sun. Each element
   * in the array contains:
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
  static readonly penumbraAngle = (0.26900424 * DEG2RAD) as Radians;
  /**
   * The radius of the Sun in kilometers.
   */
  static readonly radius = 695500.0 as Kilometers;
  /**
   * The mean solar flux of the Sun. (W/m²)
   */
  static readonly solarFlux = 1367.0;
  /**
   * The solar pressure exerted by the Sun. (N/m²) It is calculated as the solar
   * flux divided by the speed of light.
   */
  static readonly solarPressure = Sun.solarFlux / (cKmPerSec * 1000);
  /**
   * The angle of the umbra, in radians.
   */
  static readonly umbraAngle = (0.26411888 * DEG2RAD) as Radians;

  private constructor() {
    // disable constructor
  }

  /**
   * Calculates the azimuth and elevation of the Sun for a given date, latitude,
   * and longitude.
   * @param date - The date for which to calculate the azimuth and elevation.
   * @param lat - The latitude in degrees.
   * @param lon - The longitude in degrees.
   * @param c - The right ascension and declination of the target. Defaults to
   * the Sun's right ascension and declination
   * @returns An object containing the azimuth and elevation of the Sun in
   * radians.
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
   * See: https://en.wikipedia.org/wiki/Epoch_(astronomy)
   * @param date date as timestamp to get days
   * @returns count of days
   */
  static date2jSince2000(date: Date): number {
    return date.getTime() / MS_PER_DAY + Sun.J1970_ - Sun.J2000_;
  }

  /**
   * Calculates the angular diameter of the Sun given the observer's position
   * and the Sun's position.
   * @param obsPos The observer's position in kilometers.
   * @param sunPos The Sun's position in kilometers.
   * @returns The angular diameter of the Sun in radians.
   */
  static diameter(obsPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): Radians {
    return angularDiameter(
      this.radius * 2,
      obsPos.subtract(sunPos).magnitude(),
      AngularDiameterMethod.Sphere,
    ) as Radians;
  }

  /**
   * Calculate eclipse angles given a satellite ECI position and Sun ECI
   * position.
   * @param satPos the satellite position
   * @param sunPos the sun position
   * @returns [central body angle, central body apparent radius, sun apparent]
   */
  static eclipseAngles(satPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): [Radians, Radians, Radians] {
    const satSun = sunPos.subtract(satPos);
    const r = satPos.magnitude();

    return [
      // central body angle
      satSun.angle(satPos.negate()) as Radians,
      // central body apparent radius
      Math.asin(Earth.radiusEquator / r) as Radians,
      // sun apparent radius
      Math.asin(this.radius / satSun.magnitude()) as Radians,
    ];
  }

  /**
   * Ecliptic latitude measures the distance north or south of the ecliptic,
   * attaining +90° at the north ecliptic pole (NEP) and -90° at the south
   * ecliptic pole (SEP). The ecliptic itself is 0° latitude.
   * @param B - ?
   * @returns ecliptic latitude
   */
  static eclipticLatitude(B: number): number {
    const C = TAU / 360;
    const L = B - 0.00569 - 0.00478 * Math.sin(C * B);

    return TAU * (L + 0.0003 * Math.sin(C * 2 * L));
  }

  /**
   * Ecliptic longitude, also known as celestial longitude, measures the angular
   * distance of an object along the ecliptic from the primary direction. It is
   * measured positive eastwards in the fundamental plane (the ecliptic) from 0°
   * to 360°. The primary direction (0° ecliptic longitude) points from the
   * Earth towards the Sun at the vernal equinox of the Northern Hemisphere. Due
   * to axial precession, the ecliptic longitude of most "fixed stars" increases
   * by about 50.3 arcseconds per year, or 83.8 arcminutes per century.
   * @param M - solar mean anomaly
   * @returns ecliptic longitude
   */
  static eclipticLongitude(M: number): Radians {
    const C = DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = DEG2RAD * 102.9372; // perihelion of Earth

    return <Radians>(M + C + P + Math.PI); // Sun's mean longitude
  }

  /**
   * returns set time for the given sun altitude
   * @param h - height at 0
   * @param lw - rad * -lng
   * @param phi -  rad * lat;
   * @param dec - declination
   * @param n - Julian cycle
   * @param M - solar mean anomal
   * @param L - ecliptic longitude
   * @returns set time
   */
  static getSetJulian(h: Meters, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
    const w = Sun.hourAngle(h, phi, dec);
    const a = Sun.approxTransit_(w, lw, n);

    return Sun.solarTransitJulian(a, M, L);
  }

  /**
   * Calculates the time of the sun based on the given azimuth.
   * @param dateValue - The date value or Date object.
   * @param lat - The latitude in degrees.
   * @param lon - The longitude in degrees.
   * @param az - The azimuth in radians or degrees.
   * @param isDegrees - Indicates if the azimuth is in degrees. Default is false.
   * @returns The calculated time of the sun.
   * @throws Error if the azimuth, latitude, or longitude is missing.
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
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
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
   * Default altitude is 0 meters. If `isUtc` is `true`, the times are returned
   * as UTC, otherwise in local time.
   * @param dateVal - The date value or Date object.
   * @param lat - The latitude in degrees.
   * @param lon - The longitude in degrees.
   * @param alt - The altitude in meters. Default is 0.
   * @param isUtc - Indicates if the times should be returned as UTC. Default is
   * false.
   * @returns An object containing the times of the sun.
   */
  static getTimes(dateVal: Date | number, lat: Degrees, lon: Degrees, alt: Meters = <Meters>0, isUtc = false): SunTime {
    if (isNaN(lat)) {
      throw new Error('latitude missing');
    }
    if (isNaN(lon)) {
      throw new Error('longitude missing');
    }

    // Ensure date is a Date object
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);

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
    } as SunTime;

    // Add all other unique times using Jnoon as a reference
    for (let i = 0, len = Sun.times_.length; i < len; i += 1) {
      time = Sun.times_[i];
      const angle = time[0] as Degrees;

      h0 = <Meters>((angle + dh) * DEG2RAD);

      Jset = Sun.getSetJ_(h0, lw, phi, dec, n, M, L);
      Jrise = Jnoon - (Jset - Jnoon);

      result[time[1] as string] = Sun.julian2date(Jrise);
      result[time[2] as string] = Sun.julian2date(Jset);
    }

    return result;
  }

  /**
   * hour angle
   * @param h - heigh at 0
   * @param phi -  rad * lat;
   * @param dec - declination
   * @returns hour angle
   */
  static hourAngle(h: number, phi: number, dec: number): number {
    return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  }

  /**
   * convert Julian calendar to date object
   * @param julian day number in Julian calendar to convert
   * @returns result date as timestamp
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
   * The Julian Period starts at noon on January 1, 4713 B.C.E. (Julian
   * calendar) and lasts for 7980 years. This was determined because it is a
   * time period long enough to include all of recorded history and includes
   * some time in the future that would incorporate the three important
   * calendrical cycles, the Golden Number Cycle, the Solar Cycle, and the Roman
   * Indiction.
   *
   * The Golden Number Cycle is a cycle of 19 years, while the Solar Cycle is a
   * cycle of 28 years and the Roman Indiction repeats every 15 years. Thus the
   * Julian Period is calculated to be 7980 years long or 2,914,695 days because
   * 19*28*15 = 7980.
   * @param date - Date object for calculating julian cycle
   * @param lon - Degrees longitude
   * @returns julian cycle
   */
  static julianCycle(date: Date, lon: Degrees): number {
    const lw = <Radians>(-lon * DEG2RAD);
    const d = Sun.date2jSince2000(date);

    return Math.round(d - Sun.J0_ - lw / ((2 * TAU) / 2));
  }

  /**
   * Calculate the lighting ratio given a satellite ECI position [satPos] _(km)_
   * and Sun ECI position [sunPos] _(km)_.
   *
   * Returns `1.0` if the satellite is fully illuminated and `0.0` when fully
   * eclipsed.
   * @param satPos - The position of the satellite.
   * @param sunPos - The position of the sun.
   * @returns The lighting ratio.
   */
  static lightingRatio(satPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): number {
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
   * Calculates the lighting factor based on the position of the satellite and the sun.
   * @deprecated This method was previously used. It is now deprecated and will be removed
   * in a future release.
   * @param satPos The position of the satellite.
   * @param sunPos The position of the sun.
   * @returns The lighting factor.
   */
  static sunlightLegacy(satPos: Vector3D, sunPos: Vector3D): number {
    let lighting = 1.0;

    const semiDiamEarth =
      Math.asin(Earth.radiusMean / Math.sqrt((-satPos.x) ** 2 + (-satPos.y) ** 2 + (-satPos.z) ** 2)) * RAD2DEG;

    const semiDiamSun =
      Math.asin(
        Sun.radius / Math.sqrt((-satPos.x + sunPos.x) ** 2 + (-satPos.y + sunPos.y) ** 2 + (-satPos.z + sunPos.z) ** 2),
      ) * RAD2DEG;

    // Angle between earth and sun
    const theta =
      Math.acos(
        satPos.negate().dot(sunPos.negate()) /
        (Math.sqrt((-satPos.x) ** 2 + (-satPos.y) ** 2 + (-satPos.z) ** 2) *
          Math.sqrt((-satPos.x + sunPos.x) ** 2 + (-satPos.y + sunPos.y) ** 2 + (-satPos.z + sunPos.z) ** 2)),
      ) * RAD2DEG;

    if (semiDiamEarth > semiDiamSun && theta < semiDiamEarth - semiDiamSun) {
      lighting = 0;
    }

    if (Math.abs(semiDiamEarth - semiDiamSun) < theta && theta < semiDiamEarth + semiDiamSun) {
      lighting = 0.5;
    }

    if (semiDiamSun > semiDiamEarth) {
      lighting = 0.5;
    }

    if (theta < semiDiamSun - semiDiamEarth) {
      lighting = 0.5;
    }

    return lighting;
  }

  /**
   * Calculates the position vector of the Sun at a given epoch in the
   * Earth-centered inertial (ECI) coordinate system.
   * @param epoch - The epoch in UTC.
   * @returns The position vector of the Sun in Kilometers.
   */
  static position(epoch: EpochUTC): Vector3D<Kilometers> {
    const jc = epoch.toJulianCenturies();
    const dtr = DEG2RAD;
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

    return rMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<Kilometers>;
  }

  /**
   * Calculate the Sun's apparent ECI position _(km)_ from Earth for a given UTC
   * [epoch].
   * @param epoch - The epoch in UTC.
   * @returns The Sun's apparent ECI position in kilometers.
   */
  static positionApparent(epoch: EpochUTC): Vector3D<Kilometers> {
    const distance = Sun.position(epoch).magnitude();
    const dSec = distance / cKmPerSec;

    return Sun.position(epoch.roll(-dSec as Seconds));
  }

  /**
   * Calculates the right ascension and declination of the Sun for a given date.
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
      dist: 0 as Kilometers,
    };
  }

  /**
   * Return `true` if the ECI satellite position [posSat] is in eclipse at the
   * given UTC [epoch].
   * @param epoch - The epoch in UTC.
   * @param posSat - The ECI position of the satellite in kilometers.
   * @returns `true` if the satellite is in eclipse.
   */
  static shadow(epoch: EpochUTC, posSat: Vector3D<Kilometers>): boolean {
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
   * @param d - julian day
   * @param lw - longitude of the observer
   * @returns sidereal time
   */
  static siderealTime(d: number, lw: Radians): number {
    return DEG2RAD * (280.16 + 360.9856235 * d) - lw;
  }

  /**
   * solar transit in Julian
   * @param ds approxTransit
   * @param M solar mean anomal
   * @param L ecliptic longitude
   * @returns solar transit in Julian
   */
  static solarTransitJulian(ds: number, M: number, L: number): number {
    return Sun.J2000_ + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  }

  /**
   * The approximate transit time
   * @param Ht hourAngle
   * @param lw rad * -lng
   * @param n Julian cycle
   * @returns approx transit
   */
  private static approxTransit_(Ht: number, lw: number, n: number): number {
    return Sun.J0_ + (Ht + lw) / TAU + n;
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
   * @param alt altitude at 0
   * @param lw lng
   * @param phi lat
   * @param dec declination
   * @param n Julian cycle
   * @param M solar mean anomal
   * @param L ecliptic longitude
   * @returns sunset time in days since 2000
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
    const lonOffset = lw / TAU;

    return Math.round(d - Sun.J0_ - lonOffset);
  }

  /**
   * calculates the obderver angle
   * @param alt the observer altitude (in meters) relative to the horizon
   * @returns height for further calculations
   */
  private static observerAngle_(alt: Meters): Degrees {
    return <Degrees>((-2.076 * Math.sqrt(alt)) / 60);
  }

  /**
   * get solar mean anomaly
   * @param d julian day
   * @returns solar mean anomaly
   */
  private static solarMeanAnomaly_(d: number): number {
    return DEG2RAD * (357.5291 + 0.98560028 * d);
  }
}
