/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

/* eslint-disable class-methods-use-this */

import { ForceModel } from '../force/ForceModel.js';
import { Thrust } from '../force/Thrust.js';
import { Epoch, EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, RelativeState, RIC, Vector, Vector3D } from '../main.js';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator.js';
import { CovarianceFrame, StateCovariance } from './StateCovariance.js';

// / Sigma point covariance sample.
export class CovarianceSample {
  private _origin: RungeKutta89Propagator;
  private _samples: RungeKutta89Propagator[] = [];
  private matrix_ = Matrix.zero(6, 12);

  /**
   * Create a new [CovarianceSample] object from an inertial state, covariance
   * and optional force models for the origin state and samples.
   *
   * Two-body physics will be used if a force model is not provided.
   * @param state The origin state.
   * @param covariance The covariance.
   * @param originForceModel The force model for the origin state.
   * @param sampleForceModel The force model for the samples.
   */
  constructor(state: J2000, covariance: StateCovariance, originForceModel?: ForceModel, sampleForceModel?: ForceModel) {
    originForceModel ??= new ForceModel().setGravity();
    sampleForceModel ??= new ForceModel().setGravity();
    this._origin = new RungeKutta89Propagator(state, originForceModel);
    const s = covariance.matrix.cholesky().elements;
    const sqrt6 = Math.sqrt(6.0);

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        s[i][j] *= sqrt6;
      }
    }

    // 6 x 12 matrix
    const sigmapts = Matrix.zero(6, 12).elements;

    for (let i = 0; i < 6; i++) {
      const jj = (i - 1) * 2 + 2;

      for (let j = 0; j < 3; j++) {
        sigmapts[j][jj] = s[j][i];
        sigmapts[j + 3][jj] = s[j + 3][i];

        sigmapts[j][jj + 1] = -s[j][i];
        sigmapts[j + 3][jj + 1] = -s[j + 3][i];
      }
    }

    for (let i = 0; i < 12; i++) {
      const sampleR = new Vector3D(
        sigmapts[0][i] as Kilometers,
        sigmapts[1][i] as Kilometers,
        sigmapts[2][i] as Kilometers,
      );
      const sampleV = new Vector3D(
        sigmapts[3][i] as KilometersPerSecond,
        sigmapts[4][i] as KilometersPerSecond,
        sigmapts[5][i] as KilometersPerSecond,
      );

      if (covariance.frame === CovarianceFrame.ECI) {
        const sample = new J2000(state.epoch, state.position.add(sampleR), state.velocity.add(sampleV));

        this._samples.push(new RungeKutta89Propagator(sample, sampleForceModel));
      } else if (covariance.frame === CovarianceFrame.RIC) {
        const sample = new RIC(sampleR, sampleV).toJ2000(state);

        this._samples.push(new RungeKutta89Propagator(sample, sampleForceModel));
      }
    }
  }

  // / Current covariance sample epoch.
  get epoch(): Epoch {
    return this._origin.state.epoch;
  }

  // / Current covariance sample origin state.
  get state(): J2000 {
    return this._origin.state;
  }

  // / Rebuild covariance from sigma points.
  private _rebuildCovariance(matrix: Matrix): Matrix {
    const pts = matrix.elements;
    const c = 1.0 / 12.0;
    const yu = new Vector([0, 0, 0, 0, 0, 0]).elements;
    const y = Matrix.zero(6, 12);

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 6; j++) {
        yu[j] += pts[j][i];
      }
    }

    for (let j = 0; j < 6; j++) {
      yu[j] *= c;
    }

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 6; j++) {
        y.elements[j][i] = pts[j][i] - yu[j];
      }
    }

    const yt = y.transpose();
    const tmp = y.multiply(yt);

    return tmp.scale(c);
  }

  // / Propagate covariance to a new epoch.
  propagate(epoch: EpochUTC): void {
    this._origin.propagate(epoch);
    for (const sample of this._samples) {
      sample.propagate(epoch);
    }
  }

  // / Apply a maneuver to this covariance.
  maneuver(maneuver: Thrust): void {
    this._origin.maneuver(maneuver);
    for (const sample of this._samples) {
      sample.maneuver(maneuver);
    }
  }

  // / Desample covariance in J2000 frame.
  desampleJ2000(): StateCovariance {
    for (let i = 0; i < 12; i++) {
      const state = this._samples[i].state;

      this.matrix_.elements[0][i] = state.position.x;
      this.matrix_.elements[1][i] = state.position.y;
      this.matrix_.elements[2][i] = state.position.z;
      this.matrix_.elements[3][i] = state.velocity.x;
      this.matrix_.elements[4][i] = state.velocity.y;
      this.matrix_.elements[5][i] = state.velocity.z;
    }
    const matrix = this._rebuildCovariance(this.matrix_);

    return new StateCovariance(matrix, CovarianceFrame.ECI);
  }

  // / Desample covariance in RIC frame.
  desampleRIC(): StateCovariance {
    const rot = RelativeState.createMatrix(this._origin.state.position, this._origin.state.velocity);

    for (let i = 0; i < 12; i++) {
      const state = RIC.fromJ2000Matrix(this._samples[i].state, this._origin.state, rot);

      this.matrix_.elements[0][i] = state.position.x;
      this.matrix_.elements[1][i] = state.position.y;
      this.matrix_.elements[2][i] = state.position.z;
      this.matrix_.elements[3][i] = state.velocity.x;
      this.matrix_.elements[4][i] = state.velocity.y;
      this.matrix_.elements[5][i] = state.velocity.z;
    }
    const matrix = this._rebuildCovariance(this.matrix_);

    return new StateCovariance(matrix, CovarianceFrame.RIC);
  }
}
