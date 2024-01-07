import { Matrix, Vector } from 'ootk-core';

/** Covariance Frame */
export enum CovarianceFrame {
  /** Earth-centered inertial */
  ECI = 'eci',
  /** Radial-Intrack-Crosstrack */
  RIC = 'ric',
}

// / State covariance.
export class StateCovariance {
  /**
   * Create a new [StateCovariance] object given its covariance [matrix] and
   * [CovarianceFrame].
   */
  constructor(public matrix: Matrix, public frame: CovarianceFrame) {
    // Nothing to do here.
  }

  // / Create a new [StateCovariance] object from 1-sigma values.
  static fromSigmas(sigmas: number[], frame: CovarianceFrame): StateCovariance {
    const n = sigmas.length;
    const output = Matrix.zero(n, n);

    for (let i = 0; i < n; i++) {
      output[i][i] = Math.max(sigmas[i] * sigmas[i], 1e-32);
    }

    return new StateCovariance(output, frame);
  }

  /**
   * Calculates the standard deviations (sigmas) of each element in the covariance matrix.
   *
   * @returns A vector containing the standard deviations of each element in the covariance matrix.
   */
  sigmas(): Vector {
    const c = this.matrix.columns;
    const result = new Float64Array(c);

    for (let i = 0; i < c; i++) {
      const variance = this.matrix[i][i];

      result[i] = Math.sqrt(variance);
    }

    return new Vector(result);
  }
}
