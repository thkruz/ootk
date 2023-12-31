/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
import { Matrix } from './Matrix';
import { Vector } from './Vector';

export type DifferentiableFunction = (x: number) => number;
export type JacobianFunction = (xs: Float64Array) => Float64Array;

export enum AngularDistanceMethod {
  Cosine,
  Haversine,
}

export enum AngularDiameterMethod {
  Circle,
  Sphere,
}

export function factorial(n: number): number {
  const nAbs = Math.abs(n);
  let result = 1;

  for (let i = 2; i <= nAbs; i++) {
    result *= i;
  }

  return result;
}

export function log10(x: number): number {
  return Math.log(x) / Math.LN10;
}

export function cbrt(n: number): number {
  return n ** (1 / 3);
}

export function sinh(x: number): number {
  return 0.5 * (Math.exp(x) - Math.exp(-x));
}

export function cosh(x: number): number {
  return 0.5 * (Math.exp(x) + Math.exp(-x));
}

export function tanh(x: number): number {
  return sinh(x) / cosh(x);
}

export function coth(x: number): number {
  return cosh(x) / sinh(x);
}

export function sech(x: number): number {
  return 1 / cosh(x);
}

export function csch(x: number): number {
  return 1 / sinh(x);
}

export function asinh(x: number): number {
  return Math.log(x + Math.sqrt(x * x + 1));
}

export function acosh(x: number): number {
  return Math.log(x + Math.sqrt(x * x - 1));
}

export function atanh(x: number): number {
  return 0.5 * Math.log((1 + x) / (1 - x));
}

export function acsch(x: number): number {
  return Math.log(1 / x + Math.sqrt(1 / (x * x) + 1));
}

export function asech(x: number): number {
  return Math.log(1 / x + Math.sqrt(1 / (x * x) - 1));
}

export function acoth(x: number): number {
  return 0.5 * Math.log((x + 1) / (x - 1));
}

export function copySign(mag: number, sgn: number): number {
  return Math.abs(mag) * Math.sign(sgn);
}

export function evalPoly(x: number, coeffs: Float64Array): number {
  let result = coeffs[0];

  for (let i = 1; i < coeffs.length; i++) {
    result = result * x + coeffs[i];
  }

  return result;
}

export function concat(a: Float64Array, b: Float64Array): Float64Array {
  const result = new Float64Array(a.length + b.length);

  result.set(a);
  result.set(b, a.length);

  return result;
}

export function matchHalfPlane(angle: number, match: number): number {
  const a1 = angle;
  const a2 = 2 * Math.PI - angle;
  const d1 = Math.atan2(Math.sin(a1 - match), Math.cos(a1 - match));
  const d2 = Math.atan2(Math.sin(a2 - match), Math.cos(a2 - match));

  return Math.abs(d1) < Math.abs(d2) ? a1 : a2;
}

export function wrapAngle(theta: number): number {
  const result = ((theta + Math.PI) % (2 * Math.PI)) - Math.PI;

  if (result === -Math.PI) {
    return Math.PI;
  }

  return result;
}

export function angularDistanceCosine(lam1: number, phi1: number, lam2: number, phi2: number): number {
  const a = Math.sin(phi1) * Math.sin(phi2);
  const b = Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);

  return Math.acos(a + b);
}

export function angularDistanceHaversine(lam1: number, phi1: number, lam2: number, phi2: number): number {
  const dlam = lam2 - lam1;
  const dphi = phi2 - phi1;
  const sdlam = Math.sin(0.5 * dlam);
  const sdphi = Math.sin(0.5 * dphi);
  const a = sdphi * sdphi + Math.cos(phi1) * Math.cos(phi2) * sdlam * sdlam;

  return 2.0 * Math.asin(Math.min(1.0, Math.sqrt(a)));
}

export function angularDistance(
  lam1: number,
  phi1: number,
  lam2: number,
  phi2: number,
  method: AngularDistanceMethod = AngularDistanceMethod.Cosine,
): number {
  switch (method) {
    case AngularDistanceMethod.Cosine:
      return angularDistanceCosine(lam1, phi1, lam2, phi2);
    case AngularDistanceMethod.Haversine:
      return angularDistanceHaversine(lam1, phi1, lam2, phi2);
    default:
      throw new Error('Invalid angular distance method.');
  }
}

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

export function linearInterpolate(x: number, x0: number, y0: number, x1: number, y1: number): number {
  return (y0 * (x1 - x) + y1 * (x - x0)) / (x1 - x0);
}

export function mean(values: number[]): number {
  const n = values.length;
  let sum = 0.0;

  for (const v of values) {
    sum += v;
  }

  return sum / n;
}

export function standardDeviation(values: number[], isSample = false): number {
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

export function derivative(f: DifferentiableFunction, h = 1e-3): DifferentiableFunction {
  function df(x: number): number {
    const hh = h * 0.5;

    return (f(x + hh) - f(x - hh)) / h;
  }

  return df;
}

export function gamma(n: number): number {
  return factorial(n - 1);
}

export function newtonM(ecc: number, m: number): { e0: number; nu: number } {
  const numiter = 50;
  const small = 1e-8;
  let e0;
  let nu;

  if (ecc > small) {
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
    const sinv = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(e1)) / (1.0 - ecc * Math.cos(e1));
    const cosv = (Math.cos(e1) - ecc) / (1.0 - ecc * Math.cos(e1));

    nu = Math.atan2(sinv, cosv);
  } else {
    nu = m;
    e0 = m;
  }

  return { e0, nu };
}

export function newtonNu(ecc: number, nu: number): { e0: number; m: number } {
  const small = 1e-8;
  let e0 = 0.0;
  let m = 0.0;

  if (Math.abs(ecc) < small) {
    m = nu;
    e0 = nu;
  } else if (ecc < 1.0 - small) {
    const sine = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
    const cose = (ecc + Math.cos(nu)) / (1.0 + ecc * Math.cos(nu));

    e0 = Math.atan2(sine, cose);
    m = e0 - ecc * Math.sin(e0);
  }
  if (ecc < 1.0) {
    m -= Math.floor(m / (2 * Math.PI)) * (2 * Math.PI);
    if (m < 0.0) {
      m += 2.0 * Math.PI;
    }
    e0 -= Math.floor(e0 / (2 * Math.PI)) * (2 * Math.PI);
  }

  return { e0, m };
}

export function array2d<T>(rows: number, columns: number, value: T): T[][] {
  const output: T[][] = [];

  for (let i = 0; i < rows; i++) {
    output.push(Array(columns).fill(value));
  }

  return output;
}

export function jacobian(f: JacobianFunction, m: number, x0: Float64Array, step = 1e-5): Matrix {
  const n = x0.length;
  const j = array2d(m, n, 0.0);
  const h = 0.5 * step;

  for (let k = 0; k < n; k++) {
    const xp = x0.slice();

    xp[k] += h;
    const fp = new Vector(f(xp));

    const xm = x0.slice();

    xm[k] -= h;
    const fm = new Vector(f(xm));

    const cd = fp.subtract(fm).scale(1.0 / step);

    for (let i = 0; i < m; i++) {
      j[i][k] = cd[i];
    }
  }

  return new Matrix(j);
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
