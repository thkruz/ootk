import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { Matrix } from '../operations/Matrix';
import { RandomGaussianSource } from '../operations/RandomGaussianSource';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { Propagator } from '../propagator/Propagator';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD } from '../utils/constants';
import { array2d } from '../utils/functions';
import { Observation } from './Observation';
import { normalizeAngle, observationDerivative, observationNoiseFromSigmas } from './ObservationUtils';
import { PropagatorPairs } from './PropagatorPairs';
import { RAE } from './RAE';

// / Radar observation data.
export class ObservationRadar extends Observation {
  // / Create a new [ObservationRadar] object.
  constructor(private _site: J2000, public observation: RAE, private _noise: Matrix = ObservationRadar.defaultNoise) {
    super();
  }

  // / Default noise matrix.
  private static defaultNoise: Matrix = ObservationRadar.noiseFromSigmas(0.32, 0.015 * DEG2RAD, 0.015 * DEG2RAD);

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
    return Vector.fromList([this.observation.range, this.observation.azimuth, this.observation.elevation]);
  }

  clos(propagator: Propagator): number {
    const ri = propagator.propagate(this.epoch).position.subtract(this.site.position);

    return Math.abs(this.observation.range - ri.magnitude());
  }

  ricDiff(propagator: Propagator): Vector3D {
    const r0 = propagator.propagate(this.epoch);
    const r1 = RAE.fromStateVectors(r0, this.site);
    const r2 = this.observation.position(this.site, r1.azimuth, r1.elevation);

    return RIC.fromJ2000(new J2000(this.epoch, r2, Vector3D.origin), r0).position;
  }

  sample(random: RandomGaussianSource, sigma = 1.0): Observation {
    const result = this.sampleVector(random, sigma);

    return new ObservationRadar(
      this.site,
      new RAE(this.observation.epoch, result[0], result[1], result[2]),
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
      const ol = RAE.fromStateVectors(sl, this.site);
      const oh = RAE.fromStateVectors(sh, this.site);

      result[0][i] = observationDerivative(oh.range, ol.range, step);
      result[1][i] = observationDerivative(oh.azimuth, ol.azimuth, step, true);
      result[2][i] = observationDerivative(oh.elevation, ol.elevation, step, true);
    }

    return new Matrix(result);
  }

  residual(propagator: Propagator): Matrix {
    const result = array2d(3, 1, 0.0);
    const state = propagator.propagate(this.epoch);
    const razel = RAE.fromStateVectors(state, this.site);

    result[0][0] = this.observation.range - razel.range;
    result[1][0] = normalizeAngle(this.observation.azimuth, razel.azimuth);
    result[2][0] = normalizeAngle(this.observation.elevation, razel.elevation);

    return new Matrix(result);
  }

  /**
   * Create a noise matrix from the range, azimuth, and elevation standard
   * deviations _(kilometers/radians)_.
   */
  static noiseFromSigmas(rngSigma: number, azSigma: number, elSigma: number): Matrix {
    return observationNoiseFromSigmas([rngSigma, azSigma, elSigma]);
  }
}
