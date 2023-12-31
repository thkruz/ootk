import { EpochUTC } from '../time/EpochUTC';

// / Exponential data smoothing methods.
export class ExponentialSmoothing {
  private constructor() {
    // disable constructor
  }

  /*
   * Perform exponential smoothing on data set [xs] using the provided
   * data smoothing factor [alpha] _(0.0 <= alpha <= 1.0)_.
   */
  static smooth(xs: number[], alpha: number): number[] {
    const ss: number[] = [];

    for (let i = 0; i < xs.length; i++) {
      if (i === 0) {
        ss.push(xs[0]);
      } else {
        ss.push(alpha * xs[i] + (1 - alpha) * ss[i - 1]);
      }
    }

    return ss;
  }

  /*
   * Perform exponential smoothing on data set [xs] using the provided data
   * smoothing factor [alpha] _(0.0 <= alpha <= 1.0)_ and trend smoothing
   * factor [beta] _(0.0 <= beta <= 1.0)_.
   */
  static smoothDouble(xs: number[], alpha: number, beta: number): number[] {
    const bs: number[] = [];
    const ss: number[] = [];

    for (let i = 0; i < xs.length; i++) {
      if (i === 0) {
        ss.push(xs[0]);
        bs.push(xs[1] - xs[0]);
      } else {
        ss.push(alpha * xs[i] + (1 - alpha) * (ss[i - 1] + bs[i - 1]));
        bs.push(beta * (ss[i] - ss[i - 1]) + (1 - beta) * bs[i - 1]);
      }
    }

    return ss;
  }

  /*
   * Perform exponential smoothing on time series data set [xs] correlated
   * with the [epochs] array using the provided [timeConstant]
   * value _(seconds)_.
   *
   * Note: the [timeConstant] is the amount of time for the smoothed response
   * of a unit step function to reach ~63.2% of the original signal.
   */
  static smoothTime(epochs: EpochUTC[], xs: number[], timeConstant: number): number[] {
    const ts = epochs.map((e) => e.posix);
    const ss: number[] = [];

    for (let i = 0; i < xs.length; i++) {
      if (i === 0) {
        ss.push(xs[0]);
      } else {
        const a = 1 - Math.exp(-(ts[i] - ts[i - 1]) / timeConstant);

        ss.push(a * xs[i] + (1 - a) * ss[i - 1]);
      }
    }

    return ss;
  }
}
