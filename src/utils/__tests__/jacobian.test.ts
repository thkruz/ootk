import { JacobianFunction } from '../../types/types';
import { jacobian } from '../jacobian';

describe('jacobian function', () => {
  it('should calculate the Jacobian matrix correctly for a simple function', () => {
    const f: JacobianFunction = (x) => new Float64Array([x[0] ** 2 + x[1], x[0] + x[1] ** 2]);
    const m = 2; // Number of output variables
    const x0 = new Float64Array([1.0, 2.0]);
    const expectedJacobian = [
      [2 * x0[0], 1],
      [1, 2 * x0[1]],
    ];

    const result = jacobian(f, m, x0);

    expectedJacobian.forEach((row, i) => {
      row.forEach((value, j) => {
        expect(result.elements[i][j]).toBeCloseTo(value, 5);
      });
    });
  });

  it('should handle zero step size gracefully', () => {
    const f: JacobianFunction = (x) => new Float64Array([x[0] + x[1], x[0] * x[1]]);
    const m = 2;
    const x0 = new Float64Array([1.0, 1.0]); // Corrected type to Float64Array

    const result = jacobian(f, m, x0, 0);

    /*
     * When step is 0, the Jacobian function will return NaN due to division by zero.
     * This test should verify that the function handles this gracefully,
     * by returning a matrix of NaNs.
     */
    expect(result.elements[0][0]).toBeNaN();
  });
});
