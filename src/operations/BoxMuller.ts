import { TAU } from '../utils/constants';
import { Random } from './Random';
import { Vector } from './Vector';

// / Box-Muller random Gaussian number generator.
export class BoxMuller {
  private _index = 0;
  private _cache = new Float64Array(2);
  // / Mean value.
  mu: number;
  // / Standard deviation.
  sigma: number;
  // / Uniform random number generator.
  rand: Random;

  /**
   * Create a new [BoxMuller] object with mean [mu], standard deviation
   * [sigma], and [seed] number.
   */
  constructor(mu: number, sigma: number, seed = 0) {
    this.mu = mu;
    this.sigma = sigma;
    this.rand = new Random(seed);
    this._generate();
  }

  // / Refill the cache with random Gaussian numbers.
  _generate() {
    this._index = 0;
    const u1 = this.rand.nextFloat();
    const u2 = this.rand.nextFloat();
    const mag = this.sigma * Math.sqrt(-2.0 * Math.log(u1));

    this._cache[0] = mag * Math.cos(TAU * u2) + this.mu;
    this._cache[1] = mag * Math.sin(TAU * u2) + this.mu;
  }

  /**
   * Generate a gaussian number, with mean [mu] and standard
   * deviation [sigma].
   */
  nextGauss(): number {
    if (this._index > 1) {
      this._generate();
    }
    const result = this._cache[this._index];

    this._index++;

    return result;
  }

  /**
   * Generate a [Vector] of gaussian numbers, with mean [mu] and standard
   * deviation [sigma].
   */
  gaussVector(n: number): Vector {
    const result = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      result[i] = this.nextGauss();
    }

    return new Vector(result);
  }
}
