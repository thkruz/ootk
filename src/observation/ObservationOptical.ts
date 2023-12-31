import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { deg2rad } from '../operations/constants';
import { array2d } from '../operations/functions';
import { Matrix } from '../operations/Matrix';
import { RandomGaussianSource } from '../operations/RandomGaussianSource';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { Propagator } from '../propagator/Propagator';
import { EpochUTC } from '../time/EpochUTC';
import { Observation } from './Observation';
import { normalizeAngle, observationDerivative, observationNoiseFromSigmas } from './ObservationUtils';
import { PropagatorPairs } from './PropagatorPairs';
import { RadecTopocentric } from './RadecTopocentric';

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
  static defaultNoise: Matrix = ObservationOptical.noiseFromSigmas(0.0037 * deg2rad, 0.003 * deg2rad);

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
