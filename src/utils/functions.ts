
import { AngularDiameterMethod } from '../enums/AngularDiameterMethod';
import { AngularDistanceMethod } from '../enums/AngularDistanceMethod';
import { DifferentiableFunction, EcefVec3, Kilometers, KilometersPerSecond, Radians, SpaceObjectType, Vec3 } from '../types/types';
import { angularVelocityOfEarth, cKmPerSec } from './constants';

/**
 * Converts a power ratio (or a power-like quantity such as an RCS in m^2) to decibels:
 * dB = 10 log10(power). This is MATLAB's `pow2db`; an amplitude (field) ratio would use
 * 20 log10 instead.
 * @param power - The power ratio to convert (must be positive).
 * @returns The value in decibels.
 * @throws Error if power is not positive.
 * @example
 * ```typescript
 * const db = pow2db(1000); // Returns 30
 * const db2 = pow2db(100); // Returns 20
 * ```
 */
export function pow2db(power: number): number {
  if (power <= 0) {
    throw new Error('Power must be positive for decibel conversion');
  }

  return 10 * Math.log10(power);
}

/**
 * Calculates the relative velocity between two velocity vectors.
 * @param vel1 - First velocity vector in km/s.
 * @param vel2 - Second velocity vector in km/s.
 * @returns The magnitude of the relative velocity in km/s.
 * @example
 * ```typescript
 * const v1 = { x: 7.0, y: 0.5, z: 0.1 };
 * const v2 = { x: 6.8, y: 0.6, z: 0.2 };
 * const relVel = relativeVelocity(v1, v2); // ~0.24 km/s
 * ```
 */
export function relativeVelocity<T extends number>(vel1: Vec3<T>, vel2: Vec3<T>): T {
  return Math.sqrt((vel1.x - vel2.x) ** 2 + (vel1.y - vel2.y) ** 2 + (vel1.z - vel2.z) ** 2) as T;
}

/**
 * Shape type for RCS estimation.
 */
export type RcsShape = 'sphere' | 'cylinder' | 'cone' | 'hexagon' | 'cube';

/**
 * Estimates the radar cross section (RCS) of an object from its dimensions and shape, in m^2.
 *
 * The estimate is the orientation-averaged geometric cross-section. By Cauchy's surface-area
 * formula, a convex body's projected area averaged over all orientations is S / 4, where S is
 * its surface area. For a sphere this is pi r^2, which is also the exact optical-region RCS of a
 * conducting sphere (Skolnik, Radar Handbook 3rd ed., section 14.3), so the estimate is the usual
 * frequency-independent proxy for a tumbling object. Shape geometry:
 * - sphere: diameter = `length` (`width` and `height` ignored), S = pi d^2
 * - cylinder: length `length`, diameter `width`, S = pi d L + pi d^2 / 2
 * - cone: height `length`, base diameter `width`, S = pi r (r + sqrt(r^2 + L^2))
 * - hexagon (regular hexagonal prism): length `length`, corner-to-corner width `width`
 *   (side a = width / 2), S = 6 a L + 3 sqrt(3) a^2
 * - anything else (box / cube): edges `length`, `width`, `height`, S = 2 (LW + LH + WH)
 *
 * Shape matching is case-insensitive and by substring ('sphere', 'cyl', 'cone', 'hex').
 * @param length - Length in metres (diameter for a sphere).
 * @param width - Width in metres (diameter for a cylinder or cone).
 * @param height - Height in metres (box only).
 * @param shape - The shape type ('sphere', 'cylinder', 'cone', 'hexagon', 'cube').
 * @returns Estimated RCS in square metres (m^2).
 * @example
 * ```typescript
 * const rcs = estimateRcs(2.0, 2.0, 2.0, 'sphere'); // pi m^2 (3.1416)
 * ```
 */
export function estimateRcs(length: number, width: number, height: number, shape: RcsShape | (string & {})): number {
  const shapeLower = shape.toLowerCase();
  let surfaceArea: number;

  if (shapeLower.includes('sphere')) {
    surfaceArea = Math.PI * length * length;
  } else if (shapeLower.includes('cyl')) {
    surfaceArea = Math.PI * width * length + (Math.PI * width * width) / 2;
  } else if (shapeLower.includes('cone')) {
    const r = width / 2;

    surfaceArea = Math.PI * r * (r + Math.sqrt(r * r + length * length));
  } else if (shapeLower.includes('hex')) {
    const a = width / 2;

    surfaceArea = 6 * a * length + 3 * Math.sqrt(3) * a * a;
  } else {
    surfaceArea = 2 * (length * width + length * height + width * height);
  }

  // Cauchy: mean projected area of a convex body = S / 4
  return surfaceArea / 4;
}

/**
 * Calculates the factorial n! of a non-negative integer.
 * @param n - A non-negative integer.
 * @returns n!, or NaN when n is negative or not an integer (n! is undefined there; use
 * {@link gamma} for Gamma(n + 1) at non-integer n).
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    return NaN;
  }

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

/**
 * Calculates the base 10 logarithm of a number.
 * @param x - The number to calculate the logarithm for.
 * @returns The base 10 logarithm of the input number.
 */
export function log10(x: number): number {
  return Math.log10(x);
}

/**
 * Calculates the hyperbolic secant of a number.
 * @param x - The number to calculate the hyperbolic secant of.
 * @returns The hyperbolic secant of the given number.
 */
export function sech(x: number): number {
  return 1 / Math.cosh(x);
}

/**
 * Calculates the hyperbolic cosecant of a number.
 * @param x - The number for which to calculate the hyperbolic cosecant.
 * @returns The hyperbolic cosecant of the given number.
 */
export function csch(x: number): number {
  return 1 / Math.sinh(x);
}

/**
 * Returns the inverse hyperbolic cosecant of a number.
 * @param x - The number to calculate the inverse hyperbolic cosecant of.
 * @returns The inverse hyperbolic cosecant of the given number.
 */
export function acsch(x: number): number {
  return Math.log(1 / x + Math.sqrt(1 / (x * x) + 1));
}

/**
 * Calculates the inverse hyperbolic secant (asech) of a number.
 * @param x - The number to calculate the inverse hyperbolic secant of.
 * @returns The inverse hyperbolic secant of the given number.
 */
export function asech(x: number): number {
  return Math.log(1 / x + Math.sqrt(1 / (x * x) - 1));
}

/**
 * Calculates the inverse hyperbolic cotangent (acoth) of a number.
 * @param x - The number to calculate the acoth of.
 * @returns The inverse hyperbolic cotangent of the given number.
 */
export function acoth(x: number): number {
  return 0.5 * Math.log((x + 1) / (x - 1));
}

/**
 * Copies the sign of the second number to the first number.
 * @param mag - The magnitude of the number.
 * @param sgn - The sign of the number.
 * @returns The number with the magnitude of `mag` and the sign of `sgn`.
 */
export function copySign(mag: number, sgn: number): number {
  // Like C copysign: a zero sign keeps its own sign bit (+0 -> +|mag|, -0 -> -|mag|), never 0
  return sgn < 0 || Object.is(sgn, -0) ? -Math.abs(mag) : Math.abs(mag);
}

/**
 * Evaluates a polynomial function at a given value.
 * @param x - The value at which to evaluate the polynomial.
 * @param coeffs - The coefficients of the polynomial.
 * @returns The result of evaluating the polynomial at the given value.
 */
export function evalPoly(x: number, coeffs: Float64Array): number {
  let result: number = coeffs[0];

  for (let i = 1; i < coeffs.length; i++) {
    result = result * x + coeffs[i];
  }

  return result;
}

/**
 * Concatenates two Float64Arrays into a new Float64Array.
 * @param a - The first Float64Array.
 * @param b - The second Float64Array.
 * @returns A new Float64Array containing the concatenated values of `a` and `b`.
 */
export function concat(a: Float64Array, b: Float64Array): Float64Array {
  const result = new Float64Array(a.length + b.length);

  result.set(a);
  result.set(b, a.length);

  return result;
}

/**
 * Calculates the angle in the half-plane that best matches the given angle.
 * @param angle - The angle to be matched.
 * @param match - The angle to be matched against.
 * @returns The angle in the half-plane that best matches the given angle.
 */
export function matchHalfPlane(angle: number, match: number): number {
  const a1 = angle;
  const a2 = 2 * Math.PI - angle;
  const d1 = Math.atan2(Math.sin(a1 - match), Math.cos(a1 - match));
  const d2 = Math.atan2(Math.sin(a2 - match), Math.cos(a2 - match));

  return Math.abs(d1) < Math.abs(d2) ? a1 : a2;
}

/**
 * Wraps an angle to the range [-π, π].
 * @param theta - The angle to wrap.
 * @returns The wrapped angle.
 */
export function wrapAngle(theta: Radians): Radians {
  // JS % keeps the dividend's sign, so fold negative remainders back into [0, 2pi)
  const tau = 2 * Math.PI;
  const result = ((((theta + Math.PI) % tau) + tau) % tau) - Math.PI;

  if (result === -Math.PI) {
    return Math.PI as Radians;
  }

  return result as Radians;
}

/**
 * Calculates the angular distance between two points on a sphere using the cosine formula.
 * @param lam1 - The longitude of the first point in radians.
 * @param phi1 - The latitude of the first point in radians.
 * @param lam2 - The longitude of the second point in radians.
 * @param phi2 - The latitude of the second point in radians.
 * @returns The angular distance between the two points in radians.
 */
function angularDistanceCosine_(lam1: number, phi1: number, lam2: number, phi2: number): Radians {
  const a = Math.sin(phi1) * Math.sin(phi2);
  const b = Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);

  // Rounding can push a + b just past 1 for (nearly) identical directions; acos would be NaN
  return Math.acos(Math.min(1, Math.max(-1, a + b))) as Radians;
}

/**
 * Calculates the angular distance between two points on a sphere using the Haversine formula.
 * @param lam1 - The longitude of the first point in radians.
 * @param phi1 - The latitude of the first point in radians.
 * @param lam2 - The longitude of the second point in radians.
 * @param phi2 - The latitude of the second point in radians.
 * @returns The angular distance between the two points in radians.
 */
function angularDistanceHaversine_(lam1: number, phi1: number, lam2: number, phi2: number): Radians {
  const dlam = lam2 - lam1;
  const dphi = phi2 - phi1;
  const sdlam = Math.sin(0.5 * dlam);
  const sdphi = Math.sin(0.5 * dphi);
  const a = sdphi * sdphi + Math.cos(phi1) * Math.cos(phi2) * sdlam * sdlam;

  return 2.0 * Math.asin(Math.min(1.0, Math.sqrt(a))) as Radians;
}

/**
 * Calculates the angular distance between two points on a sphere.
 * @param lam1 The longitude of the first point.
 * @param phi1 The latitude of the first point.
 * @param lam2 The longitude of the second point.
 * @param phi2 The latitude of the second point.
 * @param method The method to use for calculating the angular distance. Defaults to AngularDistanceMethod.Cosine.
 * @returns The angular distance between the two points.
 * @throws Error if an invalid angular distance method is provided.
 */
export function angularDistance(
  lam1: number,
  phi1: number,
  lam2: number,
  phi2: number,
  method: AngularDistanceMethod = AngularDistanceMethod.Cosine,
): Radians {
  switch (method) {
    case AngularDistanceMethod.Cosine:
      return angularDistanceCosine_(lam1, phi1, lam2, phi2);
    case AngularDistanceMethod.Haversine:
      return angularDistanceHaversine_(lam1, phi1, lam2, phi2);
    default:
      throw new Error('Invalid angular distance method.');
  }
}

/**
 * Calculates the angular diameter of an object.
 * @param diameter - The diameter of the object.
 * @param distance - The distance to the object.
 * @param method - The method used to calculate the angular diameter. Defaults to AngularDiameterMethod.Sphere.
 * @returns The angular diameter of the object.
 * @throws Error if an invalid angular diameter method is provided.
 */
export function angularDiameter(
  diameter: number,
  distance: number,
  method: AngularDiameterMethod = AngularDiameterMethod.Sphere,
): number {
  switch (method) {
    case AngularDiameterMethod.Circle:
      return 2 * Math.atan(diameter / (2 * distance));
    case AngularDiameterMethod.Sphere:
      return 2 * Math.asin(diameter / (2 * distance));
    default:
      throw new Error('Invalid angular diameter method.');
  }
}

/**
 * Performs linear interpolation between two points.
 * @param x - The x-coordinate to interpolate.
 * @param x0 - The x-coordinate of the first point.
 * @param y0 - The y-coordinate of the first point.
 * @param x1 - The x-coordinate of the second point.
 * @param y1 - The y-coordinate of the second point.
 * @returns The interpolated y-coordinate corresponding to the given x-coordinate.
 */
export function linearInterpolate(x: number, x0: number, y0: number, x1: number, y1: number): number {
  return (y0 * (x1 - x) + y1 * (x - x0)) / (x1 - x0);
}

/**
 * Calculates the mean value of an array of numbers.
 * @param values - The array of numbers.
 * @returns The mean value of the numbers.
 */
export function mean(values: number[]): number {
  const n = values.length;
  let sum = 0.0;

  for (const v of values) {
    sum += v;
  }

  return sum / n;
}

/**
 * Calculates the standard deviation of an array of numbers.
 * @param values - The array of numbers.
 * @param isSample - Optional. Specifies whether the array represents a sample. Default is false.
 * @returns The standard deviation of the array.
 */
export function std(values: number[], isSample = false): number {
  const mu = mean(values);
  const n = values.length;
  let sum = 0.0;

  for (const v of values) {
    const sub = v - mu;

    sum += sub * sub;
  }
  const m = isSample ? 1 : 0;

  return Math.sqrt((1.0 / (n - m)) * sum);
}

/**
 * Calculates the covariance between two arrays.
 * @param a - The first array.
 * @param b - The second array.
 * @param isSample - Optional. Specifies whether the arrays represent a sample. Default is false.
 * @returns The covariance between the two arrays.
 */
export function covariance(a: number[], b: number[], isSample = false): number {
  const n = a.length;
  const am = mean(a);
  const bm = mean(b);
  let result = 0.0;

  for (let i = 0; i < n; i++) {
    result += (a[i] - am) * (b[i] - bm);
  }
  const m = isSample ? 1 : 0;

  return result / (n - m);
}

/** Lanczos coefficients for g = 7, n = 9 (Godfrey; Press et al., Numerical Recipes 3rd ed. section 6.1). */
const LANCZOS_G_ = 7;
const LANCZOS_COEF_ = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/**
 * Calculates the gamma function Gamma(x).
 *
 * Positive integers use Gamma(n) = (n - 1)! exactly. Other arguments use the Lanczos
 * approximation (g = 7, 9 terms, relative error about 1e-15) for x >= 0.5 and the reflection
 * formula Gamma(x) Gamma(1 - x) = pi / sin(pi x) below that.
 * @param x - The input number.
 * @returns Gamma(x), or NaN at the poles x = 0, -1, -2, ...
 */
export function gamma(x: number): number {
  if (Number.isInteger(x)) {
    return x > 0 ? factorial(x - 1) : NaN;
  }
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  }

  const z = x - 1;
  let a = LANCZOS_COEF_[0];
  const t = z + LANCZOS_G_ + 0.5;

  for (let i = 1; i < LANCZOS_COEF_.length; i++) {
    a += LANCZOS_COEF_[i] / (z + i);
  }

  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a;
}

/**
 * Solves Kepler's equation for the eccentric (or hyperbolic / parabolic) anomaly and the true
 * anomaly by Newton iteration (Vallado, Fundamentals of Astrodynamics 4th ed., algorithms 2 to 4,
 * `newtonm`).
 *
 * - e < 1: M = E - e sin E; returns E and nu.
 * - e > 1: M = e sinh H - H; returns H and nu.
 * - e = 1 (within 1e-8): Barker, M = B + B^3 / 3 with B = tan(nu / 2); returns B and nu.
 * - e near 0: E = nu = M.
 * @param ecc - The eccentricity of the orbit.
 * @param m - The mean anomaly in radians.
 * @returns e0: the converged eccentric (E), hyperbolic (H) or parabolic (B) anomaly; nu: the true
 * anomaly in radians.
 */
export function newtonM(ecc: number, m: number): { e0: number; nu: number } {
  const numiter = 50;
  const small = 1e-8;
  let e0: number;
  let nu: number;

  if (Math.abs(ecc - 1) < small) {
    // Parabolic: closed-form root of Barker's equation (Vallado eq. 2-50)
    const s = 0.5 * (Math.PI / 2 - Math.atan(1.5 * m));
    const w = Math.atan(Math.cbrt(Math.tan(s)));

    e0 = 2 / Math.tan(2 * w);
    nu = 2 * Math.atan(e0);
  } else if (ecc > 1) {
    // Hyperbolic
    if (ecc < 1.6) {
      e0 = (m < 0 && m > -Math.PI) || m > Math.PI ? m - ecc : m + ecc;
    } else if (ecc < 3.6 && Math.abs(m) > Math.PI) {
      e0 = m - Math.sign(m) * ecc;
    } else {
      e0 = m / (ecc - 1);
    }
    let ktr = 1;
    let e1 = e0 + (m - ecc * Math.sinh(e0) + e0) / (ecc * Math.cosh(e0) - 1);

    while (Math.abs(e1 - e0) > small && ktr <= numiter) {
      ktr++;
      e0 = e1;
      e1 = e0 + (m - ecc * Math.sinh(e0) + e0) / (ecc * Math.cosh(e0) - 1);
    }
    e0 = e1;
    const sinv = -(Math.sqrt(ecc * ecc - 1) * Math.sinh(e1)) / (1 - ecc * Math.cosh(e1));
    const cosv = (Math.cosh(e1) - ecc) / (1 - ecc * Math.cosh(e1));

    nu = Math.atan2(sinv, cosv);
  } else if (ecc > small) {
    // Elliptical
    if ((m < 0.0 && m > -Math.PI) || m > Math.PI) {
      e0 = m - ecc;
    } else {
      e0 = m + ecc;
    }
    let ktr = 1;
    let e1 = e0 + (m - e0 + ecc * Math.sin(e0)) / (1.0 - ecc * Math.cos(e0));

    while (Math.abs(e1 - e0) > small && ktr <= numiter) {
      ktr++;
      e0 = e1;
      e1 = e0 + (m - e0 + ecc * Math.sin(e0)) / (1.0 - ecc * Math.cos(e0));
    }
    // Return the converged iterate, the one nu is computed from
    e0 = e1;
    const sinv = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(e1)) / (1.0 - ecc * Math.cos(e1));
    const cosv = (Math.cos(e1) - ecc) / (1.0 - ecc * Math.cos(e1));

    nu = Math.atan2(sinv, cosv);
  } else {
    nu = m;
    e0 = m;
  }

  return { e0, nu };
}

/**
 * Converts a true anomaly to the eccentric (or hyperbolic / parabolic) anomaly and the mean
 * anomaly (Vallado, Fundamentals of Astrodynamics 4th ed., algorithm 5, `newtonnu`).
 *
 * - e < 1: E from nu, M = E - e sin E, both wrapped to [0, 2 pi).
 * - e > 1: H = asinh(sqrt(e^2 - 1) sin nu / (1 + e cos nu)), M = e sinh H - H (not wrapped).
 *   Only defined for |nu| below the asymptote pi - acos(1 / e); outside it e0 = m = 0.
 * - e = 1 (within 1e-8): B = tan(nu / 2), M = B + B^3 / 3.
 * @param ecc - The eccentricity of the orbit.
 * @param nu - The true anomaly in radians.
 * @returns e0: the eccentric (E), hyperbolic (H) or parabolic (B) anomaly; m: the mean anomaly.
 */
export function newtonNu(ecc: number, nu: number): { e0: number; m: Radians } {
  const small = 1e-8;
  let e0 = 0.0;
  let m = 0.0;

  if (Math.abs(ecc) < small) {
    m = nu;
    e0 = nu;
  } else if (Math.abs(ecc - 1) < small) {
    e0 = Math.tan(0.5 * nu);
    m = e0 + (e0 * e0 * e0) / 3;
  } else if (ecc < 1.0) {
    const sine = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
    const cose = (ecc + Math.cos(nu)) / (1.0 + ecc * Math.cos(nu));

    e0 = Math.atan2(sine, cose);
    m = e0 - ecc * Math.sin(e0);
  } else {
    const nuW = Math.atan2(Math.sin(nu), Math.cos(nu));

    if (Math.abs(nuW) < Math.PI - Math.acos(1 / ecc)) {
      const sine = (Math.sqrt(ecc * ecc - 1) * Math.sin(nuW)) / (1 + ecc * Math.cos(nuW));

      e0 = Math.asinh(sine);
      m = ecc * Math.sinh(e0) - e0;
    }
  }
  if (ecc < 1.0 - small) {
    m -= Math.floor(m / (2 * Math.PI)) * (2 * Math.PI);
    if (m < 0.0) {
      m += 2.0 * Math.PI;
    }
    e0 -= Math.floor(e0 / (2 * Math.PI)) * (2 * Math.PI);
  }

  return { e0, m: m as Radians };
}

/**
 * Creates a 2D array with the specified number of rows and columns, filled with the same given value.
 * @template T The type of elements in the array.
 * @param rows The number of rows in the 2D array.
 * @param columns The number of columns in the 2D array.
 * @param value The value to fill the array with.
 * @returns The 2D array with the specified number of rows and columns, filled with the given value.
 */
export function array2d<T>(rows: number, columns: number, value: T): T[][] {
  const output: T[][] = [];

  for (let i = 0; i < rows; i++) {
    output.push(new Array(columns).fill(value));
  }

  return output;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param x The number to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 * @returns The clamped number.
 */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(x, max));
}

/**
 * Determines whether a given year is a leap year.
 * @param dateIn The date to check.
 * @returns `true` if the year is a leap year, `false` otherwise.
 */
export function isLeapYear(dateIn: Date): boolean {
  const year = dateIn.getUTCFullYear();

  if ((year & 3) !== 0) {
    return false;
  }

  return year % 100 !== 0 || year % 400 === 0;
}

/**
 * An array of the day of the year for each month.
 */
type MonthDaysArray = [number, number, number, number, number, number, number, number, number, number, number, number];

/**
 * Calculates the day of the year for a given date.
 * If no date is provided, the current date is used.
 *
 * This is sometimes referred to as the Jday, but is
 * very different from the Julian day used in astronomy.
 * @param date - The date for which to calculate the day of the year.
 * @returns The day of the year as a number.
 */
export function getDayOfYear(date = new Date()): number {
  const dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as MonthDaysArray;
  const mn = date.getUTCMonth() as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  const dn = date.getUTCDate();
  let dayOfYear = dayCount[mn] + dn;

  if (mn > 1 && isLeapYear(date)) {
    dayOfYear++;
  }

  return dayOfYear;
}

/**
 * Rounds a number to a specified number of decimal places.
 * @param value - The number to round.
 * @param places - The number of decimal places to round to.
 * @returns The rounded number.
 */
export function toPrecision(value: number, places: number): number {
  return Number(value.toFixed(places));
}

/**
 * Returns the sign of a number.
 * @param value - The number to determine the sign of.
 * @returns 1 if the number is positive, -1 if the number is negative.
 */
export function sign(value: number) {
  return value >= 0 ? 1 : -1;
}

const spaceObjTypeStrMap_ = {
  [SpaceObjectType.UNKNOWN]: 'Unknown',
  [SpaceObjectType.PAYLOAD]: 'Payload',
  [SpaceObjectType.ROCKET_BODY]: 'Rocket Body',
  [SpaceObjectType.DEBRIS]: 'Debris',
  [SpaceObjectType.SPECIAL]: 'Special',
  [SpaceObjectType.BALLISTIC_MISSILE]: 'Ballistic Missile',
  [SpaceObjectType.STAR]: 'Star',
  [SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION]: 'Intergovernmental Organization',
  [SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR]: 'Suborbital Payload Operator',
  [SpaceObjectType.PAYLOAD_OWNER]: 'Payload Owner',
  [SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER]:
    'Meteorological Rocket Launch Agency or Manufacturer',
  [SpaceObjectType.PAYLOAD_MANUFACTURER]: 'Payload Manufacturer',
  [SpaceObjectType.LAUNCH_AGENCY]: 'Launch Agency',
  [SpaceObjectType.LAUNCH_SITE]: 'Launch Site',
  [SpaceObjectType.LAUNCH_POSITION]: 'Launch Position',
  [SpaceObjectType.LAUNCH_FACILITY]: 'Launch Facility',
  [SpaceObjectType.CONTROL_FACILITY]: 'Control Facility',
  [SpaceObjectType.GROUND_SENSOR_STATION]: 'Ground Sensor Station',
  [SpaceObjectType.OPTICAL]: 'Optical',
  [SpaceObjectType.MECHANICAL]: 'Mechanical',
  [SpaceObjectType.PHASED_ARRAY_RADAR]: 'Phased Array Radar',
  [SpaceObjectType.OBSERVER]: 'Observer',
  [SpaceObjectType.BISTATIC_RADIO_TELESCOPE]: 'Bi-static Radio Telescope',
  [SpaceObjectType.COUNTRY]: 'Country',
  [SpaceObjectType.LAUNCH_VEHICLE_MANUFACTURER]: 'Launch Vehicle Manufacturer',
  [SpaceObjectType.ENGINE_MANUFACTURER]: 'Engine Manufacturer',
  [SpaceObjectType.NOTIONAL]: 'Notional',
  [SpaceObjectType.FRAGMENT]: 'Fragment',
  [SpaceObjectType.SHORT_TERM_FENCE]: 'Short Term Fence',
  [SpaceObjectType.EPHEMERIS_SATELLITE]: 'Ephemeris Satellite',
  [SpaceObjectType.TERRESTRIAL_PLANET]: 'Terrestrial Planet',
  [SpaceObjectType.GAS_GIANT]: 'Gas Giant',
  [SpaceObjectType.ICE_GIANT]: 'Ice Giant',
  [SpaceObjectType.DWARF_PLANET]: 'Dwarf Planet',
  [SpaceObjectType.MOON]: 'Moon',
  [SpaceObjectType.DYNAMIC_GROUND_OBJECT]: 'Dynamic Ground Object',
  [SpaceObjectType.ASTEROID]: 'Asteroid',
  [SpaceObjectType.MAX_SPACE_OBJECT_TYPE]: 'Max Space Object Type',
};

/**
 * Converts a SpaceObjectType to a string representation.
 * @param spaceObjType - The SpaceObjectType to convert.
 * @returns The string representation of the SpaceObjectType.
 */
export const spaceObjType2Str = (spaceObjType: SpaceObjectType): string =>
  spaceObjTypeStrMap_[spaceObjType] || 'Unknown';

/**
 * Calculates the Doppler factor for a given location, position, and velocity.
 * The Doppler factor is a measure of the change in frequency or wavelength of a wave
 * as observed by an observer moving relative to the source of the wave.
 *
 * Returns `1 - rangeRate / c`, so observed = transmitted * factor: above 1 while the
 * source approaches, below 1 while it recedes.
 *
 * All three vectors must be in the same inertial frame (TEME, as from `Satellite.eci()`
 * and `GroundObject.eci()`), despite the `EcefVec3` parameter types: the observer is
 * treated as Earth-fixed and its rotational velocity (omega x r) is subtracted here.
 * The observer position must be the WGS84 one that `rae()` uses; a spherical-Earth
 * observer (`lla2eci()`) sits ~20 km off at mid latitudes and skews the range rate by
 * up to ~0.2 km/s near closest approach.
 * @param location - The observer position (inertial frame, km).
 * @param position - The source position (inertial frame, km).
 * @param velocity - The source velocity (inertial frame, km/s).
 * @returns The calculated Doppler factor.
 */
export const dopplerFactor = (
  location: EcefVec3<Kilometers>,
  position: EcefVec3<Kilometers>,
  velocity: EcefVec3<KilometersPerSecond>,
): number => {
  const rangeX = position.x - location.x;
  const rangeY = position.y - location.y;
  const rangeZ = position.z - location.z;
  // Math.sqrt of the dot product beats Math.hypot: this is a hot path
  const distance = Math.sqrt(rangeX * rangeX + rangeY * rangeY + rangeZ * rangeZ);
  const rangeVelX = velocity.x + angularVelocityOfEarth * location.y;
  const rangeVelY = velocity.y - angularVelocityOfEarth * location.x;
  const rangeRate = (rangeX * rangeVelX + rangeY * rangeVelY + rangeZ * velocity.z) / distance;

  return 1 - rangeRate / cKmPerSec;
};

/**
 * Creates an array of numbers from start to stop (inclusive) with the specified step.
 * @param start The starting number.
 * @param stop The ending number.
 * @param step The step value.
 * @returns An array of numbers.
 */
export function createVec(start: number, stop: number, step: number): number[] {
  const array = [] as number[];

  for (let i = start; i <= stop; i += step) {
    array.push(i);
  }

  return array;
}


/**
 * Calculates the derivative of a differentiable function.
 * @param f The differentiable function.
 * @param h The step size for numerical differentiation. Default value is 1e-3.
 * @returns The derivative function.
 */
export function derivative(f: DifferentiableFunction, h = 1e-3): DifferentiableFunction {
  /**
   * @param x The value at which to calculate the derivative.
   * @returns The derivative of the function at the given value.
   */
  function df(x: number): number {
    const hh = h * 0.5;

    return (f(x + hh) - f(x - hh)) / h;
  }

  return df;
}
