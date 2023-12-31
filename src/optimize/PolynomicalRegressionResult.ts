// / Polynomial regression optimization result.
export class PolynomicalRegressionResult {
  /**
   * Create a new [PolynomicalRegressionResult] object, containing the
   * polynomial [coefficients], root-sum-squared error [rss], and Bayes
   * information criterea [bic].
   */
  constructor(public coefficients: Float64Array, public rss: number, public bic: number) {
    // Nothing to do here.
  }
}
