/**
 * A generator of random bool, int, or double values.
 *
 * The default implementation supplies a stream of pseudo-random bits that are not suitable for cryptographic purposes.
 */
export class Random {
  private _seed: number;

  constructor(seed = 0) {
    this._seed = seed;
  }

  nextFloat(max = 1): number {
    this._seed = (this._seed * 9301 + 49297) % 233280;

    return (this._seed / 233280) * max;
  }

  /**
   * To create a non-negative random integer uniformly distributed in the range from 0,
   * inclusive, to max, exclusive, use nextInt(int max).
   */
  nextInt(max = 1): number {
    return Math.round(this.nextFloat(max) * max);
  }
  nextBool(): boolean {
    return this.nextFloat() > 0.5;
  }
}
