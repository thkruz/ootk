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
 * @copyright © 2012–2016 Brandon Rhodes
 * This was ported from the python-sgp4 library by Brandon Rhodes.
 */

// NOTE: This file is meant to maintain as much of the original format as possible.
/* eslint-disable no-lonely-if */
/* eslint-disable prefer-destructuring */
/* eslint-disable complexity */
/* eslint-disable max-len */
/* eslint-disable no-param-reassign */
/* eslint-disable max-params */
/* eslint-disable no-shadow */
/* eslint-disable init-declarations */
/* eslint-disable max-statements */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */

import { Sgp4OpsMode } from '../enums/Sgp4OpsMode.js';
import { GreenwichMeanSiderealTime, SatelliteRecord, StateVectorSgp4, Vec3Flat } from '../types/types.js';
import { DEG2RAD, PI, TAU, temp4, x2o3 } from '../utils/constants.js';

export enum Sgp4GravConstants {
  wgs72old = 'wgs72old',
  wgs72 = 'wgs72',
  wgs84 = 'wgs84',
}

interface DsInitParams {
  xke: number;
  cosim: number;
  argpo: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  sinim: number;
  ss1: number;
  ss2: number;
  ss3: number;
  ss4: number;
  ss5: number;
  sz1: number;
  sz3: number;
  sz11: number;
  sz13: number;
  sz21: number;
  sz23: number;
  sz31: number;
  sz33: number;
  t: number;
  tc: number;
  gsto: number;
  mo: number;
  mdot: number;
  no: number;
  nodeo: number;
  nodedot: number;
  xPIdot: number;
  z1: number;
  z3: number;
  z11: number;
  z13: number;
  z21: number;
  z23: number;
  z31: number;
  z33: number;
  ecco: number;
  eccsq: number;
  emsq: number;
  em: number;
  argpm: number;
  inclm: number;
  mm: number;
  nm: number;
  nodem: number;
  irez: number;
  atime: number;
  d2201: number;
  d2211: number;
  d3210: number;
  d3222: number;
  d4410: number;
  d4422: number;
  d5220: number;
  d5232: number;
  d5421: number;
  d5433: number;
  dedt: number;
  didt: number;
  dmdt: number;
  dnodt: number;
  domdt: number;
  del1: number;
  del2: number;
  del3: number;
  xfact: number;
  xlamo: number;
  xli: number;
  xni: number;
}

/*
 *     ----------------------------------------------------------------
 *
 *                               sgp4unit.cpp
 *
 *    this file contains the sgp4 procedures for analytical propagation
 *    of a satellite. the code was originally released in the 1980 and 1986
 *    spacetrack papers. a detailed discussion of the theory and history
 *    may be found in the 2006 aiaa paper by vallado, crawford, hujsak,
 *    and kelso.
 *
 *                            companion code for
 *               fundamentals of astrodynamics and applications
 *                                    2013
 *                              by david vallado
 *
 *     (w) 719-573-2600, email dvallado@agi.com, davallado@gmail.com
 *
 *    current :
 *              12 mar 20  david vallado
 *                           chg satnum to string for alpha 5 or 9-digit
 *    changes :
 *               7 dec 15  david vallado
 *                           fix jd, jdfrac
 *               3 nov 14  david vallado
 *                           update to msvs2013 c++
 *              30 aug 10  david vallado
 *                           delete unused variables in initl
 *                           replace pow integer 2, 3 with multiplies for speed
 *               3 nov 08  david vallado
 *                           put returns in for error codes
 *              29 sep 08  david vallado
 *                           fix atime for faster operation in dspace
 *                           add operationmode for afspc (a) or improved (i)
 *                           performance mode
 *              16 jun 08  david vallado
 *                           update small eccentricity check
 *              16 nov 07  david vallado
 *                           misc fixes for better compliance
 *              20 apr 07  david vallado
 *                           misc fixes for constants
 *              11 aug 06  david vallado
 *                           chg lyddane choice back to strn3, constants, misc doc
 *              15 dec 05  david vallado
 *                           misc fixes
 *              26 jul 05  david vallado
 *                           fixes for paper
 *                           note that each fix is preceded by a
 *                           comment with "sgp4fix" and an explanation of
 *                           what was changed
 *              10 aug 04  david vallado
 *                           2nd printing baseline working
 *              14 may 01  david vallado
 *                           2nd edition baseline
 *                     80  norad
 *                           original baseline
 *       ----------------------------------------------------------------
 */
export class Sgp4 {
  // Dot

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure angle_SGP4
   *
   *  this procedure calculates the angle between two vectors.  the output is
   *    set to 999999.1 to indicate an undefined value.  be sure to check for
   *    this at the output phase.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    vec1        - vector number 1
   *    vec2        - vector number 2
   *
   *  outputs       :
   *    theta       - angle between the two vectors  -pi to pi
   *
   *  locals        :
   *    temp        - temporary real variable
   *
   *  coupling      :
   *    dot           dot product of two vectors
   * ---------------------------------------------------------------------------
   */
  private static angle_(vec1: Vec3Flat, vec2: Vec3Flat): number {
    const small = 0.00000001;
    const unknown = 999999.1; /** Ootk -- original 'undefined' is protected in JS */

    const magv1 = Sgp4.mag_(vec1);
    const magv2 = Sgp4.mag_(vec2);

    if (magv1 * magv2 > small * small) {
      let temp = Sgp4.dot_(vec1, vec2) / (magv1 * magv2);

      if (Math.abs(temp) > 1.0) {
        temp = Number(Sgp4.sgn_(temp));
      }

      return Math.acos(temp);
    }

    return unknown;
  }

  // Angle

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function asinh_SGP4
   *
   *  this function evaluates the inverse hyperbolic sine function.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    xval        - angle value                                  any real
   *
   *  outputs       :
   *    arcsinh     - result                                       any real
   *
   *  locals        :
   *    none.
   *
   *  coupling      :
   *    none.
   * ---------------------------------------------------------------------------
   */
  private static asinh_(xval: number): number {
    return Math.log(xval + Math.sqrt(xval * xval + 1.0));
  }

  // Getgravconst

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function twoline2rv
   *
   *  this function converts the two line element set character string data to
   *    variables and initializes the sgp4 variables. several intermediate varaibles
   *    and quantities are determined. note that the result is a structure so multiple
   *    satellites can be processed simultaneously without having to reinitialize. the
   *    verification mode is an important option that permits quick checks of any
   *    changes to the underlying technical theory. this option works using a
   *    modified tle file in which the start, stop, and delta time values are
   *    included at the end of the second line of data. this only works with the
   *    verification mode. the catalog mode simply propagates from -1440 to 1440 min
   *    from epoch and is useful when performing entire catalog runs.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs        :
   *    longstr1    - first line of the tle
   *    longstr2    - second line of the tle
   *    typerun     - type of run                    verification 'v', catalog 'c',
   *                                                 manual 'm'
   *    typeinput   - type of manual input           mfe 'm', epoch 'e', dayofyr 'd'
   *    opsmode     - mode of operation afspc or improved 'a', 'i'
   *    whichconst  - which set of constants to use  72, 84
   *
   *  outputs       :
   *    satrec      - structure containing all the sgp4 satellite information
   *
   *  coupling      :
   *    getgravconst-
   *    days2mdhms  - conversion of days to month, day, hour, minute, second
   *    jday        - convert day month year hour minute second into julian date
   *    sgp4init    - initialize the sgp4 variables
   *
   *  references    :
   *    norad spacetrack report #3
   *    vallado, crawford, hujsak, kelso  2006
   * ---------------------------------------------------------------------------
   */
  static createSatrec(
    tleLine1: string,
    tleLine2: string,
    whichconst = Sgp4GravConstants.wgs72,
    opsmode = Sgp4OpsMode.IMPROVED,
  ): SatelliteRecord {
    let year = 0;

    const satrec = {
      a: null as number | null,
      am: null,
      alta: null,
      altp: null,
      argpdot: null,
      argpo: null as number | null,
      aycof: null,
      bstar: null as number | null,
      cc1: null,
      cc4: null,
      cc5: null,
      con41: null,
      d2: null,
      d3: null,
      d4: null,
      d5232: null,
      d5421: null,
      d5433: null,
      dedt: null,
      delmo: null,
      del1: null,
      ecco: null as number | null,
      em: null,
      epochdays: null as number | null,
      epochyr: null as number | null,
      error: null as number | null,
      eta: null,
      gsto: null,
      im: null,
      inclo: null as number | null,
      init: null,
      isimp: null,
      jdsatepoch: null as number | null,
      mdot: null,
      method: null,
      mo: null as number | null,
      mm: null,
      nddot: null as number | null,
      ndot: null as number | null,
      no: null as number | null,
      nodecf: null,
      nodedot: null,
      nodeo: null as number | null,
      om: null,
      Om: null,
      omgcof: null,
      operationmode: null,
      satnum: null as string | null,
      sinmao: null,
      t: null,
      t2cof: null,
      t3cof: null,
      t4cof: null,
      t5cof: null,
      x1mth2: null,
      x7thm1: null,
      xlcof: null,
      xmcof: null,
      xfact: null,
      xlamo: null,
      xli: null,
      xgh4: null,
      xgh3: null,
      xh2: null,
      xi2: null,
      xi3: null,
      xl2: null,
      xl3: null,
      xl4: null,
      zmol: null,
      zmos: null,
      dmdt: null,
      dnodt: null,
      domdt: null,
      e3: null,
      ee2: null,
      peo: null,
      pgho: null,
      pho: null,
      PInco: null,
      plo: null,
      se2: null,
      se3: null,
      sgh2: null,
      sgh3: null,
      sgh4: null,
      sh2: null,
      sh3: null,
      si2: null,
      si3: null,
      sl2: null,
      sl3: null,
      sl4: null,
      xgh2: null,
      xh3: null,
      tumin: null,
      radiusearthkm: null,
      irez: null,
      d3210: null,
      d3222: null,
      d4410: null,
      d4422: null,
      d5220: null,
      del2: null,
      del3: null,
      didt: null,
      atime: null,
      j2: null,
      j3: null,
      j4: null,
      mus: null,
      xke: null,
      j3oj2: null,
      xni: null,
      d2201: null,
      d2211: null,
      nm: null,
    };

    /*
     * Sgp4fix no longer needed
     * getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
     */
    const xpdotp = 1440.0 / (2.0 * PI); // 229.1831180523293;

    satrec.error = 0;

    satrec.satnum = tleLine1.substring(2, 7);

    satrec.epochyr = parseInt(tleLine1.substring(18, 20));
    satrec.epochdays = parseFloat(tleLine1.substring(20, 32));
    satrec.ndot = parseFloat(tleLine1.substring(33, 43));
    satrec.nddot = parseFloat(
      `${tleLine1.substring(44, 45)}.${tleLine1.substring(45, 50)}E${tleLine1.substring(50, 52)}`,
    );
    satrec.bstar = parseFloat(
      `${tleLine1.substring(53, 54)}.${tleLine1.substring(54, 59)}E${tleLine1.substring(59, 61)}`,
    );

    // Satrec.satnum = tleLine2.substring(2, 7);
    satrec.inclo = parseFloat(tleLine2.substring(8, 16));
    satrec.nodeo = parseFloat(tleLine2.substring(17, 25));
    satrec.ecco = parseFloat(`.${tleLine2.substring(26, 33)}`);
    satrec.argpo = parseFloat(tleLine2.substring(34, 42));
    satrec.mo = parseFloat(tleLine2.substring(43, 51));
    satrec.no = parseFloat(tleLine2.substring(52, 63));

    // ---- find no, ndot, nddot ----
    satrec.no /= xpdotp; //   Rad/min
    /** Ootk -- nexp and ibexp are calculated above using template literals */
    /*
     * Satrec.nddot = satrec.nddot * Math.pow(10.0, nexp);
     * satrec.bstar = satrec.bstar * Math.pow(10.0, ibexp);
     */

    /*
     * ---- convert to sgp4 units ----
     * satrec.a = (satrec.no * tumin) ** (-2.0 / 3.0);
     */
    /** Ootk -- Not sure why the following two lines are added. 1st and 2nd derivatives aren't even used anymore */
    /*
     * Satrec.ndot /= xpdotp * 1440.0; // ? * minperday
     * satrec.nddot /= xpdotp * 1440.0 * 1440;
     */

    // ---- find standard orbital elements ----
    satrec.inclo *= DEG2RAD;
    satrec.nodeo *= DEG2RAD;
    satrec.argpo *= DEG2RAD;
    satrec.mo *= DEG2RAD;

    /*
     * Sgp4fix not needed here
     * satrec.alta = satrec.a * (1.0 + satrec.ecco) - 1.0;
     * satrec.altp = satrec.a * (1.0 - satrec.ecco) - 1.0;
     */

    /*
     * ----------------------------------------------------------------
     * find sgp4epoch time of element set
     * remember that sgp4 uses units of days from 0 jan 1950 (sgp4epoch)
     * and minutes from the epoch (time)
     * ----------------------------------------------------------------
     */

    /*
     * ---------------- temp fix for years from 1957-2056 -------------------
     * --------- correct fix will occur when year is 4-digit in tle ---------
     */

    if (satrec.epochyr < 57) {
      year = satrec.epochyr + 2000;
    } else {
      year = satrec.epochyr + 1900;
    }

    const { mon, day, hr, min, sec } = Sgp4.days2mdhms(year, satrec.epochdays);

    const jdayRes = Sgp4.jday(year, mon, day, hr, min, sec);

    satrec.jdsatepoch = jdayRes.jd + jdayRes.jdFrac;

    //  ---------------- initialize the orbit at sgp4epoch -------------------
    Sgp4.sgp4init_(satrec as unknown as SatelliteRecord, {
      whichconst,
      opsmode,
      satn: satrec.satnum,
      epoch: satrec.jdsatepoch - 2433281.5,
      xbstar: satrec.bstar,
      xecco: satrec.ecco,
      xargpo: satrec.argpo,
      xinclo: satrec.inclo,
      xndot: satrec.ndot,
      xnddot: satrec.nddot,
      xmo: satrec.mo,
      xno: satrec.no,
      xnodeo: satrec.nodeo,
    });

    return satrec as unknown as SatelliteRecord;
  }

  // Mag

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure cross_SGP4
   *
   *  this procedure crosses two vectors.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    vec1        - vector number 1
   *    vec2        - vector number 2
   *
   *  outputs       :
   *    outvec      - vector result of a x b
   *
   *  locals        :
   *    none.
   *
   *  coupling      :
   *    mag           magnitude of a vector
   * ----------------------------------------------------------------------------
   */
  private static cross_(vec1: Vec3Flat, vec2: Vec3Flat): Vec3Flat {
    const outvec: Vec3Flat = [0, 0, 0];

    outvec[0] = vec1[1] * vec2[2] - vec1[2] * vec2[1];
    outvec[1] = vec1[2] * vec2[0] - vec1[0] * vec2[2];
    outvec[2] = vec1[0] * vec2[1] - vec1[1] * vec2[0];

    return outvec;
  }

  // Jday

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure days2mdhms
   *
   *  this procedure converts the day of the year, days, to the equivalent month
   *    day, hour, minute and second.
   *
   *  algorithm     : set up array for the number of days per month
   *                  find leap year - use 1900 because 2000 is a leap year
   *                  loop through a temp value while the value is < the days
   *                  perform int conversions to the correct day and month
   *                  convert remainder into h m s using type conversions
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    year        - year                           1900 .. 2100
   *    days        - julian day of the year         0.0  .. 366.0
   *
   *  outputs       :
   *    mon         - month                          1 .. 12
   *    day         - day                            1 .. 28,29,30,31
   *    hr          - hour                           0 .. 23
   *    min         - minute                         0 .. 59
   *    sec         - second                         0.0 .. 59.999
   *
   *  locals        :
   *    dayofyr     - day of year
   *    temp        - temporary extended values
   *    inttemp     - temporary int value
   *    i           - index
   *    lmonth[13]  - int array containing the number of days per month
   *
   *  coupling      :
   *    none.
   * ---------------------------------------------------------------------------
   */
  static days2mdhms(
    year: number,
    days: number,
  ): {
    mon: number;
    day: number;
    hr: number;
    min: number;
    sec: number;
  } {
    const lmonth = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const dayofyr = Math.floor(days);

    //  ----------------- find month and day of month ----------------
    /** Ootk -- Incorporated in the above declaration */
    /*
     * If ((year % 4) == 0)
     * lmonth[2] = 29;
     */

    let i = 1;
    let inttemp = 0;

    while (dayofyr > inttemp + lmonth[i - 1] && i < 12) {
      inttemp += lmonth[i - 1];
      i += 1;
    }

    const mon = i;
    const day = dayofyr - inttemp;

    //  ----------------- find hours minutes and seconds -------------
    let temp = (days - dayofyr) * 24.0;
    const hr = Math.floor(temp);

    temp = (temp - hr) * 60.0;
    const min = Math.floor(temp);
    const sec = (temp - min) * 60.0;

    return {
      mon,
      day,
      hr,
      min,
      sec,
    };
  }

  // End cross

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function dot_SGP4
   *
   *  this function finds the dot product of two vectors.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    vec1        - vector number 1
   *    vec2        - vector number 2
   *
   *  outputs       :
   *    dot         - result
   *
   *  locals        :
   *    none.
   *
   *  coupling      :
   *    none.
   * ---------------------------------------------------------------------------
   */
  private static dot_(x: Vec3Flat, y: Vec3Flat): number {
    return x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  }

  // Twoline2rv

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function gstime
   *
   *  this function finds the greenwich sidereal time.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    jdut1       - julian date in ut1             days from 4713 bc
   *
   *  outputs       :
   *    gstime      - greenwich sidereal time        0 to 2PI rad
   *
   *  locals        :
   *    temp        - temporary variable for doubles   rad
   *    tut1        - julian centuries from the
   *                  jan 1, 2000 12 h epoch (ut1)
   *
   *  coupling      :
   *    none
   *
   *  references    :
   *    vallado       2004, 191, eq 3-45
   * ---------------------------------------------------------------------------
   */
  static gstime(jdut1: number): GreenwichMeanSiderealTime {
    const tut1 = (jdut1 - 2451545.0) / 36525.0;

    let temp =
      -6.2e-6 * tut1 * tut1 * tut1 + 0.093104 * tut1 * tut1 + (876600.0 * 3600 + 8640184.812866) * tut1 + 67310.54841; // Sec

    temp = ((temp * DEG2RAD) / 240.0) % TAU; // 360/86400 = 1/240, to deg, to rad

    //  ------------------------ check quadrants ---------------------
    if (temp < 0.0) {
      temp += TAU;
    }

    return temp as GreenwichMeanSiderealTime;
  }

  // Days2mdhms

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure invjday
   *
   *  this procedure finds the year, month, day, hour, minute and second
   *  given the julian date. tu can be ut1, tdt, tdb, etc.
   *
   *  algorithm     : set up starting values
   *                  find leap year - use 1900 because 2000 is a leap year
   *                  find the elapsed days through the year in a loop
   *                  call routine to find each individual value
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    jd          - julian date                    days from 4713 bc
   *    jdfrac      - julian date fraction into day  days from 4713 bc
   *
   *  outputs       :
   *    year        - year                           1900 .. 2100
   *    mon         - month                          1 .. 12
   *    day         - day                            1 .. 28,29,30,31
   *    hr          - hour                           0 .. 23
   *    min         - minute                         0 .. 59
   *    sec         - second                         0.0 .. 59.999
   *
   *  locals        :
   *    days        - day of year plus fractional
   *                  portion of a day               days
   *    tu          - julian centuries from 0 h
   *                  jan 0, 1900
   *    temp        - temporary double values
   *    leapyrs     - number of leap years from 1900
   *
   *  coupling      :
   *    days2mdhms  - finds month, day, hour, minute and second given days and year
   *
   *  references    :
   *    vallado       2013, 203, alg 22, ex 3-13
   * ---------------------------------------------------------------------------
   */
  static invjday(
    jd: number,
    jdfrac: number,
  ): { year: number; mon: number; day: number; hr: number; min: number; sec: number } {
    let leapyrs;
    let days;

    // Check jdfrac for multiple days
    if (Math.abs(jdfrac) >= 1.0) {
      jd += Math.floor(jdfrac);
      jdfrac -= Math.floor(jdfrac);
    }

    // Check for fraction of a day included in the jd
    const dt = jd - Math.floor(jd) - 0.5;

    if (Math.abs(dt) > 0.00000001) {
      jd -= dt;
      jdfrac += dt;
    }

    /* --------------- find year and days of the year --------------- */
    const temp = jd - 2415019.5;
    const tu = temp / 365.25;
    let year = 1900 + Math.floor(tu);

    leapyrs = Math.floor((year - 1901) * 0.25);

    days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));

    /* ------------ check for case of beginning of a year ----------- */
    if (days + jdfrac < 1.0) {
      year -= 1;
      leapyrs = Math.floor((year - 1901) * 0.25);
      days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));
    }

    /* ----------------- find remaining data  ------------------------- */
    const { mon, day, hr, min, sec } = Sgp4.days2mdhms(year, days + jdfrac);

    return {
      year,
      mon,
      day,
      hr,
      min,
      sec,
    };
  }

  // Rv2coe

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure jday
   *
   *  this procedure finds the julian date given the year, month, day, and time.
   *    the julian date is defined by each elapsed day since noon, jan 1, 4713 bc.
   *
   *  algorithm     : calculate the answer in one step for efficiency
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    year        - year                           1900 .. 2100
   *    mon         - month                          1 .. 12
   *    day         - day                            1 .. 28,29,30,31
   *    hr          - universal time hour            0 .. 23
   *    min         - universal time min             0 .. 59
   *    sec         - universal time sec             0.0 .. 59.999
   *
   *  outputs       :
   *    jd          - julian date                    days from 4713 bc
   *    jdfrac      - julian date fraction into day  days from 4713 bc
   *
   *  locals        :
   *    none.
   *
   *  coupling      :
   *    none.
   *
   *  references    :
   *    vallado       2013, 183, alg 14, ex 3-4
   *
   * ---------------------------------------------------------------------------
   */
  static jday(year: number | Date, mon = 0, day = 0, hr = 0, min = 0, sec = 0, ms = 0): { jd: number; jdFrac: number } {
    if (year instanceof Date) {
      mon = year.getUTCMonth() + 1;
      day = year.getUTCDate();
      hr = year.getUTCHours();
      min = year.getUTCMinutes();
      sec = year.getUTCSeconds();
      ms = year.getUTCMilliseconds();
      year = year.getUTCFullYear();
    }

    let jd =
      367.0 * year -
      Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) +
      Math.floor((275 * mon) / 9.0) +
      day +
      1721013.5; // Use - 678987.0 to go to mjd directly
    let jdFrac = (ms / 1000 + sec + min * 60.0 + hr * 3600.0) / 86400.0;

    // Check that the day and fractional day are correct
    if (Math.abs(jdFrac) > 1.0) {
      const dtt = Math.floor(jdFrac);

      jd += dtt;
      jdFrac -= dtt;
    }
    // - 0.5*sgn(100.0*year + mon - 190002.5) + 0.5;

    return { jd, jdFrac };
  }

  // Sgn

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function mag
   *
   *  this procedure finds the magnitude of a vector.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs          description                    range / units
   *    vec         - vector
   *
   *  outputs       :
   *    mag         - answer
   *
   *  locals        :
   *    none.
   *
   *  coupling      :
   *    none.
   * ---------------------------------------------------------------------------
   */
  private static mag_(x: Vec3Flat): number {
    return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
  }

  // Asinh

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function newtonnu_SGP4
   *
   *  this function solves keplers equation when the true anomaly is known.
   *    the mean and eccentric, parabolic, or hyperbolic anomaly is also found.
   *    the parabolic limit at 168ø is arbitrary. the hyperbolic anomaly is also
   *    limited. the hyperbolic sine is used because it's not double valued.
   *
   *  author        : david vallado                  719-573-2600   27 may 2002
   *
   *  revisions
   *    vallado     - fix small                                     24 sep 2002
   *
   *  inputs          description                    range / units
   *    ecc         - eccentricity                   0.0  to
   *    nu          - true anomaly                   -2pi to 2pi rad
   *
   *  outputs       :
   *    e0          - eccentric anomaly              0.0  to 2pi rad       153.02 ø
   *    m           - mean anomaly                   0.0  to 2pi rad       151.7425 ø
   *
   *  locals        :
   *    e1          - eccentric anomaly, next value  rad
   *    sine        - sine of e
   *    cose        - cosine of e
   *    ktr         - index
   *
   *  coupling      :
   *    asinh       - arc hyperbolic sine
   *
   *  references    :
   *    vallado       2013, 77, alg 5
   * ---------------------------------------------------------------------------
   */
  private static newtonnu_(
    ecc: number,
    nu: number,
  ): {
    e0: number;
    m: number;
  } {
    // ---------------------  implementation   ---------------------
    let e0 = 999999.9;
    let m = 999999.9;
    const small = 0.00000001;

    if (Math.abs(ecc) < small) {
      // --------------------------- circular ------------------------
      m = nu;
      e0 = nu;
    } else if (ecc < 1.0 - small) {
      // ---------------------- elliptical -----------------------
      const sine = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
      const cose = (ecc + Math.cos(nu)) / (1.0 + ecc * Math.cos(nu));

      e0 = Math.atan2(sine, cose);
      m = e0 - ecc * Math.sin(e0);
    } else if (ecc > 1.0 + small) {
      // -------------------- hyperbolic  --------------------
      if (ecc > 1.0 && Math.abs(nu) + 0.00001 < PI - Math.acos(1.0 / ecc)) {
        const sine = (Math.sqrt(ecc * ecc - 1.0) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));

        e0 = Sgp4.asinh_(sine);
        m = ecc * Sgp4.sinh_(e0) - e0;
      }
    } else if (Math.abs(nu) < (168.0 * PI) / 180.0) {
      // ----------------- parabolic ---------------------
      e0 = Math.tan(nu * 0.5);
      m = e0 + (e0 * e0 * e0) / 3.0;
    }

    if (ecc < 1.0) {
      m %= 2.0 * PI;
      if (m < 0.0) {
        m += 2.0 * PI;
      }
      e0 %= 2.0 * PI;
    }

    return {
      e0,
      m,
    };
  }

  // Sgp4init

  /*
   *----------------------------------------------------------------------------
   *
   *                             procedure sgp4
   *
   *  this procedure is the sgp4 prediction model from space command. this is an
   *    updated and combined version of sgp4 and sdp4, which were originally
   *    published separately in spacetrack report //3. this version follows the
   *    methodology from the aiaa paper (2006) describing the history and
   *    development of the code.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    satrec  - initialised structure from sgp4init() call.
   *    tsince  - time since epoch (minutes)
   *
   *  outputs       :
   *    r           - position vector                     km
   *    v           - velocity                            km/sec
   *  return code - non-zero on error.
   *                   1 - mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er
   *                   2 - mean motion less than 0.0
   *                   3 - pert elements, ecc < 0.0  or  ecc > 1.0
   *                   4 - semi-latus rectum < 0.0
   *                   5 - epoch elements are sub-orbital
   *                   6 - satellite has decayed
   *
   *  locals        :
   *    am          -
   *    axnl, aynl        -
   *    betal       -
   *    cosim   , sinim   , cosomm  , sinomm  , cnod    , snod    , cos2u   ,
   *    sin2u   , coseo1  , sineo1  , cosi    , sini    , cosip   , sinip   ,
   *    cosisq  , cossu   , sinsu   , cosu    , sinu
   *    delm        -
   *    delomg      -
   *    dndt        -
   *    eccm        -
   *    emsq        -
   *    ecose       -
   *    el2         -
   *    eo1         -
   *    eccp        -
   *    esine       -
   *    argpm       -
   *    argpp       -
   *    omgadf      -
   *    pl          -
   *    r           -
   *    rtemsq      -
   *    rdotl       -
   *    rl          -
   *    rvdot       -
   *    rvdotl      -
   *    su          -
   *    t2  , t3   , t4    , tc
   *    tem5, temp , temp1 , temp2  , tempa  , tempe  , templ
   *    u   , ux   , uy    , uz     , vx     , vy     , vz
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    nodem       - right asc of ascending node
   *    xinc        -
   *    xincp       -
   *    xl          -
   *    xlm         -
   *    mp          -
   *    xmdf        -
   *    xmx         -
   *    xmy         -
   *    nodedf      -
   *    xnode       -
   *    nodep       -
   *    np          -
   *
   *  coupling      :
   *    getgravconst-
   *    dpper
   *    dspace
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report //3 1980
   *    hoots, norad spacetrack report //6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  static propagate(satrec: SatelliteRecord, tsince: number): StateVectorSgp4 {
    /* ------------------ set mathematical constants --------------- */
    /*
     * Sgp4fix divisor for divide by zero check on inclination
     * the old check used 1.0 + cos(PI-1.0e-9), but then compared it to
     * 1.5 e-12, so the threshold was changed to 1.5e-12 for consistency
     */

    /*
     * Sgp4fix identify constants and allow alternate values
     * getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
     */
    const { xke, j2, j3oj2 } = satrec;
    const vkmpersec = (satrec.radiusearthkm * satrec.xke) / 60.0;

    // --------------------- clear sgp4 error flag -----------------
    satrec.t = tsince;
    satrec.error = 0;

    //  ------- update for secular gravity and atmospheric drag -----
    const xmdf = satrec.mo + satrec.mdot * satrec.t;
    const argpdf = satrec.argpo + satrec.argpdot * satrec.t;
    const nodedf = satrec.nodeo + satrec.nodedot * satrec.t;
    let argpm = argpdf;
    let mm = xmdf;
    const t2 = satrec.t * satrec.t;
    let nodem = nodedf + satrec.nodecf * t2;
    let tempa = 1.0 - satrec.cc1 * satrec.t;
    let tempe = satrec.bstar * satrec.cc4 * satrec.t;
    let templ = satrec.t2cof * t2;

    if (satrec.isimp !== 1) {
      const delomg = satrec.omgcof * satrec.t;
      //  Sgp4fix use mutliply for speed instead of pow
      const delmtemp = 1.0 + satrec.eta * Math.cos(xmdf);
      const delm = satrec.xmcof * (delmtemp * delmtemp * delmtemp - satrec.delmo);
      const temp = delomg + delm;

      mm = xmdf + temp;
      argpm = argpdf - temp;
      const t3 = t2 * satrec.t;
      const t4 = t3 * satrec.t;

      tempa = tempa - satrec.d2 * t2 - satrec.d3 * t3 - satrec.d4 * t4;
      tempe += satrec.bstar * satrec.cc5 * (Math.sin(mm) - satrec.sinmao);
      templ = templ + satrec.t3cof * t3 + t4 * (satrec.t4cof + satrec.t * satrec.t5cof);
    }

    let nm = satrec.no;
    let em = satrec.ecco;
    let inclm = satrec.inclo;

    if (satrec.method === 'd') {
      const tc = satrec.t;

      const dspaceResult = Sgp4.dspace_(
        satrec.irez,
        satrec.d2201,
        satrec.d2211,
        satrec.d3210,
        satrec.d3222,
        satrec.d4410,
        satrec.d4422,
        satrec.d5220,
        satrec.d5232,
        satrec.d5421,
        satrec.d5433,
        satrec.dedt,
        satrec.del1,
        satrec.del2,
        satrec.del3,
        satrec.didt,
        satrec.dmdt,
        satrec.dnodt,
        satrec.domdt,
        satrec.argpo,
        satrec.argpdot,
        satrec.t,
        tc,
        satrec.gsto,
        satrec.xfact,
        satrec.xlamo,
        satrec.no,
        satrec.atime,
        em,
        argpm,
        inclm,
        satrec.xli,
        mm,
        satrec.xni,
        nodem,
        nm,
      );

      [em, argpm, inclm, mm, nodem, nm] = dspaceResult;
    } // If methjod = d

    if (nm <= 0.0) {
      // Printf("// error nm %f\n", nm);
      satrec.error = 2;
      // Sgp4fix add return

      return { position: false, velocity: false };
    }

    const am = (xke / nm) ** x2o3 * tempa * tempa;

    nm = xke / am ** 1.5;
    em -= tempe;

    /*
     * Fix tolerance for error recognition
     * sgp4fix am is fixed from the previous nm check
     */
    /* istanbul ignore next | This is no longer possible*/
    if (em >= 1.0 || em < -0.001) {
      /*
       * || (am < 0.95)
       * printf("// error em %f\n", em);
       */
      satrec.error = 1;
      // Sgp4fix to return if there is an error in eccentricity

      return { position: false, velocity: false };
    }

    //  Sgp4fix fix tolerance to avoid a divide by zero
    if (em < 1.0e-6) {
      em = 1.0e-6;
    }

    mm += satrec.no * templ;
    let xlm = mm + argpm + nodem;

    nodem %= TAU;
    argpm %= TAU;
    xlm %= TAU;
    mm = (xlm - argpm - nodem) % TAU;

    /*
     * Sgp4fix recover singly averaged mean elements
     * satrec.am = am;
     * satrec.em = em;
     * satrec.im = inclm;
     * satrec.Om = nodem;
     * satrec.om = argpm;
     * satrec.mm = mm;
     * satrec.nm = nm;
     */

    // ----------------- compute extra mean quantities -------------
    const sinim = Math.sin(inclm);
    const cosim = Math.cos(inclm);

    // -------------------- add lunar-solar periodics --------------
    let ep = em;
    let xincp = inclm;
    let argpp = argpm;
    let nodep = nodem;
    let mp = mm;
    let sinip = sinim;
    let cosip = cosim;

    if (satrec.method === 'd') {
      const dpperParameters = {
        inclo: satrec.inclo,
        init: 'n',
        ep,
        inclp: xincp,
        nodep,
        argpp,
        mp,
        opsmode: satrec.operationmode,
      };

      const dpperResult = Sgp4.dpper_(satrec, dpperParameters);

      ({ ep, nodep, argpp, mp } = dpperResult);

      xincp = dpperResult.inclp;

      if (xincp < 0.0) {
        xincp = -xincp;
        nodep += PI;
        argpp -= PI;
      }
      if (ep < 0.0 || ep > 1.0) {
        //  Printf("// error ep %f\n", ep);
        satrec.error = 3;
        //  Sgp4fix add return

        return { position: false, velocity: false };
      }
    }

    //  -------------------- long period periodics ------------------
    if (satrec.method === 'd') {
      sinip = Math.sin(xincp);
      cosip = Math.cos(xincp);
      satrec.aycof = -0.5 * j3oj2 * sinip;

      //  Sgp4fix for divide by zero for xincp = 180 deg
      if (Math.abs(cosip + 1.0) > 1.5e-12) {
        satrec.xlcof = (-0.25 * j3oj2 * sinip * (3.0 + 5.0 * cosip)) / (1.0 + cosip);
      } else {
        satrec.xlcof = (-0.25 * j3oj2 * sinip * (3.0 + 5.0 * cosip)) / temp4;
      }
    }

    const axnl = ep * Math.cos(argpp);
    let temp = 1.0 / (am * (1.0 - ep * ep));
    const aynl = ep * Math.sin(argpp) + temp * satrec.aycof;
    const xl = mp + argpp + nodep + temp * satrec.xlcof * axnl;

    // --------------------- solve kepler's equation ---------------
    const u = (xl - nodep) % TAU;
    let eo1 = u;
    let tem5 = 9999.9;
    let ktr = 1;

    /*
     *    Sgp4fix for kepler iteration
     *    the following iteration needs better limits on corrections
     */
    let coseo1 = 0;
    let sineo1 = 0;

    while (Math.abs(tem5) >= 1.0e-12 && ktr <= 10) {
      sineo1 = Math.sin(eo1);
      coseo1 = Math.cos(eo1);
      tem5 = 1.0 - coseo1 * axnl - sineo1 * aynl;
      tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
      if (Math.abs(tem5) >= 0.95) {
        if (tem5 > 0.0) {
          tem5 = 0.95;
        } else {
          tem5 = -0.95;
        }
      }
      eo1 += tem5;
      ktr += 1;
    }

    //  ------------- short period preliminary quantities -----------
    const ecose = axnl * coseo1 + aynl * sineo1;
    const esine = axnl * sineo1 - aynl * coseo1;
    const el2 = axnl * axnl + aynl * aynl;
    const pl = am * (1.0 - el2);

    if (pl < 0.0) {
      //  Printf("// error pl %f\n", pl);
      satrec.error = 4;
      //  Sgp4fix add return

      return { position: false, velocity: false };
    }

    const rl = am * (1.0 - ecose);
    const rdotl = (Math.sqrt(am) * esine) / rl;
    const rvdotl = Math.sqrt(pl) / rl;
    const betal = Math.sqrt(1.0 - el2);

    temp = esine / (1.0 + betal);
    const sinu = (am / rl) * (sineo1 - aynl - axnl * temp);
    const cosu = (am / rl) * (coseo1 - axnl + aynl * temp);
    let su = Math.atan2(sinu, cosu);
    const sin2u = (cosu + cosu) * sinu;
    const cos2u = 1.0 - 2.0 * sinu * sinu;

    temp = 1.0 / pl;
    const temp1 = 0.5 * j2 * temp;
    const temp2 = temp1 * temp;

    // -------------- update for short period periodics ------------
    if (satrec.method === 'd') {
      const cosisq = cosip * cosip;

      satrec.con41 = 3.0 * cosisq - 1.0;
      satrec.x1mth2 = 1.0 - cosisq;
      satrec.x7thm1 = 7.0 * cosisq - 1.0;
    }

    const mrt = rl * (1.0 - 1.5 * temp2 * betal * satrec.con41) + 0.5 * temp1 * satrec.x1mth2 * cos2u;

    /** Moved this up to reduce unnecessary computation if you are going to return false anyway */
    // Sgp4fix for decaying satellites
    if (mrt < 1.0) {
      // Printf("// decay condition %11.6f \n",mrt);
      satrec.error = 6;

      return {
        position: false,
        velocity: false,
      };
    }

    su -= 0.25 * temp2 * satrec.x7thm1 * sin2u;
    const xnode = nodep + 1.5 * temp2 * cosip * sin2u;
    const xinc = xincp + 1.5 * temp2 * cosip * sinip * cos2u;
    const mvt = rdotl - (nm * temp1 * satrec.x1mth2 * sin2u) / xke;
    const rvdot = rvdotl + (nm * temp1 * (satrec.x1mth2 * cos2u + 1.5 * satrec.con41)) / xke;

    // --------------------- orientation vectors -------------------
    const sinsu = Math.sin(su);
    const cossu = Math.cos(su);
    const snod = Math.sin(xnode);
    const cnod = Math.cos(xnode);
    const sini = Math.sin(xinc);
    const cosi = Math.cos(xinc);
    const xmx = -snod * cosi;
    const xmy = cnod * cosi;
    const ux = xmx * sinsu + cnod * cossu;
    const uy = xmy * sinsu + snod * cossu;
    const uz = sini * sinsu;
    const vx = xmx * cossu - cnod * sinsu;
    const vy = xmy * cossu - snod * sinsu;
    const vz = sini * cossu;

    // --------- position and velocity (in km and km/sec) ----------
    const r = {
      x: mrt * ux * satrec.radiusearthkm,
      y: mrt * uy * satrec.radiusearthkm,
      z: mrt * uz * satrec.radiusearthkm,
    };
    const v = {
      x: (mvt * ux + rvdot * vx) * vkmpersec,
      y: (mvt * uy + rvdot * vy) * vkmpersec,
      z: (mvt * uz + rvdot * vz) * vkmpersec,
    };

    return {
      position: r,
      velocity: v,
    };
  }

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function rv2coe_SGP4
   *
   *  this function finds the classical orbital elements given the geocentric
   *    equatorial position and velocity vectors.
   *
   *  author        : david vallado                  719-573-2600   21 jun 2002
   *
   *  revisions
   *    vallado     - fix special cases                              5 sep 2002
   *    vallado     - delete extra check in inclination code        16 oct 2002
   *    vallado     - add constant file use                         29 jun 2003
   *    vallado     - add mu                                         2 apr 2007
   *
   *  inputs          description                    range / units
   *    r           - ijk position vector            km
   *    v           - ijk velocity vector            km / s
   *    mu          - gravitational parameter        km3 / s2
   *
   *  outputs       :
   *    p           - semilatus rectum               km
   *    a           - semimajor axis                 km
   *    ecc         - eccentricity
   *    incl        - inclination                    0.0  to pi rad
   *    omega       - right ascension of ascending node    0.0  to 2pi rad
   *    argp        - argument of perigee            0.0  to 2pi rad
   *    nu          - true anomaly                   0.0  to 2pi rad
   *    m           - mean anomaly                   0.0  to 2pi rad
   *    arglat      - argument of latitude      (ci) 0.0  to 2pi rad
   *    truelon     - true longitude            (ce) 0.0  to 2pi rad
   *    lonper      - longitude of periapsis    (ee) 0.0  to 2pi rad
   *
   *  locals        :
   *    hbar        - angular momentum h vector      km2 / s
   *    ebar        - eccentricity     e vector
   *    nbar        - line of nodes    n vector
   *    c1          - v**2 - u/r
   *    rdotv       - r dot v
   *    hk          - hk unit vector
   *    sme         - specfic mechanical energy      km2 / s2
   *    i           - index
   *    e           - eccentric, parabolic,
   *                  hyperbolic anomaly             rad
   *    temp        - temporary variable
   *    typeorbit   - type of orbit                  ee, ei, ce, ci
   *
   *  coupling      :
   *    mag         - magnitude of a vector
   *    cross       - cross product of two vectors
   *    angle       - find the angle between two vectors
   *    newtonnu    - find the mean anomaly
   *
   *  references    :
   *    vallado       2013, 113, alg 9, ex 2-5
   * ---------------------------------------------------------------------------
   */
  static rv2coe(
    r: Vec3Flat,
    v: Vec3Flat,
    mus: number,
  ): {
    p: number;
    a: number;
    ecc: number;
    incl: number;
    omega: number;
    argp: number;
    nu: number;
    m: number;
    arglat: number;
    truelon: number;
    lonper: number;
  } {
    const nbar: Vec3Flat = [0, 0, 0];
    const ebar: Vec3Flat = [0, 0, 0];
    let p: number;
    let a: number;
    let ecc: number;
    let incl: number;
    let omega: number;
    let argp: number;
    let nu: number;
    let m = 0;
    let arglat: number;
    let truelon: number;
    let lonper: number;
    let rdotv: number;
    let magn: number;
    let hk: number;
    let sme: number;

    let i;

    /*
     *  Switch this to an integer msvs seems to have probelms with this and strncpy_s
     * char typeorbit[2];
     */
    let typeorbit;

    /*
     * Here
     * typeorbit = 1 = 'ei'
     * typeorbit = 2 = 'ce'
     * typeorbit = 3 = 'ci'
     * typeorbit = 4 = 'ee'
     */

    const halfpi = 0.5 * PI;
    const small = 0.00000001;
    const unknown = 999999.1; /** Ootk -- original undefined is illegal in JS */
    const infinite = 999999.9;

    // -------------------------  implementation   -----------------
    const magr = Sgp4.mag_(r);
    const magv = Sgp4.mag_(v);

    // ------------------  find h n and e vectors   ----------------
    const hbar = Sgp4.cross_(r, v);
    const magh = Sgp4.mag_(hbar);

    if (magh > small) {
      nbar[0] = -hbar[1];
      nbar[1] = hbar[0];
      nbar[2] = 0.0;
      magn = Sgp4.mag_(nbar);
      const c1 = magv * magv - mus / magr;

      rdotv = Sgp4.dot_(r, v);
      for (i = 0; i <= 2; i++) {
        ebar[i] = (c1 * r[i] - rdotv * v[i]) / mus;
      }
      ecc = Sgp4.mag_(ebar);

      // ------------  find a e and semi-latus rectum   ----------
      sme = magv * magv * 0.5 - mus / magr;
      if (Math.abs(sme) > small) {
        a = -mus / (2.0 * sme);
      } else {
        a = infinite;
      }
      p = (magh * magh) / mus;

      // -----------------  find inclination   -------------------
      hk = hbar[2] / magh;
      incl = Math.acos(hk);

      /*
       * --------  determine type of orbit for later use  --------
       * ------ elliptical, parabolic, hyperbolic inclined -------
       */
      typeorbit = 1;

      if (ecc < small) {
        // ----------------  circular equatorial ---------------
        if (incl < small || Math.abs(incl - PI) < small) {
          typeorbit = 2;
        } else {
          // --------------  circular inclined ---------------
          typeorbit = 3;
        }
      } else {
        // - elliptical, parabolic, hyperbolic equatorial --
        if (incl < small || Math.abs(incl - PI) < small) {
          typeorbit = 4;
        }
      }

      // ----------  find right ascension of the ascending node ------------
      if (magn > small) {
        let temp = nbar[0] / magn;

        if (Math.abs(temp) > 1.0) {
          temp = Sgp4.sgn_(temp);
        }
        omega = Math.acos(temp);
        if (nbar[1] < 0.0) {
          omega = TAU - omega;
        }
      } else {
        omega = unknown;
      }

      // ---------------- find argument of perigee ---------------
      if (typeorbit === 1) {
        argp = Sgp4.angle_(nbar, ebar);
        if (ebar[2] < 0.0) {
          argp = TAU - argp;
        }
      } else {
        argp = unknown;
      }

      // ------------  find true anomaly at epoch    -------------
      if (typeorbit === 1 || typeorbit === 4) {
        nu = Sgp4.angle_(ebar, r);
        if (rdotv < 0.0) {
          nu = TAU - nu;
        }
      } else {
        nu = unknown;
      }

      // ----  find argument of latitude - circular inclined -----
      if (typeorbit === 3) {
        arglat = Sgp4.angle_(nbar, r);
        if (r[2] < 0.0) {
          arglat = TAU - arglat;
        }
        m = arglat;
      } else {
        arglat = unknown;
      }

      if (ecc > small && typeorbit === 4) {
        let temp = ebar[0] / ecc;

        if (Math.abs(temp) > 1.0) {
          temp = Sgp4.sgn_(temp);
        }
        lonper = Math.acos(temp);
        if (ebar[1] < 0.0) {
          lonper = TAU - lonper;
        }
        if (incl > halfpi) {
          lonper = TAU - lonper;
        }
      } else {
        lonper = unknown;
      }

      // -------- find true longitude - circular equatorial ------
      if (magr > small && typeorbit === 2) {
        let temp = r[0] / magr;

        if (Math.abs(temp) > 1.0) {
          temp = Sgp4.sgn_(temp);
        }
        truelon = Math.acos(temp);
        if (r[1] < 0.0) {
          truelon = TAU - truelon;
        }
        if (incl > halfpi) {
          truelon = TAU - truelon;
        }
        m = truelon;
      } else {
        truelon = unknown;
      }

      // ------------ find mean anomaly for all orbits -----------
      if (typeorbit === 1 || typeorbit === 4) {
        m = Sgp4.newtonnu_(ecc, nu).m;
      }
    } else {
      p = unknown;
      a = unknown;
      ecc = unknown;
      incl = unknown;
      omega = unknown;
      argp = unknown;
      nu = unknown;
      m = unknown;
      arglat = unknown;
      truelon = unknown;
      lonper = unknown;
    }

    return {
      p,
      a,
      ecc,
      incl,
      omega,
      argp,
      nu,
      m,
      arglat,
      truelon,
      lonper,
    };
  }

  private static sgn_(x: number): number {
    if (x < 0.0) {
      return -1.0;
    }

    return 1.0;
  }

  // Newtonnu
  private static sinh_(x: number): number {
    return (Math.exp(x) - Math.exp(-x)) / 2;
  }

  /*
   * -----------------------------------------------------------------------------
   *
   *                           procedure dpper
   *
   *  this procedure provides deep space long period periodic contributions
   *    to the mean elements.  by design, these periodics are zero at epoch.
   *    this used to be dscom which included initialization, but it's really a
   *    recurring function.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    e3          -
   *    ee2         -
   *    peo         -
   *    pgho        -
   *    pho         -
   *    PInco       -
   *    plo         -
   *    se2 , se3 , sgh2, sgh3, sgh4, sh2, sh3, si2, si3, sl2, sl3, sl4 -
   *    t           -
   *    xh2, xh3, xi2, xi3, xl2, xl3, xl4 -
   *    zmol        -
   *    zmos        -
   *    ep          - eccentricity                           0.0 - 1.0
   *    inclo       - inclination - needed for lyddane modification
   *    nodep       - right ascension of ascending node
   *    argpp       - argument of perigee
   *    mp          - mean anomaly
   *
   *  outputs       :
   *    ep          - eccentricity                           0.0 - 1.0
   *    inclp       - inclination
   *    nodep        - right ascension of ascending node
   *    argpp       - argument of perigee
   *    mp          - mean anomaly
   *
   *  locals        :
   *    alfdp       -
   *    betdp       -
   *    cosip  , sinip  , cosop  , sinop  ,
   *    dalf        -
   *    dbet        -
   *    dls         -
   *    f2, f3      -
   *    pe          -
   *    pgh         -
   *    ph          -
   *    PInc        -
   *    pl          -
   *    sel   , ses   , sghl  , sghs  , shl   , shs   , sil   , sinzf , sis   ,
   *    sll   , sls
   *    xls         -
   *    xnoh        -
   *    zf          -
   *    zm          -
   *
   *  coupling      :
   *    none.
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   * ----------------------------------------------------------------------------
   */
  private static dpper_(
    satrec: SatelliteRecord,
    options: {
      ep: number;
      inclp: number;
      nodep: number;
      argpp: number;
      mp: number;
      opsmode: string;
      init: string;
    },
  ): { ep: number; inclp: number; nodep: number; argpp: number; mp: number } {
    const {
      e3,
      ee2,
      peo,
      pgho,
      pho,
      PInco,
      plo,
      se2,
      se3,
      sgh2,
      sgh3,
      sgh4,
      sh2,
      sh3,
      si2,
      si3,
      sl2,
      sl3,
      sl4,
      t,
      xgh2,
      xgh3,
      xgh4,
      xh2,
      xh3,
      xi2,
      xi3,
      xl2,
      xl3,
      xl4,
      zmol,
      zmos,
    } = satrec;

    let { ep, inclp, nodep, argpp, mp } = options;
    const { opsmode = 'i', init } = options;

    //  ---------------------- constants -----------------------------
    /** Ootk -- Some variables imported from outside the class at the top */
    const zns = 1.19459e-5;
    const zes = 0.01675;
    const znl = 1.5835218e-4;
    const zel = 0.0549;

    //  --------------- calculate time varying periodics -----------
    let zm = zmos + zns * t;
    // Be sure that the initial call has time set to zero

    if (init === 'y') {
      zm = zmos;
    }
    let zf = zm + 2.0 * zes * Math.sin(zm);
    let sinzf = Math.sin(zf);
    let f2 = 0.5 * sinzf * sinzf - 0.25;
    let f3 = -0.5 * sinzf * Math.cos(zf);
    const ses = se2 * f2 + se3 * f3;
    const sis = si2 * f2 + si3 * f3;
    const sls = sl2 * f2 + sl3 * f3 + sl4 * sinzf;
    const sghs = sgh2 * f2 + sgh3 * f3 + sgh4 * sinzf;
    const shs = sh2 * f2 + sh3 * f3;

    zm = zmol + znl * t;
    if (init === 'y') {
      zm = zmol;
    }
    zf = zm + 2.0 * zel * Math.sin(zm);
    sinzf = Math.sin(zf);
    f2 = 0.5 * sinzf * sinzf - 0.25;
    f3 = -0.5 * sinzf * Math.cos(zf);
    const sel = ee2 * f2 + e3 * f3;
    const sil = xi2 * f2 + xi3 * f3;
    const sll = xl2 * f2 + xl3 * f3 + xl4 * sinzf;
    const sghl = xgh2 * f2 + xgh3 * f3 + xgh4 * sinzf;
    const shll = xh2 * f2 + xh3 * f3;
    let pe = ses + sel;
    let PInc = sis + sil;
    let pl = sls + sll;
    let pgh = sghs + sghl;
    let ph = shs + shll;

    if (init === 'n') {
      pe -= peo;
      PInc -= PInco;
      pl -= plo;
      pgh -= pgho;
      ph -= pho;
      inclp += PInc;
      ep += pe;
      const sinip = Math.sin(inclp);
      const cosip = Math.cos(inclp);

      /* ----------------- apply periodics directly ------------ */
      /*
       * Sgp4fix for lyddane choice
       * strn3 used original inclination - this is technically feasible
       * gsfc used perturbed inclination - also technically feasible
       * probably best to readjust the 0.2 limit value and limit discontinuity
       * 0.2 rad = 11.45916 deg
       * use next line for original strn3 approach and original inclination
       * if (inclo >= 0.2)
       * use next line for gsfc version and perturbed inclination
       */
      if (inclp >= 0.2) {
        ph /= sinip;
        pgh -= cosip * ph;
        argpp += pgh;
        nodep += ph;
        mp += pl;
      } else {
        //  ---- apply periodics with lyddane modification ----
        const sinop = Math.sin(nodep);
        const cosop = Math.cos(nodep);
        let alfdp = sinip * sinop;
        let betdp = sinip * cosop;
        const dalf = ph * cosop + PInc * cosip * sinop;
        const dbet = -ph * sinop + PInc * cosip * cosop;

        alfdp += dalf;
        betdp += dbet;
        nodep %= TAU;

        /*
         *  Sgp4fix for afspc written intrinsic functions
         *  nodep used without a trigonometric function ahead
         */
        /* istanbul ignore next */
        if (nodep < 0.0 && opsmode === 'a') {
          nodep += TAU;
        }
        let xls = mp + argpp + cosip * nodep;
        const dls = pl + pgh - PInc * nodep * sinip;

        xls += dls;
        const xnoh = nodep;

        nodep = Math.atan2(alfdp, betdp);

        /*
         *  Sgp4fix for afspc written intrinsic functions
         *  nodep used without a trigonometric function ahead
         */
        /* istanbul ignore next */
        if (nodep < 0.0 && opsmode === 'a') {
          nodep += TAU;
        }
        if (Math.abs(xnoh - nodep) > PI) {
          /* istanbul ignore next */
          if (nodep < xnoh) {
            nodep += TAU;
          } else {
            nodep -= TAU;
          }
        }
        mp += pl;
        argpp = xls - mp - cosip * nodep;
      }
    } // If init == 'n'

    return {
      ep,
      inclp,
      nodep,
      argpp,
      mp,
    };
  }

  // Dpper

  /*
   *-----------------------------------------------------------------------------
   *
   *                           procedure dscom
   *
   *  this procedure provides deep space common items used by both the secular
   *    and periodics subroutines.  input is provided as shown. this routine
   *    used to be called dpper, but the functions inside weren't well organized.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    epoch       -
   *    ep          - eccentricity
   *    argpp       - argument of perigee
   *    tc          -
   *    inclp       - inclination
   *    nodep       - right ascension of ascending node
   *    np          - mean motion
   *
   *  outputs       :
   *    sinim  , cosim  , sinomm , cosomm , snodm  , cnodm
   *    day         -
   *    e3          -
   *    ee2         -
   *    em          - eccentricity
   *    emsq        - eccentricity squared
   *    gam         -
   *    peo         -
   *    pgho        -
   *    pho         -
   *    PInco       -
   *    plo         -
   *    rtemsq      -
   *    se2, se3         -
   *    sgh2, sgh3, sgh4        -
   *    sh2, sh3, si2, si3, sl2, sl3, sl4         -
   *    s1, s2, s3, s4, s5, s6, s7          -
   *    ss1, ss2, ss3, ss4, ss5, ss6, ss7, sz1, sz2, sz3         -
   *    sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33        -
   *    xgh2, xgh3, xgh4, xh2, xh3, xi2, xi3, xl2, xl3, xl4         -
   *    nm          - mean motion
   *    z1, z2, z3, z11, z12, z13, z21, z22, z23, z31, z32, z33         -
   *    zmol        -
   *    zmos        -
   *
   *  locals        :
   *    a1, a2, a3, a4, a5, a6, a7, a8, a9, a10         -
   *    betasq      -
   *    cc          -
   *    ctem, stem        -
   *    x1, x2, x3, x4, x5, x6, x7, x8          -
   *    xnodce      -
   *    xnoi        -
   *    zcosg  , zsing  , zcosgl , zsingl , zcosh  , zsinh  , zcoshl , zsinhl ,
   *    zcosi  , zsini  , zcosil , zsinil ,
   *    zx          -
   *    zy          -
   *
   *  coupling      :
   *    none.
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  private static dscom_(options: {
    epoch: number;
    ep: number;
    argpp: number;
    tc: number;
    inclp: number;
    nodep: number;
    np: number;
  }): {
    snodm: number;
    cnodm: number;
    sinim: number;
    cosim: number;
    sinomm: number;
    cosomm: number;
    day: number;
    e3: number;
    ee2: number;
    em: number;
    emsq: number;
    gam: number;
    peo: number;
    pgho: number;
    pho: number;
    PInco: number;
    plo: number;
    rtemsq: number;
    se2: number;
    se3: number;
    sgh2: number;
    sgh3: number;
    sgh4: number;
    sh2: number;
    sh3: number;
    si2: number;
    si3: number;
    sl2: number;
    sl3: number;
    sl4: number;
    s1?: number;
    s2?: number;
    s3?: number;
    s4?: number;
    s5?: number;
    s6?: number;
    s7?: number;
    ss1?: number;
    ss2?: number;
    ss3?: number;
    ss4?: number;
    ss5?: number;
    ss6?: number;
    ss7?: number;
    sz1?: number;
    sz2?: number;
    sz3?: number;
    sz11?: number;
    sz12?: number;
    sz13?: number;
    sz21?: number;
    sz22?: number;
    sz23?: number;
    sz31?: number;
    sz32?: number;
    sz33?: number;
    xgh2: number;
    xgh3: number;
    xgh4: number;
    xh2: number;
    xh3: number;
    xi2: number;
    xi3: number;
    xl2: number;
    xl3: number;
    xl4: number;
    nm: number;
    z1?: number;
    z2?: number;
    z3?: number;
    z11?: number;
    z12?: number;
    z13?: number;
    z21?: number;
    z22?: number;
    z23?: number;
    z31?: number;
    z32?: number;
    z33?: number;
    zmol: number;
    zmos: number;
  } {
    const { epoch, ep, argpp, tc, inclp, nodep, np } = options;

    // -------------------------- constants -------------------------
    /** Ootk -- Some variables imported from outside the class at the top */
    const zes = 0.01675;
    const zel = 0.0549;
    const c1ss = 2.9864797e-6;
    const c1l = 4.7968065e-7;
    const zsinis = 0.39785416;
    const zcosis = 0.91744867;
    const zcosgs = 0.1945905;
    const zsings = -0.98088458;
    const TAU = 2.0 * Math.PI;

    //  --------------------- local variables ------------------------
    let s1 = 0,
      s2 = 0,
      s3 = 0,
      s4 = 0,
      s5 = 0,
      s6 = 0,
      s7 = 0,
      ss1 = 0,
      ss2 = 0,
      ss3 = 0,
      ss4 = 0,
      ss5 = 0,
      ss6 = 0,
      ss7 = 0,
      sz1 = 0,
      sz11 = 0,
      sz12 = 0,
      sz13 = 0,
      sz2 = 0,
      sz21 = 0,
      sz22 = 0,
      sz23 = 0,
      sz3 = 0,
      sz31 = 0,
      sz32 = 0,
      sz33 = 0,
      z1 = 0,
      z11 = 0,
      z12 = 0,
      z13 = 0,
      z2 = 0,
      z21 = 0,
      z22 = 0,
      z23 = 0,
      z3 = 0,
      z31 = 0,
      z32 = 0,
      z33 = 0;
    const nm = np;
    const em = ep;
    const snodm = Math.sin(nodep);
    const cnodm = Math.cos(nodep);
    const sinomm = Math.sin(argpp);
    const cosomm = Math.cos(argpp);
    const sinim = Math.sin(inclp);
    const cosim = Math.cos(inclp);
    const emsq = em * em;
    const betasq = 1.0 - emsq;
    const rtemsq = Math.sqrt(betasq);

    //  ----------------- initialize lunar solar terms ---------------
    const peo = 0.0;
    const PInco = 0.0;
    const plo = 0.0;
    const pgho = 0.0;
    const pho = 0.0;
    const day = epoch + 18261.5 + tc / 1440.0;
    const xnodce = (4.523602 - 9.2422029e-4 * day) % TAU;
    const stem = Math.sin(xnodce);
    const ctem = Math.cos(xnodce);
    const zcosil = 0.91375164 - 0.03568096 * ctem;
    const zsinil = Math.sqrt(1.0 - zcosil * zcosil);
    const zsinhl = (0.089683511 * stem) / zsinil;
    const zcoshl = Math.sqrt(1.0 - zsinhl * zsinhl);
    const gam = 5.8351514 + 0.001944368 * day;
    let zx = (0.39785416 * stem) / zsinil;
    const zy = zcoshl * ctem + 0.91744867 * zsinhl * stem;

    zx = Math.atan2(zx, zy);
    zx += gam - xnodce;
    const zcosgl = Math.cos(zx);
    const zsingl = Math.sin(zx);

    //  ------------------------- do solar terms ---------------------
    let zcosg = zcosgs;
    let zsing = zsings;
    let zcosi = zcosis;
    let zsini = zsinis;
    let zcosh = cnodm;
    let zsinh = snodm;
    let cc = c1ss;
    const xnoi = 1.0 / nm;

    for (let lsflg = 1; lsflg <= 2; lsflg++) {
      const a1 = zcosg * zcosh + zsing * zcosi * zsinh;
      const a3 = -zsing * zcosh + zcosg * zcosi * zsinh;
      const a7 = -zcosg * zsinh + zsing * zcosi * zcosh;
      const a8 = zsing * zsini;
      const a9 = zsing * zsinh + zcosg * zcosi * zcosh;
      const a10 = zcosg * zsini;
      const a2 = cosim * a7 + sinim * a8;
      const a4 = cosim * a9 + sinim * a10;
      const a5 = -sinim * a7 + cosim * a8;
      const a6 = -sinim * a9 + cosim * a10;

      const x1 = a1 * cosomm + a2 * sinomm;
      const x2 = a3 * cosomm + a4 * sinomm;
      const x3 = -a1 * sinomm + a2 * cosomm;
      const x4 = -a3 * sinomm + a4 * cosomm;
      const x5 = a5 * sinomm;
      const x6 = a6 * sinomm;
      const x7 = a5 * cosomm;
      const x8 = a6 * cosomm;

      z31 = 12.0 * x1 * x1 - 3.0 * x3 * x3;
      z32 = 24.0 * x1 * x2 - 6.0 * x3 * x4;
      z33 = 12.0 * x2 * x2 - 3.0 * x4 * x4;

      z1 = 3.0 * (a1 * a1 + a2 * a2) + z31 * emsq;
      z2 = 6.0 * (a1 * a3 + a2 * a4) + z32 * emsq;
      z3 = 3.0 * (a3 * a3 + a4 * a4) + z33 * emsq;

      z11 = -6.0 * a1 * a5 + emsq * (-24.0 * x1 * x7 - 6.0 * x3 * x5);
      z12 = -6.0 * (a1 * a6 + a3 * a5) + emsq * (-24.0 * (x2 * x7 + x1 * x8) + -6.0 * (x3 * x6 + x4 * x5));

      z13 = -6.0 * a3 * a6 + emsq * (-24.0 * x2 * x8 - 6.0 * x4 * x6);

      z21 = 6.0 * a2 * a5 + emsq * (24.0 * x1 * x5 - 6.0 * x3 * x7);
      z22 = 6.0 * (a4 * a5 + a2 * a6) + emsq * (24.0 * (x2 * x5 + x1 * x6) - 6.0 * (x4 * x7 + x3 * x8));
      z23 = 6.0 * a4 * a6 + emsq * (24.0 * x2 * x6 - 6.0 * x4 * x8);

      z1 = z1 + z1 + betasq * z31;
      z2 = z2 + z2 + betasq * z32;
      z3 = z3 + z3 + betasq * z33;
      s3 = cc * xnoi;
      s2 = (-0.5 * s3) / rtemsq;
      s4 = s3 * rtemsq;
      s1 = -15.0 * em * s4;
      s5 = x1 * x3 + x2 * x4;
      s6 = x2 * x3 + x1 * x4;
      s7 = x2 * x4 - x1 * x3;

      //  ----------------------- do lunar terms -------------------
      if (lsflg === 1) {
        ss1 = s1;
        ss2 = s2;
        ss3 = s3;
        ss4 = s4;
        ss5 = s5;
        ss6 = s6;
        ss7 = s7;
        sz1 = z1;
        sz2 = z2;
        sz3 = z3;
        sz11 = z11;
        sz12 = z12;
        sz13 = z13;
        sz21 = z21;
        sz22 = z22;
        sz23 = z23;
        sz31 = z31;
        sz32 = z32;
        sz33 = z33;
        zcosg = zcosgl;
        zsing = zsingl;
        zcosi = zcosil;
        zsini = zsinil;
        zcosh = zcoshl * cnodm + zsinhl * snodm;
        zsinh = snodm * zcoshl - cnodm * zsinhl;
        cc = c1l;
      }
    }

    const zmol = (4.7199672 + (0.2299715 * day - gam)) % TAU;
    const zmos = (6.2565837 + 0.017201977 * day) % TAU;

    //  ------------------------ do solar terms ----------------------
    const se2 = 2.0 * ss1 * ss6;
    const se3 = 2.0 * ss1 * ss7;
    const si2 = 2.0 * ss2 * sz12;
    const si3 = 2.0 * ss2 * (sz13 - sz11);
    const sl2 = -2.0 * ss3 * sz2;
    const sl3 = -2.0 * ss3 * (sz3 - sz1);
    const sl4 = -2.0 * ss3 * (-21.0 - 9.0 * emsq) * zes;
    const sgh2 = 2.0 * ss4 * sz32;
    const sgh3 = 2.0 * ss4 * (sz33 - sz31);
    const sgh4 = -18.0 * ss4 * zes;
    const sh2 = -2.0 * ss2 * sz22;
    const sh3 = -2.0 * ss2 * (sz23 - sz21);

    //  ------------------------ do lunar terms ----------------------
    const ee2 = 2.0 * s1 * s6;
    const e3 = 2.0 * s1 * s7;
    const xi2 = 2.0 * s2 * z12;
    const xi3 = 2.0 * s2 * (z13 - z11);
    const xl2 = -2.0 * s3 * z2;
    const xl3 = -2.0 * s3 * (z3 - z1);
    const xl4 = -2.0 * s3 * (-21.0 - 9.0 * emsq) * zel;
    const xgh2 = 2.0 * s4 * z32;
    const xgh3 = 2.0 * s4 * (z33 - z31);
    const xgh4 = -18.0 * s4 * zel;
    const xh2 = -2.0 * s2 * z22;
    const xh3 = -2.0 * s2 * (z23 - z21);

    return {
      snodm,
      cnodm,
      sinim,
      cosim,
      sinomm,
      cosomm,
      day,
      e3,
      ee2,
      em,
      emsq,
      gam,
      peo,
      pgho,
      pho,
      PInco,
      plo,
      rtemsq,
      se2,
      se3,
      sgh2,
      sgh3,
      sgh4,
      sh2,
      sh3,
      si2,
      si3,
      sl2,
      sl3,
      sl4,
      s1,
      s2,
      s3,
      s4,
      s5,
      s6,
      s7,
      ss1,
      ss2,
      ss3,
      ss4,
      ss5,
      ss6,
      ss7,
      sz1,
      sz2,
      sz3,
      sz11,
      sz12,
      sz13,
      sz21,
      sz22,
      sz23,
      sz31,
      sz32,
      sz33,
      xgh2,
      xgh3,
      xgh4,
      xh2,
      xh3,
      xi2,
      xi3,
      xl2,
      xl3,
      xl4,
      nm,
      z1,
      z2,
      z3,
      z11,
      z12,
      z13,
      z21,
      z22,
      z23,
      z31,
      z32,
      z33,
      zmol,
      zmos,
    };
  }

  // Dscom

  /*
   *-----------------------------------------------------------------------------
   *
   *                           procedure dsinit
   *
   *  this procedure provides deep space contributions to mean motion dot due
   *    to geopotential resonance with half day and one day orbits.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    cosim, sinim-
   *    emsq        - eccentricity squared
   *    argpo       - argument of perigee
   *    s1, s2, s3, s4, s5      -
   *    ss1, ss2, ss3, ss4, ss5 -
   *    sz1, sz3, sz11, sz13, sz21, sz23, sz31, sz33 -
   *    t           - time
   *    tc          -
   *    gsto        - greenwich sidereal time                   rad
   *    mo          - mean anomaly
   *    mdot        - mean anomaly dot (rate)
   *    no          - mean motion
   *    nodeo       - right ascension of ascending node
   *    nodedot     - right ascension of ascending node dot (rate)
   *    xPIdot      -
   *    z1, z3, z11, z13, z21, z23, z31, z33 -
   *    eccm        - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    xn          - mean motion
   *    nodem       - right ascension of ascending node
   *
   *  outputs       :
   *    em          - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    nodem       - right ascension of ascending node
   *    irez        - flag for resonance           0-none, 1-one day, 2-half day
   *    atime       -
   *    d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433    -
   *    dedt        -
   *    didt        -
   *    dmdt        -
   *    dndt        -
   *    dnodt       -
   *    domdt       -
   *    del1, del2, del3        -
   *    ses  , sghl , sghs , sgs  , shl  , shs  , sis  , sls
   *    theta       -
   *    xfact       -
   *    xlamo       -
   *    xli         -
   *    xni
   *
   *  locals        :
   *    ainv2       -
   *    aonv        -
   *    cosisq      -
   *    eoc         -
   *    f220, f221, f311, f321, f322, f330, f441, f442, f522, f523, f542, f543  -
   *    g200, g201, g211, g300, g310, g322, g410, g422, g520, g521, g532, g533  -
   *    sini2       -
   *    temp        -
   *    temp1       -
   *    theta       -
   *    xno2        -
   *
   *  coupling      :
   *    getgravconst
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  private static dsinit_(options: DsInitParams): {
    em: number;
    argpm: number;
    inclm: number;
    mm: number;
    nm: number;
    nodem: number;
    irez: number;
    atime: number;
    d2201: number;
    d2211: number;
    d3210: number;
    d3222: number;
    d4410: number;
    d4422: number;
    d5220: number;
    d5232: number;
    d5421: number;
    d5433: number;
    dedt: number;
    didt: number;
    dmdt: number;
    dndt: number;
    dnodt: number;
    domdt: number;
    del1: number;
    del2: number;
    del3: number;
    xfact: number;
    xlamo: number;
    xli: number;
    xni: number;
  } {
    /*
     * Sgp4fix just send in xke as a constant and eliminate getgravconst call
     * gravconsttype whichconst,
     */
    const {
      xke,
      cosim,
      argpo,
      s1,
      s2,
      s3,
      s4,
      s5,
      sinim,
      ss1,
      ss2,
      ss3,
      ss4,
      ss5,
      sz1,
      sz3,
      sz11,
      sz13,
      sz21,
      sz23,
      sz31,
      sz33,
      t,
      tc,
      gsto,
      mo,
      mdot,
      no,
      nodeo,
      nodedot,
      xPIdot,
      z1,
      z3,
      z11,
      z13,
      z21,
      z23,
      z31,
      z33,
      ecco,
      eccsq,
    } = options;

    let {
      emsq,
      em,
      argpm,
      inclm,
      mm,
      nm,
      nodem,
      irez,
      atime,
      d2201,
      d2211,
      d3210,
      d3222,
      d4410,
      d4422,
      d5220,
      d5232,
      d5421,
      d5433,
      dedt,
      didt,
      dmdt,
      dnodt,
      domdt,
      del1,
      del2,
      del3,
      xfact,
      xlamo,
      xli,
      xni,
    } = options;

    /* --------------------- local variables ------------------------ */
    /** Ootk -- Some variables imported from outside the class at the top */
    const q22 = 1.7891679e-6;
    const q31 = 2.1460748e-6;
    const q33 = 2.2123015e-7;
    const root22 = 1.7891679e-6;
    const root44 = 7.3636953e-9;
    const root54 = 2.1765803e-9;
    // IDEA: Any way to fix this?
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    const rptim = 4.37526908801129966e-3; // Equates to 7.29211514668855e-5 rad/sec
    const root32 = 3.7393792e-7;
    const root52 = 1.1428639e-7;
    const x2o3 = 2.0 / 3.0;
    const znl = 1.5835218e-4;
    const zns = 1.19459e-5;

    /*
     * Sgp4fix identify constants and allow alternate values
     * just xke is used here so pass it in rather than have multiple calls
     * getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
     */

    // -------------------- deep space initialization ------------
    irez = 0;
    if (nm < 0.0052359877 && nm > 0.0034906585) {
      irez = 1;
    }
    if (nm >= 8.26e-3 && nm <= 9.24e-3 && em >= 0.5) {
      irez = 2;
    }

    // ------------------------ do solar terms -------------------
    const ses = ss1 * zns * ss5;
    const sis = ss2 * zns * (sz11 + sz13);
    const sls = -zns * ss3 * (sz1 + sz3 - 14.0 - 6.0 * emsq);
    const sghs = ss4 * zns * (sz31 + sz33 - 6.0);
    let shs = -zns * ss2 * (sz21 + sz23);

    // Sgp4fix for 180 deg incl
    if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) {
      shs = 0.0;
    }
    if (sinim !== 0.0) {
      shs /= sinim;
    }
    const sgs = sghs - cosim * shs;

    // ------------------------- do lunar terms ------------------
    dedt = ses + s1 * znl * s5;
    didt = sis + s2 * znl * (z11 + z13);
    dmdt = sls - znl * s3 * (z1 + z3 - 14.0 - 6.0 * emsq);
    const sghl = s4 * znl * (z31 + z33 - 6.0);
    let shll = -znl * s2 * (z21 + z23);

    // Sgp4fix for 180 deg incl
    if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) {
      shll = 0.0;
    }
    domdt = sgs + sghl;
    dnodt = shs;
    if (sinim !== 0.0) {
      domdt -= (cosim / sinim) * shll;
      dnodt += shll / sinim;
    }

    // ----------- calculate deep space resonance effects --------
    const dndt = 0.0;
    const theta = (gsto + tc * rptim) % TAU;

    em += dedt * t;
    inclm += didt * t;
    argpm += domdt * t;
    nodem += dnodt * t;
    mm += dmdt * t;

    /*
     * Sgp4fix for negative inclinations
     * the following if statement should be commented out
     * if (inclm < 0.0)
     * {
     *   inclm  = -inclm;
     *   argpm  = argpm - PI;
     *   nodem = nodem + PI;
     * }
     */

    // -------------- initialize the resonance terms -------------
    if (irez !== 0) {
      const aonv = (nm / xke) ** x2o3;

      // ---------- geopotential resonance for 12 hour orbits ------
      if (irez === 2) {
        const cosisq = cosim * cosim;
        const emo = em;

        em = ecco;
        const emsqo = emsq;

        emsq = eccsq;
        const eoc = em * emsq;
        const g201 = -0.306 - (em - 0.64) * 0.44;

        let g211, g310, g322, g410, g422, g520, g521, g532, g533;

        if (em <= 0.65) {
          g211 = 3.616 - 13.247 * em + 16.29 * emsq;
          g310 = -19.302 + 117.39 * em - 228.419 * emsq + 156.591 * eoc;
          g322 = -18.9068 + 109.7927 * em - 214.6334 * emsq + 146.5816 * eoc;
          g410 = -41.122 + 242.694 * em - 471.094 * emsq + 313.953 * eoc;
          g422 = -146.407 + 841.88 * em - 1629.014 * emsq + 1083.435 * eoc;
          g520 = -532.114 + 3017.977 * em - 5740.032 * emsq + 3708.276 * eoc;
        } else {
          g211 = -72.099 + 331.819 * em - 508.738 * emsq + 266.724 * eoc;
          g310 = -346.844 + 1582.851 * em - 2415.925 * emsq + 1246.113 * eoc;
          g322 = -342.585 + 1554.908 * em - 2366.899 * emsq + 1215.972 * eoc;
          g410 = -1052.797 + 4758.686 * em - 7193.992 * emsq + 3651.957 * eoc;
          g422 = -3581.69 + 16178.11 * em - 24462.77 * emsq + 12422.52 * eoc;
          if (em > 0.715) {
            g520 = -5149.66 + 29936.92 * em - 54087.36 * emsq + 31324.56 * eoc;
          } else {
            g520 = 1464.74 - 4664.75 * em + 3763.64 * emsq;
          }
        }
        if (em < 0.7) {
          g533 = -919.2277 + 4988.61 * em - 9064.77 * emsq + 5542.21 * eoc;
          g521 = -822.71072 + 4568.6173 * em - 8491.4146 * emsq + 5337.524 * eoc;
          g532 = -853.666 + 4690.25 * em - 8624.77 * emsq + 5341.4 * eoc;
        } else {
          g533 = -37995.78 + 161616.52 * em - 229838.2 * emsq + 109377.94 * eoc;
          g521 = -51752.104 + 218913.95 * em - 309468.16 * emsq + 146349.42 * eoc;
          g532 = -40023.88 + 170470.89 * em - 242699.48 * emsq + 115605.82 * eoc;
        }
        const sini2 = sinim * sinim;
        const f220 = 0.75 * (1.0 + 2.0 * cosim + cosisq);
        const f221 = 1.5 * sini2;
        const f321 = 1.875 * sinim * (1.0 - 2.0 * cosim - 3.0 * cosisq);
        const f322 = -1.875 * sinim * (1.0 + 2.0 * cosim - 3.0 * cosisq);
        const f441 = 35.0 * sini2 * f220;
        const f442 = 39.375 * sini2 * sini2;

        const f522 =
          9.84375 *
          sinim *
          (sini2 * (1.0 - 2.0 * cosim - 5.0 * cosisq) + 0.33333333 * (-2.0 + 4.0 * cosim + 6.0 * cosisq));
        const f523 =
          sinim *
          (4.92187512 * sini2 * (-2.0 - 4.0 * cosim + 10.0 * cosisq) + 6.56250012 * (1.0 + 2.0 * cosim - 3.0 * cosisq));
        const f542 = 29.53125 * sinim * (2.0 - 8.0 * cosim + cosisq * (-12.0 + 8.0 * cosim + 10.0 * cosisq));
        const f543 = 29.53125 * sinim * (-2.0 - 8.0 * cosim + cosisq * (12.0 + 8.0 * cosim - 10.0 * cosisq));

        const xno2 = nm * nm;
        const ainv2 = aonv * aonv;
        let temp1 = 3.0 * xno2 * ainv2;
        let temp = temp1 * root22;

        d2201 = temp * f220 * g201;
        d2211 = temp * f221 * g211;
        temp1 *= aonv;
        temp = temp1 * root32;
        d3210 = temp * f321 * g310;
        d3222 = temp * f322 * g322;
        temp1 *= aonv;
        temp = 2.0 * temp1 * root44;
        d4410 = temp * f441 * g410;
        d4422 = temp * f442 * g422;
        temp1 *= aonv;
        temp = temp1 * root52;
        d5220 = temp * f522 * g520;
        d5232 = temp * f523 * g532;
        temp = 2.0 * temp1 * root54;
        d5421 = temp * f542 * g521;
        d5433 = temp * f543 * g533;
        xlamo = (mo + nodeo + nodeo - (theta + theta)) % TAU;
        xfact = mdot + dmdt + 2.0 * (nodedot + dnodt - rptim) - no;
        em = emo;
        emsq = emsqo;
      }

      //  ---------------- synchronous resonance terms --------------
      if (irez === 1) {
        const g200 = 1.0 + emsq * (-2.5 + 0.8125 * emsq);
        const g310 = 1.0 + 2.0 * emsq;
        const g300 = 1.0 + emsq * (-6.0 + 6.60937 * emsq);
        const f220 = 0.75 * (1.0 + cosim) * (1.0 + cosim);
        const f311 = 0.9375 * sinim * sinim * (1.0 + 3.0 * cosim) - 0.75 * (1.0 + cosim);
        let f330 = 1.0 + cosim;

        f330 *= 1.875 * f330 * f330;
        del1 = 3.0 * nm * nm * aonv * aonv;
        del2 = 2.0 * del1 * f220 * g200 * q22;
        del3 = 3.0 * del1 * f330 * g300 * q33 * aonv;
        del1 = del1 * f311 * g310 * q31 * aonv;
        xlamo = (mo + nodeo + argpo - theta) % TAU;
        xfact = mdot + xPIdot + dmdt + domdt + dnodt - (no + rptim);
      }

      //  ------------ for sgp4, initialize the integrator ----------
      xli = xlamo;
      xni = no;
      atime = 0.0;
      nm = no + dndt;
    }

    return {
      em,
      argpm,
      inclm,
      mm,
      nm,
      nodem,
      irez,
      atime,
      d2201,
      d2211,
      d3210,
      d3222,
      d4410,
      d4422,
      d5220,
      d5232,
      d5421,
      d5433,
      dedt,
      didt,
      dmdt,
      dndt,
      dnodt,
      domdt,
      del1,
      del2,
      del3,
      xfact,
      xlamo,
      xli,
      xni,
    };
  }

  // Dsinit

  /*
   *-----------------------------------------------------------------------------
   *
   *                           procedure dspace
   *
   *  this procedure provides deep space contributions to mean elements for
   *    perturbing third body.  these effects have been averaged over one
   *    revolution of the sun and moon.  for earth resonance effects, the
   *    effects have been averaged over no revolutions of the satellite.
   *    (mean motion)
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433 -
   *    dedt        -
   *    del1, del2, del3  -
   *    didt        -
   *    dmdt        -
   *    dnodt       -
   *    domdt       -
   *    irez        - flag for resonance           0-none, 1-one day, 2-half day
   *    argpo       - argument of perigee
   *    argpdot     - argument of perigee dot (rate)
   *    t           - time
   *    tc          -
   *    gsto        - gst
   *    xfact       -
   *    xlamo       -
   *    no          - mean motion
   *    atime       -
   *    em          - eccentricity
   *    ft          -
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    xli         -
   *    mm          - mean anomaly
   *    xni         - mean motion
   *    nodem       - right ascension of ascending node
   *
   *  outputs       :
   *    atime       -
   *    em          - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    xli         -
   *    mm          - mean anomaly
   *    xni         -
   *    nodem       - right ascension of ascending node
   *    dndt        -
   *    nm          - mean motion
   *
   *  locals        :
   *    delt        -
   *    ft          -
   *    theta       -
   *    x2li        -
   *    x2omi       -
   *    xl          -
   *    xldot       -
   *    xnddt       -
   *    xndt        -
   *    xomi        -
   *
   *  coupling      :
   *    none        -
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  private static dspace_(
    irez: number,
    d2201: number,
    d2211: number,
    d3210: number,
    d3222: number,
    d4410: number,
    d4422: number,
    d5220: number,
    d5232: number,
    d5421: number,
    d5433: number,
    dedt: number,
    del1: number,
    del2: number,
    del3: number,
    didt: number,
    dmdt: number,
    dnodt: number,
    domdt: number,
    argpo: number,
    argpdot: number,
    t: number,
    tc: number,
    gsto: number,
    xfact: number,
    xlamo: number,
    no: number,
    atime: number,
    em: number,
    argpm: number,
    inclm: number,
    xli: number,
    mm: number,
    xni: number,
    nodem: number,
    nm: number,
  ): [em: number, argpm: number, inclm: number, mm: number, nodem: number, nm: number] {
    /** Ootk -- Some variables imported from outside the class at the top */
    const fasx2 = 0.13130908;
    const fasx4 = 2.8843198;
    const fasx6 = 0.37448087;
    const g22 = 5.7686396;
    const g32 = 0.95240898;
    const g44 = 1.8014998;
    const g52 = 1.050833;
    const g54 = 4.4108898;
    // IDEA: Any way to fix this?
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    const rptim = 4.37526908801129966e-3; // Equates to 7.29211514668855e-5 rad/sec
    const stepp = 720.0;
    const stepn = -720.0;
    const step2 = 259200.0;

    //  ----------- calculate deep space resonance effects -----------
    let dndt = 0.0;
    const theta = (gsto + tc * rptim) % TAU;

    em += dedt * t;

    inclm += didt * t;
    argpm += domdt * t;
    nodem += dnodt * t;
    mm += dmdt * t;

    /*
     * Sgp4fix for negative inclinations
     * the following if statement should be commented out
     * if (inclm < 0.0)
     * {
     *   inclm = -inclm;
     *   argpm = argpm - PI;
     *   nodem = nodem + PI;
     * }
     */

    /* - update resonances : numerical (euler-maclaurin) integration - */
    /* ------------------------- epoch restart ----------------------  */
    /*
     *   Sgp4fix for propagator problems
     *   the following integration works for negative time steps and periods
     *   the specific changes are unknown because the original code was so convoluted
     */

    // Sgp4fix take out atime = 0.0 and fix for faster operation
    // Ft = 0.0; /** Ootk -- This has no value */
    if (irez !== 0) {
      //  Sgp4fix streamline check
      if (atime === 0.0 || t * atime <= 0.0 || Math.abs(t) < Math.abs(atime)) {
        atime = 0.0;
        xni = no;
        xli = xlamo;
      }

      // Sgp4fix move check outside loop
      let delt;

      if (t > 0.0) {
        delt = stepp;
      } else {
        delt = stepn;
      }

      let ft = 0;
      let x2li = 0;
      let x2omi = 0;
      let xldot = 0;
      let xnddt = 0;
      let xndt = 0;
      let xomi = 0;
      let iretn = 381; // Added for do loop

      while (iretn === 381) {
        /*
         *  ------------------- dot terms calculated -------------
         *  ----------- near - synchronous resonance terms -------
         */
        if (irez !== 2) {
          xndt =
            del1 * Math.sin(xli - fasx2) + del2 * Math.sin(2.0 * (xli - fasx4)) + del3 * Math.sin(3.0 * (xli - fasx6));
          xldot = xni + xfact;
          xnddt =
            del1 * Math.cos(xli - fasx2) +
            2.0 * del2 * Math.cos(2.0 * (xli - fasx4)) +
            3.0 * del3 * Math.cos(3.0 * (xli - fasx6));
          xnddt *= xldot;
        } else {
          // --------- near - half-day resonance terms --------
          xomi = argpo + argpdot * atime;
          x2omi = xomi + xomi;
          x2li = xli + xli;
          xndt =
            d2201 * Math.sin(x2omi + xli - g22) +
            d2211 * Math.sin(xli - g22) +
            d3210 * Math.sin(xomi + xli - g32) +
            d3222 * Math.sin(-xomi + xli - g32) +
            d4410 * Math.sin(x2omi + x2li - g44) +
            d4422 * Math.sin(x2li - g44) +
            d5220 * Math.sin(xomi + xli - g52) +
            d5232 * Math.sin(-xomi + xli - g52) +
            d5421 * Math.sin(xomi + x2li - g54) +
            d5433 * Math.sin(-xomi + x2li - g54);
          xldot = xni + xfact;
          xnddt =
            d2201 * Math.cos(x2omi + xli - g22) +
            d2211 * Math.cos(xli - g22) +
            d3210 * Math.cos(xomi + xli - g32) +
            d3222 * Math.cos(-xomi + xli - g32) +
            d5220 * Math.cos(xomi + xli - g52) +
            d5232 * Math.cos(-xomi + xli - g52) +
            2.0 *
              (d4410 * Math.cos(x2omi + x2li - g44) +
                d4422 * Math.cos(x2li - g44) +
                d5421 * Math.cos(xomi + x2li - g54) +
                d5433 * Math.cos(-xomi + x2li - g54));
          xnddt *= xldot;
        }

        /*
         *  ----------------------- integrator -------------------
         *  sgp4fix move end checks to end of routine
         */
        if (Math.abs(t - atime) >= stepp) {
          // Iret = 0; /** Ootk -- This has no value */
          iretn = 381;
        } else {
          ft = t - atime;
          iretn = 0;
        }

        if (iretn === 381) {
          xli += xldot * delt + xndt * step2;
          xni += xndt * delt + xnddt * step2;
          atime += delt;
        }
      } // While iretn = 381

      nm = xni + xndt * ft + xnddt * ft * ft * 0.5;
      const xl = xli + xldot * ft + xndt * ft * ft * 0.5;

      if (irez !== 1) {
        mm = xl - 2.0 * nodem + 2.0 * theta;
        dndt = nm - no;
      } else {
        mm = xl - nodem - argpm + theta;
        dndt = nm - no;
      }
      nm = no + dndt;
    }

    return [em, argpm, inclm, mm, nodem, nm];
  }

  /*
   * -----------------------------------------------------------------------------
   *
   *                           function getgravconst
   *
   *  this function gets constants for the propagator. note that mu is identified to
   *    facilitiate comparisons with newer models. the common useage is wgs72.
   *
   *  author        : david vallado                  719-573-2600   21 jul 2006
   *
   *  inputs        :
   *    whichconst  - which set of constants to use  wgs72old, wgs72, wgs84
   *
   *  outputs       :
   *    tumin       - minutes in one time unit
   *    mu          - earth gravitational parameter
   *    radiusearthkm - radius of the earth in km
   *    xke         - reciprocal of tumin
   *    j2, j3, j4  - un-normalized zonal harmonic values
   *    j3oj2       - j3 divided by j2
   *
   *  locals        :
   *
   *  coupling      :
   *    none
   *
   *  references    :
   *    norad spacetrack report #3
   *    vallado, crawford, hujsak, kelso  2006
   * ---------------------------------------------------------------------------
   */
  private static getgravconst_(whichconst: Sgp4GravConstants): {
    tumin: number;
    mus: number;
    radiusearthkm: number;
    xke: number;
    j2: number;
    j3: number;
    j4: number;
    j3oj2: number;
  } {
    let j2, j3, j3oj2, j4, mus, radiusearthkm, tumin, xke;

    switch (whichconst) {
      // -- wgs-72 low precision str#3 constants --
      case 'wgs72old':
        mus = 398600.79964; // In km3 / s2
        radiusearthkm = 6378.135; // Km
        xke = 0.0743669161; // Reciprocal of tumin
        tumin = 1.0 / xke;
        j2 = 0.001082616;
        j3 = -0.00000253881;
        j4 = -0.00000165597;
        j3oj2 = j3 / j2;
        break;
      // ------------ wgs-72 constants ------------
      case 'wgs72':
        mus = 398600.8; // In km3 / s2
        radiusearthkm = 6378.135; // Km
        xke = 60.0 / Math.sqrt((radiusearthkm * radiusearthkm * radiusearthkm) / mus);
        tumin = 1.0 / xke;
        j2 = 0.001082616;
        j3 = -0.00000253881;
        j4 = -0.00000165597;
        j3oj2 = j3 / j2;
        break;
      case 'wgs84':
        // ------------ wgs-84 constants ------------
        mus = 398600.5; // In km3 / s2
        radiusearthkm = 6378.137; // Km
        xke = 60.0 / Math.sqrt((radiusearthkm * radiusearthkm * radiusearthkm) / mus);
        tumin = 1.0 / xke;
        j2 = 0.00108262998905;
        j3 = -0.00000253215306;
        j4 = -0.00000161098761;
        j3oj2 = j3 / j2;
        break;
      default:
        throw new Error(`unknown gravity option ${whichconst}`);
    }

    return {
      tumin,
      mus,
      radiusearthkm,
      xke,
      j2,
      j3,
      j4,
      j3oj2,
    };
  }

  // Dspace

  /*
   *-----------------------------------------------------------------------------
   *
   *                           procedure initl
   *
   *  this procedure initializes the sgp4 propagator. all the initialization is
   *    consolidated here instead of having multiple loops inside other routines.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    satn        - satellite number - not needed, placed in satrec
   *    xke         - reciprocal of tumin
   *    j2          - j2 zonal harmonic
   *    ecco        - eccentricity                           0.0 - 1.0
   *    epoch       - epoch time in days from jan 0, 1950. 0 hr
   *    inclo       - inclination of satellite
   *    no          - mean motion of satellite
   *
   *  outputs       :
   *    ainv        - 1.0 / a
   *    ao          - semi major axis
   *    con41       -
   *    con42       - 1.0 - 5.0 cos(i)
   *    cosio       - cosine of inclination
   *    cosio2      - cosio squared
   *    eccsq       - eccentricity squared
   *    method      - flag for deep space                    'd', 'n'
   *    omeosq      - 1.0 - ecco * ecco
   *    posq        - semi-parameter squared
   *    rp          - radius of perigee
   *    rteosq      - square root of (1.0 - ecco*ecco)
   *    sinio       - sine of inclination
   *    gsto        - gst at time of observation               rad
   *    no          - mean motion of satellite
   *
   *  locals        :
   *    ak          -
   *    d1          -
   *    del         -
   *    adel        -
   *    po          -
   *
   *  coupling      :
   *    getgravconst- no longer used
   *    gstime      - find greenwich sidereal time from the julian date
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  private static initl_(options: {
    opsmode: string;
    ecco: number;
    epoch: number;
    inclo: number;
    xke: number;
    j2: number;
    no: number;
  }): {
    no: number;
    method: string;
    ainv: number;
    ao: number;
    con41: number;
    con42: number;
    cosio: number;
    cosio2: number;
    eccsq: number;
    omeosq: number;
    posq: number;
    rp: number;
    rteosq: number;
    sinio: number;
    gsto: number;
  } {
    /*
     * Sgp4fix satn not needed. include in satrec in case needed later
     * int satn,
     * sgp4fix just pass in xke and j2
     * gravconsttype whichconst,
     */
    const { opsmode, ecco, epoch, inclo, xke, j2 } = options;
    let { no } = options;

    /* --------------------- local variables ------------------------ */
    const { PI } = Math;
    const TAU = PI * 2;
    const x2o3 = 2.0 / 3.0;

    // Sgp4fix use old way of finding gst
    /** Ootk -- Some variables imported from outside the class at the top */

    /*
     * ----------------------- earth constants ---------------------
     * sgp4fix identify constants and allow alternate values
     * only xke and j2 are used here so pass them in directly
     * getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 )
     */

    // ------------- calculate auxillary epoch quantities ----------
    const eccsq = ecco * ecco;
    const omeosq = 1.0 - eccsq;
    const rteosq = Math.sqrt(omeosq);
    const cosio = Math.cos(inclo);
    const cosio2 = cosio * cosio;

    // ------------------ un-kozai the mean motion -----------------
    const ak = (xke / no) ** x2o3;
    const d1 = (0.75 * j2 * (3.0 * cosio2 - 1.0)) / (rteosq * omeosq);
    let delPrime = d1 / (ak * ak);
    const adel = ak * (1.0 - delPrime * delPrime - delPrime * (1.0 / 3.0 + (134.0 * delPrime * delPrime) / 81.0));

    delPrime = d1 / (adel * adel);
    no /= 1.0 + delPrime;

    const ao = (xke / no) ** x2o3;
    const sinio = Math.sin(inclo);
    const po = ao * omeosq;
    const con42 = 1.0 - 5.0 * cosio2;
    const con41 = -con42 - cosio2 - cosio2;
    const ainv = 1.0 / ao;
    const posq = po * po;
    const rp = ao * (1.0 - ecco);
    const method = 'n';

    //  Sgp4fix modern approach to finding sidereal time
    /** Ootk -- Continue allowing AFSPC mode for SGP4 Validation */
    let gsto;

    if (opsmode === 'a') {
      /*
       *  Sgp4fix use old way of finding gst
       *  count integer number of days from 0 jan 1970
       */
      const ts70 = epoch - 7305.0;
      const ds70 = Math.floor(ts70 + 1.0e-8);
      const tfrac = ts70 - ds70;

      //  Find greenwich location at epoch

      // IDEA: Precision issues in JavaScript...
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      const c1 = 1.72027916940703639e-2;
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      const thgr70 = 1.7321343856509374;
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      const fk5r = 5.07551419432269442e-15;
      const c1p2p = c1 + TAU;

      gsto = (thgr70 + c1 * ds70 + c1p2p * tfrac + ts70 * ts70 * fk5r) % TAU;
      /* istanbul ignore next | This is no longer possible*/
      if (gsto < 0.0) {
        gsto += TAU;
      }
    } else {
      gsto = Sgp4.gstime(epoch + 2433281.5);
    }

    return {
      no,
      method,
      ainv,
      ao,
      con41,
      con42,
      cosio,
      cosio2,
      eccsq,
      omeosq,
      posq,
      rp,
      rteosq,
      sinio,
      gsto,
    };
  }

  // Initl

  /*
   *-----------------------------------------------------------------------------
   *
   *                             procedure sgp4init
   *
   *  this procedure initializes variables for sgp4.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    opsmode     - mode of operation afspc or improved 'a', 'i'
   *    whichconst  - which set of constants to use  72, 84
   *    satn        - satellite number
   *    bstar       - sgp4 type drag coefficient              kg/m2er
   *    ecco        - eccentricity
   *    epoch       - epoch time in days from jan 0, 1950. 0 hr
   *    argpo       - argument of perigee (output if ds)
   *    inclo       - inclination
   *    mo          - mean anomaly (output if ds)
   *    no          - mean motion
   *    nodeo       - right ascension of ascending node
   *
   *  outputs       :
   *    rec      - common values for subsequent calls
   *    return code - non-zero on error.
   *                   1 - mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er
   *                   2 - mean motion less than 0.0
   *                   3 - pert elements, ecc < 0.0  or  ecc > 1.0
   *                   4 - semi-latus rectum < 0.0
   *                   5 - epoch elements are sub-orbital
   *                   6 - satellite has decayed
   *
   *  locals        :
   *    cnodm  , snodm  , cosim  , sinim  , cosomm , sinomm
   *    cc1sq  , cc2    , cc3
   *    coef   , coef1
   *    cosio4      -
   *    day         -
   *    dndt        -
   *    em          - eccentricity
   *    emsq        - eccentricity squared
   *    eeta        -
   *    etasq       -
   *    gam         -
   *    argpm       - argument of perigee
   *    nodem       -
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    perige      - perigee
   *    PInvsq      -
   *    psisq       -
   *    qzms24      -
   *    rtemsq      -
   *    s1, s2, s3, s4, s5, s6, s7          -
   *    sfour       -
   *    ss1, ss2, ss3, ss4, ss5, ss6, ss7         -
   *    sz1, sz2, sz3
   *    sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33        -
   *    tc          -
   *    temp        -
   *    temp1, temp2, temp3       -
   *    tsi         -
   *    xPIdot      -
   *    xhdot1      -
   *    z1, z2, z3          -
   *    z11, z12, z13, z21, z22, z23, z31, z32, z33         -
   *
   *  coupling      :
   *    getgravconst-
   *    initl       -
   *    dscom       -
   *    dpper       -
   *    dsinit      -
   *    sgp4        -
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   *----------------------------------------------------------------------------
   */
  private static sgp4init_(
    satrec: SatelliteRecord,
    options: {
      whichconst?: Sgp4GravConstants;
      opsmode?: Sgp4OpsMode;
      satn?: string;
      epoch: number;
      xbstar: number;
      xecco: number;
      xargpo: number;
      xinclo: number;
      xndot: number;
      xnddot: number;
      xmo: number;
      xno: number;
      xnodeo: number;
    },
  ): void {
    /* eslint-disable no-param-reassign */
    const {
      whichconst = Sgp4GravConstants.wgs72,
      opsmode = Sgp4OpsMode.IMPROVED,
      satn = satrec.satnum,
      epoch,
      xbstar,
      xecco,
      xargpo,
      xinclo,
      xndot,
      xnddot,
      xmo,
      xno,
      xnodeo,
    } = options;

    /* ------------------------ initialization --------------------- */
    /*
     * Sgp4fix divisor for divide by zero check on inclination
     * the old check used 1.0 + Math.cos(PI-1.0e-9), but then compared it to
     * 1.5 e-12, so the threshold was changed to 1.5e-12 for consistency
     */

    // ----------- set all near earth variables to zero ------------
    satrec.isimp = 0;
    satrec.method = 'n';
    satrec.aycof = 0.0;
    satrec.con41 = 0.0;
    satrec.cc1 = 0.0;
    satrec.cc4 = 0.0;
    satrec.cc5 = 0.0;
    satrec.d2 = 0.0;
    satrec.d3 = 0.0;
    satrec.d4 = 0.0;
    satrec.delmo = 0.0;
    satrec.eta = 0.0;
    satrec.argpdot = 0.0;
    satrec.omgcof = 0.0;
    satrec.sinmao = 0.0;
    satrec.t = 0.0;
    satrec.t2cof = 0.0;
    satrec.t3cof = 0.0;
    satrec.t4cof = 0.0;
    satrec.t5cof = 0.0;
    satrec.x1mth2 = 0.0;
    satrec.x7thm1 = 0.0;
    satrec.mdot = 0.0;
    satrec.nodedot = 0.0;
    satrec.xlcof = 0.0;
    satrec.xmcof = 0.0;
    satrec.nodecf = 0.0;

    // ----------- set all deep space variables to zero ------------
    satrec.irez = 0;
    satrec.d2201 = 0.0;
    satrec.d2211 = 0.0;
    satrec.d3210 = 0.0;
    satrec.d3222 = 0.0;
    satrec.d4410 = 0.0;
    satrec.d4422 = 0.0;
    satrec.d5220 = 0.0;
    satrec.d5232 = 0.0;
    satrec.d5421 = 0.0;
    satrec.d5433 = 0.0;
    satrec.dedt = 0.0;
    satrec.del1 = 0.0;
    satrec.del2 = 0.0;
    satrec.del3 = 0.0;
    satrec.didt = 0.0;
    satrec.dmdt = 0.0;
    satrec.dnodt = 0.0;
    satrec.domdt = 0.0;
    satrec.e3 = 0.0;
    satrec.ee2 = 0.0;
    satrec.peo = 0.0;
    satrec.pgho = 0.0;
    satrec.pho = 0.0;
    satrec.PInco = 0.0;
    satrec.plo = 0.0;
    satrec.se2 = 0.0;
    satrec.se3 = 0.0;
    satrec.sgh2 = 0.0;
    satrec.sgh3 = 0.0;
    satrec.sgh4 = 0.0;
    satrec.sh2 = 0.0;
    satrec.sh3 = 0.0;
    satrec.si2 = 0.0;
    satrec.si3 = 0.0;
    satrec.sl2 = 0.0;
    satrec.sl3 = 0.0;
    satrec.sl4 = 0.0;
    satrec.gsto = 0.0;
    satrec.xfact = 0.0;
    satrec.xgh2 = 0.0;
    satrec.xgh3 = 0.0;
    satrec.xgh4 = 0.0;
    satrec.xh2 = 0.0;
    satrec.xh3 = 0.0;
    satrec.xi2 = 0.0;
    satrec.xi3 = 0.0;
    satrec.xl2 = 0.0;
    satrec.xl3 = 0.0;
    satrec.xl4 = 0.0;
    satrec.xlamo = 0.0;
    satrec.zmol = 0.0;
    satrec.zmos = 0.0;
    satrec.atime = 0.0;
    satrec.xli = 0.0;
    satrec.xni = 0.0;

    /* ------------------------ earth constants ----------------------- */
    /*
     * Sgp4fix identify constants and allow alternate values
     * this is now the only call for the constants
     */
    const gravResults = Sgp4.getgravconst_(whichconst);

    satrec.tumin = gravResults.tumin;
    satrec.mus = gravResults.mus;
    satrec.radiusearthkm = gravResults.radiusearthkm;
    satrec.xke = gravResults.xke;
    satrec.j2 = gravResults.j2;
    satrec.j3 = gravResults.j3;
    satrec.j4 = gravResults.j4;
    satrec.j3oj2 = gravResults.j3oj2;
    const { j2 } = gravResults;
    const { j4 } = gravResults;
    const { xke } = gravResults;
    const { j3oj2 } = gravResults;

    // -------------------------------------------------------------------------

    satrec.error = 0;
    satrec.operationmode = opsmode;

    // New alpha5 or 9-digit number
    /**
     * Ootk -- Using JS code for string manipulation but same effect
     * Ex. A2525 = 102525
     * Ex. Z1234 = 351234
     */
    const leadingChar = satn.split('')[0].toLowerCase(); // Using uppercase will break the -96 math.

    if (isNaN(parseInt(leadingChar)) && leadingChar !== ' ') {
      satrec.satnum = parseInt(leadingChar.charCodeAt(0) - 96 + 9 + satrec.satnum.slice(1, 5)).toString();
    } else {
      satrec.satnum = satn;
    }

    /*
     * Sgp4fix - note the following variables are also passed directly via satrec.
     * it is possible to streamline the sgp4init call by deleting the "x"
     * variables, but the user would need to set the satrec.* values first. we
     * include the additional assignments in case twoline2rv is not used.
     */
    satrec.bstar = xbstar;
    // Sgp4fix allow additional parameters in the struct
    satrec.ndot = xndot;
    satrec.nddot = xnddot;
    satrec.ecco = xecco;
    satrec.argpo = xargpo;
    satrec.inclo = xinclo;
    satrec.mo = xmo;
    // Sgp4fix rename variables to clarify which mean motion is intended
    satrec.no = xno;
    satrec.nodeo = xnodeo;

    /*
     * Single averaged mean elements
     * satrec.am = satrec.em = satrec.im = satrec.Om = satrec.mm = satrec.nm = 0.0;
     */

    /*
     * ------------------------ earth constants -----------------------
     * sgp4fix identify constants and allow alternate values
     * getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
     */
    const ss = 78.0 / satrec.radiusearthkm + 1.0;
    // Sgp4fix use multiply for speed instead of pow
    const qzms2ttemp = (120.0 - 78.0) / satrec.radiusearthkm;
    const qzms2t = qzms2ttemp * qzms2ttemp * qzms2ttemp * qzms2ttemp;

    satrec.init = 'y';
    satrec.t = 0.0;

    // Sgp4fix remove satn as it is not needed in initl
    const initlOptions = {
      ecco: satrec.ecco,
      epoch,
      inclo: satrec.inclo,
      no: satrec.no,
      method: satrec.method,
      opsmode: satrec.operationmode,
      xke: satrec.xke,
      j2: satrec.j2,
    };

    const initlResult = Sgp4.initl_(initlOptions);

    const { ao, con42, cosio, cosio2, eccsq, omeosq, posq, rp, rteosq, sinio } = initlResult;

    satrec.no = initlResult.no;
    satrec.con41 = initlResult.con41;
    satrec.gsto = initlResult.gsto;
    satrec.a = (satrec.no * satrec.tumin) ** (-2.0 / 3.0);
    satrec.alta = satrec.a * (1.0 + satrec.ecco) - 1.0;
    satrec.altp = satrec.a * (1.0 - satrec.ecco) - 1.0;
    satrec.error = 0;

    /*
     * Sgp4fix remove this check as it is unnecessary
     * the mrt check in sgp4 handles decaying satellite cases even if the starting
     * condition is below the surface of te earth
     * if (rp < 1.0)
     * {
     *   printf("// *** satn%d epoch elts sub-orbital ***\n", satn);
     *   satrec.error = 5;
     * }
     */

    if (omeosq >= 0.0 || satrec.no >= 0.0) {
      satrec.isimp = 0;
      if (rp < 220.0 / satrec.radiusearthkm + 1.0) {
        satrec.isimp = 1;
      }
      let sfour = ss;
      let qzms24 = qzms2t;
      const perige = (rp - 1.0) * satrec.radiusearthkm;

      // - for perigees below 156 km, s and qoms2t are altered -
      if (perige < 156.0) {
        sfour = perige - 78.0;
        if (perige < 98.0) {
          sfour = 20.0;
        }
        // Sgp4fix use multiply for speed instead of pow
        const qzms24temp = (120.0 - sfour) / satrec.radiusearthkm;

        qzms24 = qzms24temp * qzms24temp * qzms24temp * qzms24temp;
        sfour = sfour / satrec.radiusearthkm + 1.0;
      }
      const PInvsq = 1.0 / posq;

      const tsi = 1.0 / (ao - sfour);

      satrec.eta = ao * satrec.ecco * tsi;
      const etasq = satrec.eta * satrec.eta;
      const eeta = satrec.ecco * satrec.eta;
      const psisq = Math.abs(1.0 - etasq);
      const coef = qzms24 * tsi ** 4.0;
      const coef1 = coef / psisq ** 3.5;
      const cc2 =
        coef1 *
        satrec.no *
        (ao * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq)) +
          ((0.375 * j2 * tsi) / psisq) * satrec.con41 * (8.0 + 3.0 * etasq * (8.0 + etasq)));

      satrec.cc1 = satrec.bstar * cc2;
      let cc3 = 0.0;

      if (satrec.ecco > 1.0e-4) {
        cc3 = (-2.0 * coef * tsi * j3oj2 * satrec.no * sinio) / satrec.ecco;
      }
      satrec.x1mth2 = 1.0 - cosio2;
      satrec.cc4 =
        2.0 *
        satrec.no *
        coef1 *
        ao *
        omeosq *
        (satrec.eta * (2.0 + 0.5 * etasq) +
          satrec.ecco * (0.5 + 2.0 * etasq) -
          ((j2 * tsi) / (ao * psisq)) *
            (-3.0 * satrec.con41 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) +
              0.75 * satrec.x1mth2 * (2.0 * etasq - eeta * (1.0 + etasq)) * Math.cos(2.0 * satrec.argpo)));
      satrec.cc5 = 2.0 * coef1 * ao * omeosq * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);
      const cosio4 = cosio2 * cosio2;
      const temp1 = 1.5 * j2 * PInvsq * satrec.no;
      const temp2 = 0.5 * temp1 * j2 * PInvsq;
      const temp3 = -0.46875 * j4 * PInvsq * PInvsq * satrec.no;

      satrec.mdot =
        satrec.no +
        0.5 * temp1 * rteosq * satrec.con41 +
        0.0625 * temp2 * rteosq * (13.0 - 78.0 * cosio2 + 137.0 * cosio4);
      satrec.argpdot =
        -0.5 * temp1 * con42 +
        0.0625 * temp2 * (7.0 - 114.0 * cosio2 + 395.0 * cosio4) +
        temp3 * (3.0 - 36.0 * cosio2 + 49.0 * cosio4);
      const xhdot1 = -temp1 * cosio;

      satrec.nodedot = xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * cosio2) + 2.0 * temp3 * (3.0 - 7.0 * cosio2)) * cosio;
      const xPIdot = satrec.argpdot + satrec.nodedot;

      satrec.omgcof = satrec.bstar * cc3 * Math.cos(satrec.argpo);
      satrec.xmcof = 0.0;
      if (satrec.ecco > 1.0e-4) {
        satrec.xmcof = (-x2o3 * coef * satrec.bstar) / eeta;
      }
      satrec.nodecf = 3.5 * omeosq * xhdot1 * satrec.cc1;
      satrec.t2cof = 1.5 * satrec.cc1;

      // Sgp4fix for divide by zero with xinco = 180 deg
      if (Math.abs(cosio + 1.0) > 1.5e-12) {
        satrec.xlcof = (-0.25 * j3oj2 * sinio * (3.0 + 5.0 * cosio)) / (1.0 + cosio);
      } else {
        satrec.xlcof = (-0.25 * j3oj2 * sinio * (3.0 + 5.0 * cosio)) / temp4;
      }
      satrec.aycof = -0.5 * j3oj2 * sinio;

      // Sgp4fix use multiply for speed instead of pow
      const delmotemp = 1.0 + satrec.eta * Math.cos(satrec.mo);

      satrec.delmo = delmotemp * delmotemp * delmotemp;
      satrec.sinmao = Math.sin(satrec.mo);
      satrec.x7thm1 = 7.0 * cosio2 - 1.0;

      // --------------- deep space initialization -------------
      if (TAU / satrec.no >= 225.0) {
        satrec.method = 'd';
        satrec.isimp = 1;
        const tc = 0.0;
        const inclm = satrec.inclo;

        const dscomOptions = {
          epoch,
          ep: satrec.ecco,
          argpp: satrec.argpo,
          tc,
          inclp: satrec.inclo,
          nodep: satrec.nodeo,
          np: satrec.no,
          e3: satrec.e3,
          ee2: satrec.ee2,
          peo: satrec.peo,
          pgho: satrec.pgho,
          pho: satrec.pho,
          PInco: satrec.PInco,
          plo: satrec.plo,
          se2: satrec.se2,
          se3: satrec.se3,
          sgh2: satrec.sgh2,
          sgh3: satrec.sgh3,
          sgh4: satrec.sgh4,
          sh2: satrec.sh2,
          sh3: satrec.sh3,
          si2: satrec.si2,
          si3: satrec.si3,
          sl2: satrec.sl2,
          sl3: satrec.sl3,
          sl4: satrec.sl4,
          xgh2: satrec.xgh2,
          xgh3: satrec.xgh3,
          xgh4: satrec.xgh4,
          xh2: satrec.xh2,
          xh3: satrec.xh3,
          xi2: satrec.xi2,
          xi3: satrec.xi3,
          xl2: satrec.xl2,
          xl3: satrec.xl3,
          xl4: satrec.xl4,
          zmol: satrec.zmol,
          zmos: satrec.zmos,
        };

        const dscomResult = Sgp4.dscom_(dscomOptions);

        satrec.e3 = dscomResult.e3;
        satrec.ee2 = dscomResult.ee2;

        satrec.peo = dscomResult.peo;
        satrec.pgho = dscomResult.pgho;
        satrec.pho = dscomResult.pho;

        satrec.PInco = dscomResult.PInco;
        satrec.plo = dscomResult.plo;
        satrec.se2 = dscomResult.se2;
        satrec.se3 = dscomResult.se3;

        satrec.sgh2 = dscomResult.sgh2;
        satrec.sgh3 = dscomResult.sgh3;
        satrec.sgh4 = dscomResult.sgh4;
        satrec.sh2 = dscomResult.sh2;
        satrec.sh3 = dscomResult.sh3;

        satrec.si2 = dscomResult.si2;
        satrec.si3 = dscomResult.si3;
        satrec.sl2 = dscomResult.sl2;
        satrec.sl3 = dscomResult.sl3;
        satrec.sl4 = dscomResult.sl4;

        const {
          sinim,
          cosim,
          em,
          emsq,
          s1,
          s2,
          s3,
          s4,
          s5,
          ss1,
          ss2,
          ss3,
          ss4,
          ss5,
          sz1,
          sz3,
          sz11,
          sz13,
          sz21,
          sz23,
          sz31,
          sz33,
        } = dscomResult;

        satrec.xgh2 = dscomResult.xgh2;
        satrec.xgh3 = dscomResult.xgh3;
        satrec.xgh4 = dscomResult.xgh4;
        satrec.xh2 = dscomResult.xh2;
        satrec.xh3 = dscomResult.xh3;
        satrec.xi2 = dscomResult.xi2;
        satrec.xi3 = dscomResult.xi3;
        satrec.xl2 = dscomResult.xl2;
        satrec.xl3 = dscomResult.xl3;
        satrec.xl4 = dscomResult.xl4;
        satrec.zmol = dscomResult.zmol;
        satrec.zmos = dscomResult.zmos;

        const { nm, z1, z3, z11, z13, z21, z23, z31, z33 } = dscomResult;

        const dpperOptions = {
          inclo: inclm,
          init: satrec.init,
          ep: satrec.ecco,
          inclp: satrec.inclo,
          nodep: satrec.nodeo,
          argpp: satrec.argpo,
          mp: satrec.mo,
          opsmode: satrec.operationmode,
        };

        const dpperResult = Sgp4.dpper_(satrec, dpperOptions);

        satrec.ecco = dpperResult.ep;
        satrec.inclo = dpperResult.inclp;
        satrec.nodeo = dpperResult.nodep;
        satrec.argpo = dpperResult.argpp;
        satrec.mo = dpperResult.mp;

        const argpm = 0.0;
        const nodem = 0.0;
        const mm = 0.0;

        const dsinitOptions = {
          xke,
          cosim,
          emsq,
          argpo: satrec.argpo,
          s1,
          s2,
          s3,
          s4,
          s5,
          sinim,
          ss1,
          ss2,
          ss3,
          ss4,
          ss5,
          sz1,
          sz3,
          sz11,
          sz13,
          sz21,
          sz23,
          sz31,
          sz33,
          t: satrec.t,
          tc,
          gsto: satrec.gsto,
          mo: satrec.mo,
          mdot: satrec.mdot,
          no: satrec.no,
          nodeo: satrec.nodeo,
          nodedot: satrec.nodedot,
          xPIdot,
          z1,
          z3,
          z11,
          z13,
          z21,
          z23,
          z31,
          z33,
          ecco: satrec.ecco,
          eccsq,
          em,
          argpm,
          inclm,
          mm,
          nm,
          nodem,
          irez: satrec.irez,
          atime: satrec.atime,
          d2201: satrec.d2201,
          d2211: satrec.d2211,
          d3210: satrec.d3210,
          d3222: satrec.d3222,
          d4410: satrec.d4410,
          d4422: satrec.d4422,
          d5220: satrec.d5220,
          d5232: satrec.d5232,
          d5421: satrec.d5421,
          d5433: satrec.d5433,
          dedt: satrec.dedt,
          didt: satrec.didt,
          dmdt: satrec.dmdt,
          dnodt: satrec.dnodt,
          domdt: satrec.domdt,
          del1: satrec.del1,
          del2: satrec.del2,
          del3: satrec.del3,
          xfact: satrec.xfact,
          xlamo: satrec.xlamo,
          xli: satrec.xli,
          xni: satrec.xni,
        };

        const dsinitResult = Sgp4.dsinit_(dsinitOptions as DsInitParams);

        satrec.irez = dsinitResult.irez;
        satrec.atime = dsinitResult.atime;
        satrec.d2201 = dsinitResult.d2201;
        satrec.d2211 = dsinitResult.d2211;

        satrec.d3210 = dsinitResult.d3210;
        satrec.d3222 = dsinitResult.d3222;
        satrec.d4410 = dsinitResult.d4410;
        satrec.d4422 = dsinitResult.d4422;
        satrec.d5220 = dsinitResult.d5220;

        satrec.d5232 = dsinitResult.d5232;
        satrec.d5421 = dsinitResult.d5421;
        satrec.d5433 = dsinitResult.d5433;
        satrec.dedt = dsinitResult.dedt;
        satrec.didt = dsinitResult.didt;

        satrec.dmdt = dsinitResult.dmdt;
        satrec.dnodt = dsinitResult.dnodt;
        satrec.domdt = dsinitResult.domdt;
        satrec.del1 = dsinitResult.del1;

        satrec.del2 = dsinitResult.del2;
        satrec.del3 = dsinitResult.del3;
        satrec.xfact = dsinitResult.xfact;
        satrec.xlamo = dsinitResult.xlamo;
        satrec.xli = dsinitResult.xli;

        satrec.xni = dsinitResult.xni;
      }

      // ----------- set variables if not deep space -----------
      if (satrec.isimp !== 1) {
        const cc1sq = satrec.cc1 * satrec.cc1;

        satrec.d2 = 4.0 * ao * tsi * cc1sq;
        const temp = (satrec.d2 * tsi * satrec.cc1) / 3.0;

        satrec.d3 = (17.0 * ao + sfour) * temp;
        satrec.d4 = 0.5 * temp * ao * tsi * (221.0 * ao + 31.0 * sfour) * satrec.cc1;
        satrec.t3cof = satrec.d2 + 2.0 * cc1sq;
        satrec.t4cof = 0.25 * (3.0 * satrec.d3 + satrec.cc1 * (12.0 * satrec.d2 + 10.0 * cc1sq));
        satrec.t5cof =
          0.2 *
          (3.0 * satrec.d4 +
            12.0 * satrec.cc1 * satrec.d3 +
            6.0 * satrec.d2 * satrec.d2 +
            15.0 * cc1sq * (2.0 * satrec.d2 + cc1sq));
      } // If omeosq = 0 ...

      /* Finally propogate to zero epoch to initialize all others. */
      /*
       * Sgp4fix take out check to let satellites process until they are actually below earth surface
       * if(satrec.error == 0)
       */
    }
    Sgp4.propagate(satrec, 0);

    satrec.init = 'n';

    /*
     * Sgp4fix return boolean. satrec.error contains any error codes
     *  return satrec; -- no reason to return anything in JS
     */
  }

  /*
   * #endregion Private Static Methods (7)
   * Invjday
   */
}
