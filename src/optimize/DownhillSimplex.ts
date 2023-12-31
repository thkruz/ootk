import { CostFunction, SimplexEntry } from './SimplexEntry';

// / Derivative-free Nelder-Mead simplex optimizer.
export class DownhillSimplex {
  private constructor() {
    // disable constructor
  }

  /**
   * Compute the centroid from a list of [SimplexEntry] objects, using cost
   * function [f].
   */
  private static _centroid(f: CostFunction, xss: SimplexEntry[]): SimplexEntry {
    const n = xss[0].points.length;
    const m = xss.length - 1;
    const output = new Float64Array(n);

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        output[j] += xss[i].points[j];
      }
    }
    for (let i = 0; i < n; i++) {
      output[i] /= m;
    }

    return new SimplexEntry(f, output);
  }

  private static _shrink(s: number, xss: SimplexEntry[]): void {
    const x1 = xss[0];

    for (let i = 1; i < xss.length; i++) {
      const xi = xss[i];

      xss[i] = x1.modify(s, xi, x1);
    }
  }

  /**
   * Generate a new simplex from initial guess [x0], and an optional
   * simplex [step] value.
   */
  static generateSimplex(x0: Float64Array, step = 0.01): Float64Array[] {
    const output: Float64Array[] = [x0.slice(0)];

    for (let i = 0; i < x0.length; i++) {
      const tmp = x0.slice(0);

      tmp[i] += tmp[i] * step;
      output.push(tmp);
    }

    return output;
  }

  /**
   * Perform derivative-free Nelder-Mead simplex optimization to minimize the
   * cost function [f] for the initial simplex [xs].
   *
   * Optional arguments:
   *  - `xTolerance`: centroid delta termination criteria
   * - `fTolerance`: cost function delta termination criteria
   * - `maxIter`: maximum number of optimization iterations
   * - `adaptive`: use adaptive coefficients if possible
   * - `printIter`: print a debug statement after each iteration
   */
  static solveSimplex(
    f: CostFunction,
    xs: Float64Array[],
    {
      xTolerance = 1e-12,
      fTolerance = 1e-12,
      maxIter = 10000,
      adaptive = false,
      printIter = false,
    }: {
      xTolerance?: number;
      fTolerance?: number;
      maxIter?: number;
      adaptive?: boolean;
      printIter?: boolean;
    },
  ): Float64Array {
    let a: number;
    let g: number;
    let p: number;
    let s: number;
    const n = xs.length - 1;

    if (adaptive && n >= 2) {
      a = 1.0;
      g = 1.0 + 2.0 / n;
      p = 0.75 - 1.0 / (2.0 * n);
      s = 1.0 - 1.0 / n;
    } else {
      a = 1.0;
      g = 2.0;
      p = 0.5;
      s = 0.5;
    }
    let iter = 0;
    let action = 'init';
    const ordered: SimplexEntry[] = [];

    for (const x of xs) {
      ordered.push(new SimplexEntry(f, x));
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      ordered.sort((x, y) => x.score - y.score);
      const x0 = DownhillSimplex._centroid(f, ordered);
      // update exit criterea
      let xd = 0.0;
      let fd = 0.0;

      for (let i = 1; i < ordered.length; i++) {
        xd = Math.max(xd, x0.distance(ordered[i]));
        fd = Math.max(fd, Math.abs(x0.score - ordered[i].score));
      }
      if (printIter) {
        // eslint-disable-next-line no-console
        console.log(`${iter}: score=${x0.score} xd=${xd} fd=${fd} [${action}]`);
      }
      if (iter !== 0 && (xd < xTolerance || fd < fTolerance)) {
        return ordered[0].points;
      }
      if (iter >= maxIter) {
        return ordered[0].points;
      }
      iter++;
      // reflection
      const xr = x0.modify(a, x0, ordered[ordered.length - 1]);

      if (ordered[0].score <= xr.score && xr.score < ordered[ordered.length - 2].score) {
        ordered[ordered.length - 1] = xr;
        action = 'reflect';
        continue;
      }
      // expansion
      if (xr.score < ordered[0].score) {
        const xe = x0.modify(g, xr, x0);

        if (xe.score < xr.score) {
          ordered[ordered.length - 1] = xe;
        } else {
          ordered[ordered.length - 1] = xr;
        }
        action = 'expand';
        continue;
      }
      // contraction
      if (xr.score < ordered[ordered.length - 1].score) {
        const xc = x0.modify(p, xr, x0);

        if (xc.score < xr.score) {
          ordered[ordered.length - 1] = xc;
          action = 'contract';
          continue;
        } else {
          DownhillSimplex._shrink(s, ordered);
          action = 'shrink';
          continue;
        }
      } else if (xr.score >= ordered[ordered.length - 1].score) {
        const xc = x0.modify(p, ordered[ordered.length - 1], x0);

        if (xc.score < ordered[ordered.length - 1].score) {
          ordered[ordered.length - 1] = xc;
          action = 'contract';
          continue;
        } else {
          DownhillSimplex._shrink(s, ordered);
          action = 'shrink';
          continue;
        }
      }
    }
  }
}
