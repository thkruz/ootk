import { DifferentiableFunction } from '../operations/functions';

// / Golden Section bounded single value optimizer.
export class GoldenSection {
  private static readonly _grInv: number = 1.0 / (0.5 * (Math.sqrt(5) + 1));

  private static _check(fc: number, fd: number, solveMax: boolean): boolean {
    return solveMax ? fc > fd : fc < fd;
  }

  /**
   * Search for an optimal input value for function [f] that minimizes the
   * output value.
   *
   * Takes [lower] and [upper] input search bounds, and an optional
   * search [tolerance].
   */
  static search(
    f: DifferentiableFunction,
    lower: number,
    upper: number,
    {
      tolerance = 1e-5,
      solveMax = false,
    }: {
      tolerance?: number;
      solveMax?: boolean;
    },
  ): number {
    let a = lower;
    let b = upper;
    let c = b - (b - a) * GoldenSection._grInv;
    let d = a + (b - a) * GoldenSection._grInv;

    while (Math.abs(b - a) > tolerance) {
      if (GoldenSection._check(f(c), f(d), solveMax)) {
        b = d;
      } else {
        a = c;
      }
      c = b - (b - a) * GoldenSection._grInv;
      d = a + (b - a) * GoldenSection._grInv;
    }

    return 0.5 * (b + a);
  }
}
