import { StateInterpolator } from '../interpolator/StateInterpolator';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { ChebyshevCoefficients } from './../interpolator/ChebyshevCoefficients';
import { ChebyshevInterpolator } from './../interpolator/ChebyshevInterpolator';

// / Ephemeris compressor.
export class ChebyshevCompressor {
  // / Create a new [ChebyshevCompressor] object from an [Interpolator].
  constructor(private _interpolator: StateInterpolator) {
    // Do nothing.
  }

  // / Return the cosine of π times [x].
  private static _cosPi(x: number): number {
    return Math.cos(Math.PI * x);
  }

  private _fitCoefficient(j: number, n: number, a: number, b: number): Vector3D {
    let sumX = 0.0;
    let sumY = 0.0;
    let sumZ = 0.0;
    const h = 0.5;

    for (let i = 0; i < n; i++) {
      const x = ChebyshevCompressor._cosPi((i + h) / n);
      const state = this._interpolator.interpolate(new EpochUTC(x * (h * (b - a)) + h * (b + a)))!;
      const fx = state.position.x;
      const fy = state.position.y;
      const fz = state.position.z;
      const nFac = ChebyshevCompressor._cosPi((j * (i + h)) / n);

      sumX += fx * nFac;
      sumY += fy * nFac;
      sumZ += fz * nFac;
    }

    return new Vector3D(sumX * (2 / n), sumY * (2 / n), sumZ * (2 / n));
  }

  private _fitWindow(coeffs: number, a: number, b: number): ChebyshevCoefficients {
    const cx = new Float64Array();
    const cy = new Float64Array();
    const cz = new Float64Array();

    for (let j = 0; j < coeffs; j++) {
      const result = this._fitCoefficient(j, coeffs, a, b);

      cx[j] = result.x;
      cy[j] = result.y;
      cz[j] = result.z;
    }

    return new ChebyshevCoefficients(a, b, cx, cy, cz);
  }

  /**
   * Compress this object's interpolater, using the provided coefficients
   * per revolution [cpr].
   */
  compress(cpr = 21): ChebyshevInterpolator {
    const { start, end } = this._interpolator.window();
    const period = this._interpolator.interpolate(start)!.period();
    const coefficients: ChebyshevCoefficients[] = [];
    let current = start;

    while (current < end) {
      const step = Math.min(period, end.posix - current.posix);
      const segment = current.roll(step);

      coefficients.push(this._fitWindow(cpr, current.posix, segment.posix));
      current = segment;
    }

    return new ChebyshevInterpolator(coefficients);
  }
}
