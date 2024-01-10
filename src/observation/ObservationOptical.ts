/**
 * @author @thkruz Theodore Kruczek
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2024 Theodore Kruczek
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

import { array2d, DEG2RAD, EpochUTC, J2000, Matrix, RadecTopocentric, RIC, Vector, Vector3D } from 'ootk-core';
import { RandomGaussianSource } from '../operations/RandomGaussianSource';
import { Propagator } from '../propagator/Propagator';
import { Observation } from './Observation';
import { normalizeAngle, observationDerivative, observationNoiseFromSigmas } from './ObservationUtils';
import { PropagatorPairs } from './PropagatorPairs';

// / Optical observation data.
export class ObservationOptical extends Observation {
  // / Create a new [ObservationOptical] object.
  constructor(
    private _site: J2000,
    public observation: RadecTopocentric,
    private _noise: Matrix = ObservationOptical.defaultNoise,
  ) {
    super();
  }

  // / Inertial site location.
  get site(): J2000 {
    return this._site;
  }

  // / Noise matrix.
  get noise(): Matrix {
    return this._noise;
  }

  /**
   * Default noise matrix _(right-ascension, declination)_.
   * Based on the Maui Optical Site noise model.
   */
  static defaultNoise: Matrix = ObservationOptical.noiseFromSigmas(0.0037 * DEG2RAD, 0.003 * DEG2RAD);

  get epoch(): EpochUTC {
    return this.observation.epoch;
  }

  toVector(): Vector {
    return Vector.fromList([this.observation.rightAscension, this.observation.declination]);
  }

  clos(propagator: Propagator): number {
    const position = propagator.propagate(this.epoch).position;
    const offset = position.subtract(this.site.position);
    const actual = this.observation.lineOfSight().normalize();
    const expected = offset.normalize();
    const slantRange = offset.magnitude();
    const theta = actual.angle(expected);

    if (isNaN(theta)) {
      return 0.0;
    }

    return 2.0 * slantRange * Math.sin(theta * 0.5);
  }

  ricDiff(propagator: Propagator): Vector3D {
    const r0 = this.site;
    const r1 = propagator.propagate(this.epoch);
    const r2 = this.observation.position(this.site, r1.position.distance(r0.position));

    return RIC.fromJ2000(new J2000(this.epoch, r2, Vector3D.origin), r1).position;
  }

  sample(random: RandomGaussianSource, sigma = 1.0): Observation {
    const result = this.sampleVector(random, sigma);

    return new ObservationOptical(this.site, new RadecTopocentric(this.epoch, result[0], result[1]), this.noise);
  }

  jacobian(propPairs: PropagatorPairs): Matrix {
    const result = array2d(2, 6, 0.0);

    for (let i = 0; i < 6; i++) {
      const step = propPairs.step(i);
      const [high, low] = propPairs.get(i);
      const sl = low.propagate(this.epoch);
      const sh = high.propagate(this.epoch);
      const ol = RadecTopocentric.fromStateVectors(sl, this.site);
      const oh = RadecTopocentric.fromStateVectors(sh, this.site);

      result[0][i] = observationDerivative(oh.rightAscension, ol.rightAscension, step, true);
      result[1][i] = observationDerivative(oh.declination, ol.declination, step, true);
    }

    return new Matrix(result);
  }

  residual(propagator: Propagator): Matrix {
    const result = array2d(2, 1, 0.0);
    const state = propagator.propagate(this.epoch);
    const radec = RadecTopocentric.fromStateVectors(state, this.site);

    result[0][0] = normalizeAngle(this.observation.rightAscension, radec.rightAscension);
    result[1][0] = normalizeAngle(this.observation.declination, radec.declination);

    return new Matrix(result);
  }

  /**
   * Create a noise matrix from right ascension and declination standard
   * deviantions _(radians)_.
   */
  static noiseFromSigmas(raSigma: number, decSigma: number): Matrix {
    return observationNoiseFromSigmas([raSigma, decSigma]);
  }
}
