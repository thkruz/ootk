import { PolynomialRegression } from '../PolynomialRegression';

describe('PolynomialRegression', () => {
  it('should fit a quadratic polynomial to noisy position data', () => {
    const times = new Float64Array([0, 1, 2, 3, 4, 5]);
    const positions = new Float64Array([0.1, 1.9, 4.2, 8.8, 16.1, 25.3]);
    const result = PolynomialRegression.solve(times, positions, 2);

    expect(result.coefficients).toBeDefined();
    expect(result.coefficients.length).toBe(3); // a, b, c for ax² + bx + c
    expect(result.rss).toBeDefined();
    expect(result.bic).toBeDefined();
  });

  it('should automatically find optimal polynomial order', () => {
    const xs = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const ys = new Float64Array([1.2, 2.8, 5.1, 8.9, 14.2, 21.0, 29.8, 40.1, 52.0, 65.8]);
    const result = PolynomialRegression.solveOrder(xs, ys, 1, 4);

    expect(result.coefficients).toBeDefined();
    expect(result.coefficients.length).toBeGreaterThan(1); // At least linear
    expect(result.bic).toBeDefined();
  });
});
