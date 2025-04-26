import { array2d, Matrix, Vector } from '../main.js';
import { JacobianFunction } from '../types/types.js';

/**
 * Calculates the Jacobian matrix of a given Jacobian function.
 *
 * The function calculates how small perturbations in each input variable affect all output variables,
 * using a second-order accurate central difference approximation.
 *
 * In orbital mechanics applications, this matrix is essential for solving complex problems like
 * orbit transfers, trajectory optimization, and precise orbital determination.
 * @param f The Jacobian function.
 * @param m The number of rows in the Jacobian matrix.
 * @param x0 The initial values of the variables.
 * @param step The step size for numerical differentiation (default: 1e-5).
 * @returns The Jacobian matrix.
 */
export const jacobian = (f: JacobianFunction, m: number, x0: Float64Array, step = 0.00001): Matrix => {
  const n = x0.length;
  const j = array2d(m, n, 0);
  const h = 0.5 * step;

  for (let k = 0; k < n; k++) {
    const xp = x0.slice();

    xp[k] += h;
    const fp = new Vector(f(xp));

    const xm = x0.slice();

    xm[k] -= h;
    const fm = new Vector(f(xm));

    const cd = fp.subtract(fm).scale(1 / step);

    for (let i = 0; i < m; i++) {
      j[i][k] = cd.elements[i];
    }
  }

  return new Matrix(j);
};
