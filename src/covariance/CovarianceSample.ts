/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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
import {
  Epoch,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Matrix,
  OrbitRegime,
  RelativeState,
  RIC,
  Tle, Vec3Flat,
  Vector,
  Vector3D,
} from '../main.js';
import { ForceModel } from '../force/ForceModel.js';
import { Thrust } from '../force/Thrust.js';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator.js';
import { CovarianceFrame, StateCovariance } from './StateCovariance.js';

// / Sigma point covariance sample.
export class CovarianceSample {
  private readonly origin_: RungeKutta89Propagator;
  private readonly samples_: RungeKutta89Propagator[] = [];
  private readonly matrix_ = Matrix.zero(6, 12);

  /**
   * Create a new [CovarianceSample] object from an inertial state, covariance
   * and optional force models for the origin state and samples.
   *
   * Two-body physics will be used if a force model is not provided.
   * @param state The origin state.
   * @param covariance The covariance.
   * @param tle The TLE object.
   * @param originForceModel The force model for the origin state.
   * @param sampleForceModel The force model for the samples.
   */
  constructor(
    state: J2000, covariance: StateCovariance, tle?: Tle, originForceModel?: ForceModel, sampleForceModel?: ForceModel,
  ) {
    originForceModel ??= new ForceModel().setGravity();
    sampleForceModel ??= new ForceModel().setGravity();

    // Scale covariance using TLE quality and regime aging factor if TLE info is provided
    let scale = [1, 1, 1];

    if (tle) {
      const tleAgeDays = Tle.calcElsetAge(tle.line1, new Date(), 'days');

      const quality = this.evaluateTleQuality(tle);
      const aging = this.getRegimeAgingFactor(tle, tleAgeDays);

      scale = [
        quality[0] * aging[0],
        quality[1] * aging[1],
        quality[2] * aging[2],
      ];
    }

    this.origin_ = new RungeKutta89Propagator(state, originForceModel);
    const s = covariance.matrix.cholesky().elements;
    const sqrt6 = Math.sqrt(6.0);

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
      /*
       * Apply scale[0] to R, scale[1] to I, scale[2] to C (x, y, z)
       * Position: i = 0,1,2; Velocity: i = 3,4,5
       */
        const scaleIdx = i % 3;

        s[i][j] *= sqrt6 * scale[scaleIdx];
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

        this.samples_.push(new RungeKutta89Propagator(sample, sampleForceModel));
      } else if (covariance.frame === CovarianceFrame.RIC) {
        const sample = new RIC(sampleR, sampleV).toJ2000(state);

        this.samples_.push(new RungeKutta89Propagator(sample, sampleForceModel));
      }
    }
  }

  // / Current covariance sample epoch.
  get epoch(): Epoch {
    return this.origin_.state.epoch;
  }

  // / Current covariance sample origin state.
  get state(): J2000 {
    return this.origin_.state;
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
    this.origin_.propagate(epoch);
    for (const sample of this.samples_) {
      sample.propagate(epoch);
    }
  }

  // / Apply a maneuver to this covariance.
  maneuver(maneuver: Thrust): void {
    this.origin_.maneuver(maneuver);
    for (const sample of this.samples_) {
      sample.maneuver(maneuver);
    }
  }

  // / Desample covariance in J2000 frame.
  desampleJ2000(): StateCovariance {
    for (let i = 0; i < 12; i++) {
      const state = this.samples_[i].state;

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
    const rot = RelativeState.createMatrix(this.origin_.state.position, this.origin_.state.velocity);

    for (let i = 0; i < 12; i++) {
      const state = RIC.fromJ2000Matrix(this.samples_[i].state, this.origin_.state, rot);

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

  evaluateTleQuality(tle: Tle): Vec3Flat {
    let c = 1,
      i = 1,
      r = 1; // start with nominal 120 / 1000 / 100 m

    /* ---- Mean–motion first derivative (rev/day²) ---- */
    const mm1 = Math.abs(Tle.meanMoDev1(tle.line1));

    if (mm1 > 1e-3) { // clear manoeuvre or very low-drag orbit
      i *= 3.0;
      r *= 2.0;
      c *= 1.2;
    } else if (mm1 > 1e-5) { // high drag but likely passive
      i *= 1.6;
      r *= 1.3;
    }

    /* ---- BSTAR drag term ---- */
    const bstar = Math.abs(Tle.bstar(tle.line1));

    if (bstar > 5e-4) { // <≈400 km LEO
      i *= 1.5;
      r *= 1.5;
      c *= 1.1;
    } else if (bstar > 1e-4) { // 400–600 km
      i *= 1.2;
      r *= 1.2;
    }

    /* ---- Eccentricity ---- */
    const e = tle.eccentricity;

    if (e > 0.05) { // HEO, GTO, cubesat transfer, etc.
      r *= 1 + 6 * e;
      i *= 1 + 4 * e;
      c *= 1 + 1 * e;
    } else if (e > 0.02) { // mildly elliptical LEO/MEO
      r *= 1 + 3 * e;
      i *= 1 + 2 * e;
    }

    return [r, i, c];
  }

  getRegimeAgingFactor(tle: Tle, ageDays: number): Vec3Flat {
    const regime = tle.state.toClassicalElements().getOrbitRegime();
    const t = Math.max(ageDays, 0) ** 1.5; // non-linear growth

    switch (regime) {

      case OrbitRegime.LEO:
      // Target ~×2 (R), ×3 (I), ×2.2 (C) after 1 day
        return [1 + 1.0 * t, 1 + 2.0 * t, 1 + 1.2 * t];

      case OrbitRegime.MEO:
      // GNSS shells – slower growth
        return [1 + 0.4 * t, 1 + 0.9 * t, 1 + 0.6 * t];

      case OrbitRegime.GEO:
        return [1 + 0.2 * t, 1 + 0.5 * t, 1 + 0.3 * t];

      case OrbitRegime.HEO:
      // Highly elliptical transfer or Molniya
        return [1 + 1.2 * t, 1 + 2.4 * t, 1 + 1.4 * t];

      default:
        return [1 + 0.6 * t, 1 + 1.2 * t, 1 + 0.8 * t];
    }
  }
}
