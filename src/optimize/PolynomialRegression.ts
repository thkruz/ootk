/* eslint-disable require-jsdoc */
/* eslint-disable func-style */
import { evalPoly } from '../utils/functions';
import { DownhillSimplex } from './DownhillSimplex';
import { PolynomicalRegressionResult } from './PolynomicalRegressionResult';
// / Polynomial regression optimizer.
export class PolynomialRegression {
  private constructor() {
    // disable constructor
  }

  private static _bayesInformationCriterea(n: number, k: number, sse: number): number {
    return n * Math.log(sse) + k * Math.log(n);
  }

  /**
   * Optimize polynomial coefficients to fit data series [xs] and [ys] for the
   * provided polynomial [order].
   */
  static solve(
    xs: Float64Array,
    ys: Float64Array,
    order: number,
    { printIter = false }: { printIter?: boolean } = {},
  ): PolynomicalRegressionResult {
    const simplex = DownhillSimplex.generateSimplex(Float64Array.from(Array(order + 1).fill(1.0)));

    function f(coeffs: Float64Array): number {
      let sse = 0.0;

      for (let i = 0; i < xs.length; i++) {
        const diff = ys[i] - evalPoly(xs[i], coeffs);

        sse += diff * diff;
      }

      return sse;
    }

    const result = DownhillSimplex.solveSimplex(f, simplex, {
      adaptive: true,
      printIter,
    });
    const sse = f(result);

    return new PolynomicalRegressionResult(
      result,
      Math.sqrt(sse),
      PolynomialRegression._bayesInformationCriterea(xs.length, order, sse),
    );
  }

  /**
   * Optimize polynomial coefficients to fit data series [xs] and [ys], and
   * attempt to find an optimal order within the [minOrder] and
   * [maxOrder] bounds.
   */
  static solveOrder(
    xs: Float64Array,
    ys: Float64Array,
    minOrder: number,
    maxOrder: number,
    { printIter = false }: { printIter?: boolean } = {},
  ): PolynomicalRegressionResult {
    const cache: PolynomicalRegressionResult[] = [];

    for (let order = minOrder; order <= maxOrder; order++) {
      cache.push(PolynomialRegression.solve(xs, ys, order, { printIter }));
    }
    cache.sort((a, b) => a.bic - b.bic);

    return cache[0];
  }
}
