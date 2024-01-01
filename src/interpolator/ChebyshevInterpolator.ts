import { EpochUTC } from '../time/EpochUTC';
import { EpochWindow } from '../time/EpochWindow';
import { J2000 } from './../coordinate/J2000';
import { ChebyshevCoefficients } from './ChebyshevCoefficients';
import { StateInterpolator } from './StateInterpolator';

/**
 * Compressed Chebyshev ephemeris interpolator.
 *
 * The ChebyshevInterpolator sacrifices state accuracy in order to gain
 * speed and memory requirements, so you can store many ephemerides in RAM
 * and interpolate through them quickly.
 *
 * Using more coefficients per revolution during lossy compression results
 * in increased accuracy and decreased performance.
 */
export class ChebyshevInterpolator extends StateInterpolator {
  private _coefficients: ChebyshevCoefficients[];

  constructor(coefficients: ChebyshevCoefficients[]) {
    super();
    this._coefficients = coefficients;
  }

  private _calcSizeBytes(): number {
    let output = 0;

    for (const coeffs of this._coefficients) {
      output += coeffs.sizeBytes;
    }

    return output;
  }

  get sizeBytes(): number {
    return this._calcSizeBytes();
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    const coeffs = this._matchCoefficients(epoch.posix);
    const { position: pos, velocity: vel } = coeffs.interpolate(epoch.posix);

    return new J2000(epoch, pos, vel);
  }

  window(): EpochWindow {
    return new EpochWindow(
      new EpochUTC(this._coefficients[0].a),
      new EpochUTC(this._coefficients[this._coefficients.length - 1].b),
    );
  }

  private _matchCoefficients(posix: number): ChebyshevCoefficients {
    let left = 0;
    let right = this._coefficients.length;

    while (left < right) {
      const middle = (left + right) >> 1;

      if (this._coefficients[middle].b < posix) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return this._coefficients[left];
  }
}
