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


import { DEG2RAD, EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, RIC, Radians, Vector, Vector3D, array2d } from '../main.js';
import { RandomGaussianSource } from '../operations/RandomGaussianSource.js';
import { Propagator } from '../propagator/Propagator.js';
import { Observation } from './Observation.js';
import { normalizeAngle, observationDerivative, observationNoiseFromSigmas } from './ObservationUtils.js';
import { PropagatorPairs } from './PropagatorPairs.js';
import { RAE } from './RAE.js';

// / Radar observation data.
export class ObservationRadar extends Observation {
  // / Create a new [ObservationRadar] object.
  constructor(private _site: J2000, public observation: RAE, private _noise: Matrix = ObservationRadar.defaultNoise) {
    super();
  }

  // / Default noise matrix.
  private static defaultNoise: Matrix =
    ObservationRadar.noiseFromSigmas(0.32 as Kilometers, 0.015 * DEG2RAD as Radians, 0.015 * DEG2RAD as Radians);

  get epoch(): EpochUTC {
    return this.observation.epoch;
  }

  get site(): J2000 {
    return this._site;
  }

  get noise(): Matrix {
    return this._noise;
  }

  toVector(): Vector {
    return Vector.fromList([this.observation.rng, this.observation.azRad, this.observation.elRad]);
  }

  clos(propagator: Propagator): number {
    const ri = propagator.propagate(this.epoch).position.subtract(this.site.position);

    return Math.abs(this.observation.rng - ri.magnitude());
  }

  ricDiff(propagator: Propagator): Vector3D {
    const r0 = propagator.propagate(this.epoch);
    const r1 = RAE.fromStateVector(r0, this.site);
    const r2 = this.observation.position(this.site, r1.azRad, r1.elRad);

    return RIC.fromJ2000(new J2000(this.epoch, r2, Vector3D.origin as Vector3D<KilometersPerSecond>), r0).position;
  }

  sample(random: RandomGaussianSource, sigma = 1.0): Observation {
    const result = this.sampleVector(random, sigma).elements;

    return new ObservationRadar(
      this.site,
      new RAE(this.observation.epoch, result[0] as Kilometers, result[1] as Radians, result[2] as Radians),
      this.noise,
    );
  }

  jacobian(propPairs: PropagatorPairs): Matrix {
    const result = array2d(3, 6, 0.0);

    for (let i = 0; i < 6; i++) {
      const step = propPairs.step(i);
      const [high, low] = propPairs.get(i);
      const sl = low.propagate(this.epoch);
      const sh = high.propagate(this.epoch);
      const ol = RAE.fromStateVector(sl, this.site);
      const oh = RAE.fromStateVector(sh, this.site);

      result[0][i] = observationDerivative(oh.rng, ol.rng, step);
      result[1][i] = observationDerivative(oh.azRad, ol.azRad, step, true);
      result[2][i] = observationDerivative(oh.elRad, ol.elRad, step, true);
    }

    return new Matrix(result);
  }

  residual(propagator: Propagator): Matrix {
    const result = array2d(3, 1, 0.0);
    const state = propagator.propagate(this.epoch);
    const razel = RAE.fromStateVector(state, this.site);

    result[0][0] = this.observation.rng - razel.rng;
    result[1][0] = normalizeAngle(this.observation.azRad, razel.azRad);
    result[2][0] = normalizeAngle(this.observation.elRad, razel.elRad);

    return new Matrix(result);
  }

  /**
   * Create a noise matrix from the range, azimuth, and elevation standard
   * deviations _(kilometers/radians)_.
   * @param rngSigma - The range standard deviation _(kilometers)_.
   * @param azSigma - The azimuth standard deviation _(radians)_.
   * @param elSigma - The elevation standard deviation _(radians)_.
   * @returns The noise matrix.
   */
  static noiseFromSigmas(rngSigma: Kilometers, azSigma: Radians, elSigma: Radians): Matrix {
    return observationNoiseFromSigmas([rngSigma, azSigma, elSigma]);
  }
}
