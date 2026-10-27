/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import type { Radians } from '../types/types';
import { Vector } from './Vector';
import { SingularMatrixError } from './SingularMatrixError';
import { Vector3D } from './Vector3D';

/**
 * A matrix is a rectangular array of numbers or other mathematical objects for
 * which operations such as addition and multiplication are defined.
 */
export class Matrix {
  elements: number[][];
  readonly rows: number;
  readonly columns: number;

  constructor(elements: number[][]) {
    this.elements = elements;
    this.rows = elements.length;
    this.columns = (elements[0]).length;
  }

  /**
   * Creates a matrix with all elements set to zero.
   * @param rows - The number of rows in the matrix.
   * @param columns - The number of columns in the matrix.
   * @returns A matrix with all elements set to zero.
   */
  static allZeros(rows: number, columns: number): Matrix {
    return this.fill(rows, columns, 0.0);
  }

  /**
   * Creates a new Matrix with the specified number of rows and columns, filled
   * with the specified value.
   * @param rows The number of rows in the matrix.
   * @param columns The number of columns in the matrix.
   * @param value The value to fill the matrix with. Default is 0.0.
   * @returns A new Matrix filled with the specified value.
   */
  static fill(rows: number, columns: number, value = 0.0): Matrix {
    const elements: number[][] = [];

    for (let i = 0; i < rows; i++) {
      elements[i] = [];
      for (let j = 0; j < columns; j++) {
        (elements[i])[j] = value;
      }
    }

    return new Matrix(elements);
  }

  /**
   * Creates a rotation matrix around the X-axis.
   * @param theta - The angle of rotation in radians.
   * @returns The rotation matrix.
   */
  static rotX(theta: Radians): Matrix {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const result = Matrix.zero(3, 3);

    (result.elements[0])[0] = 1.0;
    (result.elements[1])[1] = cosT;
    (result.elements[1])[2] = sinT;
    (result.elements[2])[1] = -sinT;
    (result.elements[2])[2] = cosT;

    return result;
  }

  /**
   * Creates a rotation matrix around the y-axis.
   * @param theta - The angle of rotation in radians.
   * @returns The rotation matrix.
   */
  static rotY(theta: Radians): Matrix {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const result = Matrix.zero(3, 3);

    (result.elements[0])[0] = cosT;
    (result.elements[0])[2] = -sinT;
    (result.elements[1])[1] = 1.0;
    (result.elements[2])[0] = sinT;
    (result.elements[2])[2] = cosT;

    return result;
  }

  /**
   * Creates a rotation matrix around the Z-axis.
   * @param theta The angle of rotation in radians.
   * @returns The rotation matrix.
   */
  static rotZ(theta: Radians): Matrix {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const result = Matrix.zero(3, 3);

    (result.elements[0])[0] = cosT;
    (result.elements[0])[1] = sinT;
    (result.elements[1])[0] = -sinT;
    (result.elements[1])[1] = cosT;
    (result.elements[2])[2] = 1.0;

    return result;
  }

  /**
   * Creates a zero matrix with the specified number of rows and columns.
   * @param rows The number of rows in the matrix.
   * @param columns The number of columns in the matrix.
   * @returns A new Matrix object representing the zero matrix.
   */
  static zero(rows: number, columns: number): Matrix {
    const elements: number[][] = [];

    for (let i = 0; i < rows; i++) {
      elements[i] = [];
      for (let j = 0; j < columns; j++) {
        (elements[i])[j] = 0.0;
      }
    }

    return new Matrix(elements);
  }

  /**
   * Creates an identity matrix of the specified dimension.
   * @param dimension The dimension of the identity matrix.
   * @returns The identity matrix.
   */
  static identity(dimension: number): Matrix {
    const elements: number[][] = [];

    for (let i = 0; i < dimension; i++) {
      elements[i] = [];
      for (let j = 0; j < dimension; j++) {
        (elements[i])[j] = i === j ? 1.0 : 0.0;
      }
    }

    return new Matrix(elements);
  }

  /**
   * Creates a diagonal matrix with the given diagonal elements.
   * @param d - An array of diagonal elements.
   * @returns A new Matrix object representing the diagonal matrix.
   */
  static diagonal(d: number[]): Matrix {
    const dimension = d.length;
    const elements: number[][] = [];

    for (let i = 0; i < dimension; i++) {
      elements[i] = [];
      for (let j = 0; j < dimension; j++) {
        (elements[i])[j] = i === j ? d[i] : 0.0;
      }
    }

    return new Matrix(elements);
  }

  /**
   * Adds the elements of another matrix to this matrix and returns the result.
   * @param m - The matrix to be added.
   * @returns The resulting matrix after addition.
   */
  add(m: Matrix): Matrix {
    const result = Matrix.zero(this.rows, this.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j]) + (m.elements[i]?.[j]);
      }
    }

    return result;
  }

  /**
   * Subtracts the elements of another matrix from this matrix.
   * @param m - The matrix to subtract.
   * @returns A new matrix containing the result of the subtraction.
   */
  subtract(m: Matrix): Matrix {
    const result = Matrix.zero(this.rows, this.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j]) - (m.elements[i]?.[j]);
      }
    }

    return result;
  }

  /**
   * Scales the matrix by multiplying each element by a scalar value.
   * @param n - The scalar value to multiply each element by.
   * @returns A new Matrix object representing the scaled matrix.
   */
  scale(n: number): Matrix {
    const result = Matrix.zero(this.rows, this.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j]) * n;
      }
    }

    return result;
  }

  /**
   * Negates the matrix by scaling it by -1.
   * @returns The negated matrix.
   */
  negate(): Matrix {
    return this.scale(-1);
  }

  /**
   * Multiplies this matrix with another matrix.
   * @param m The matrix to multiply with.
   * @returns The resulting matrix.
   */
  multiply(m: Matrix): Matrix {
    const result = Matrix.zero(this.rows, m.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < m.columns; j++) {
        for (let k = 0; k < this.columns; k++) {
          ((result.elements[i])[j]) +=
            (this.elements[i]?.[k]) * (m.elements[k]?.[j]);
        }
      }
    }

    return result;
  }

  /**
   * Computes the outer product of this matrix with another matrix.
   * @param m - The matrix to compute the outer product with.
   * @returns The resulting matrix.
   */
  outerProduct(m: Matrix): Matrix {
    const result = Matrix.zero(this.rows, this.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        (result.elements[i])[j] = (this.elements[i]?.[j]) * (m.elements[i]?.[j]);
      }
    }

    return result;
  }

  /**
   * Multiplies the matrix by a vector.
   * @param v The vector to multiply by.
   * @returns A new vector representing the result of the multiplication.
   */
  multiplyVector(v: Vector): Vector {
    const result: number[] = [];

    for (let i = 0; i < this.rows; i++) {
      let total = 0.0;

      for (let j = 0; j < this.columns; j++) {
        total += (this.elements[i]?.[j]) * (v.elements[j]);
      }
      result[i] = total;
    }

    return new Vector(result);
  }

  /**
   * Multiplies a 3D vector by the matrix.
   * @template T - The type of the vector elements.
   * @param v - The 3D vector to multiply.
   * @returns The resulting 3D vector after multiplication.
   */
  multiplyVector3D<T extends number>(v: Vector3D<T>): Vector3D<T> {
    const result: T[] = [];

    for (let i = 0; i < this.rows; i++) {
      let total = 0.0;

      for (let j = 0; j < this.columns; j++) {
        switch (j) {
          case 0:
            total += (this.elements[i]?.[j]) * v.x;
            break;
          case 1:
            total += (this.elements[i]?.[j]) * v.y;
            break;
          case 2:
            total += (this.elements[i]?.[j]) * v.z;
            break;
          default:
            break;
        }
      }
      result[i] = total as T;
    }

    return new Vector3D<T>((result[0]), (result[1]), (result[2]));
  }

  /**
   * Returns a new Matrix object where each element is the reciprocal of the
   * corresponding element in the current matrix. If an element in the current
   * matrix is zero, the corresponding element in the output matrix will also be
   * zero.
   * @returns A new Matrix object representing the reciprocal of the current
   * matrix.
   */
  reciprocal(): Matrix {
    const output = Matrix.zero(this.rows, this.columns);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        if ((this.elements[i]?.[j]) !== 0) {
          (output.elements[i])[j] = 1 / (this.elements[i]?.[j]);
        }
      }
    }

    return output;
  }

  /**
   * Transposes the matrix by swapping rows with columns.
   * @returns A new Matrix object representing the transposed matrix.
   */
  transpose(): Matrix {
    const result = Matrix.zero(this.columns, this.rows);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        (result.elements[j])[i] = (this.elements[i])[j];
      }
    }

    return result;
  }

  /**
   * Performs the Cholesky decomposition A = L * L^T of a symmetric positive
   * (semi-)definite matrix and returns the lower-triangular factor L.
   *
   * Uses the Cholesky-Banachiewicz row-by-row recurrence (Golub and Van Loan,
   * Matrix Computations, 4th ed., Algorithm 4.2.1):
   * L_kk = sqrt(A_kk - sum_{j<k} L_kj^2) and
   * L_ik = (A_ik - sum_{j<k} L_ij L_kj) / L_kk for i > k.
   *
   * Positive semi-definite input is accepted: a diagonal residual within
   * n * eps * max|A_ii| of zero is treated as exactly zero, and the column
   * below it is set to zero when its numerators are also within that
   * tolerance (so an all-zero covariance factors to an all-zero L).
   * @returns The lower-triangular Cholesky factor L, whose elements carry the
   * square root of the input units.
   * @throws {Error} If the matrix is not square, contains non-finite values, or
   * is not positive semi-definite (a negative diagonal residual, or a nonzero
   * entry in a column whose pivot is zero).
   */
  cholesky(): Matrix {
    if (this.rows !== this.columns) {
      throw new Error(`Matrix.cholesky: matrix must be square, got ${this.rows}x${this.columns}`);
    }
    const n = this.rows;
    const result = Matrix.zero(n, n);
    let maxDiag = 0;

    for (let i = 0; i < n; i++) {
      maxDiag = Math.max(maxDiag, Math.abs(this.elements[i][i]));
    }
    const tol = n * Number.EPSILON * maxDiag;

    for (let i = 0; i < n; i++) {
      for (let k = 0; k < i + 1; k++) {
        let total = 0.0;

        for (let j = 0; j < k; j++) {
          total += result.elements[i][j] * result.elements[k][j];
        }
        const residual = this.elements[i][k] - total;

        if (!Number.isFinite(residual)) {
          throw new Error('Matrix.cholesky: matrix contains non-finite values');
        }

        result.elements[i][k] = i === k
          ? Matrix.choleskyDiagonal_(residual, tol, i)
          : Matrix.choleskyOffDiagonal_(residual, result.elements[k][k], tol, k);
      }
    }

    return result;
  }

  /**
   * Diagonal Cholesky entry L_ii = sqrt(residual), with residuals within tol of
   * zero treated as exactly zero (positive semi-definite input).
   * @param residual A_ii - sum_{j<i} L_ij^2.
   * @param tol Round-off tolerance n * eps * max|A_ii|.
   * @param i Row index, for the error message.
   * @returns L_ii.
   */
  private static choleskyDiagonal_(residual: number, tol: number, i: number): number {
    if (residual < -tol) {
      throw new Error(`Matrix.cholesky: matrix is not positive semi-definite (pivot ${i} residual ${residual})`);
    }

    return residual > tol ? Math.sqrt(residual) : 0;
  }

  /**
   * Off-diagonal Cholesky entry L_ik = residual / L_kk. When L_kk is zero the
   * entry must itself be zero (to within tol) for a positive semi-definite
   * matrix, and is set to zero.
   * @param residual A_ik - sum_{j<k} L_ij L_kj.
   * @param lkk The diagonal entry L_kk.
   * @param tol Round-off tolerance n * eps * max|A_ii|.
   * @param k Column index, for the error message.
   * @returns L_ik.
   */
  private static choleskyOffDiagonal_(residual: number, lkk: number, tol: number, k: number): number {
    if (lkk !== 0) {
      return residual / lkk;
    }
    if (Math.abs(residual) > tol) {
      throw new Error(`Matrix.cholesky: matrix is not positive semi-definite (zero pivot ${k} with a nonzero column)`);
    }

    return 0;
  }

  /**
   * Calculates the inverse of a square matrix by Gauss-Jordan elimination with
   * partial (row) pivoting on an equilibrated copy of the matrix.
   *
   * Rows and then columns are scaled by exact powers of two so that every row
   * and column has a largest magnitude in [1, 2): B = R * A * C, so
   * inv(A) = C * inv(B) * R. This keeps the singularity test meaningful for
   * covariance-like matrices whose entries span many orders of magnitude.
   * At each step the remaining row with the largest magnitude in the pivot
   * column is swapped in (Golub and Van Loan, Matrix Computations, 4th ed.,
   * section 3.4), so a zero or tiny leading diagonal entry does not destroy
   * the result.
   *
   * The matrix is declared singular when a pivot of the equilibrated matrix is
   * not larger than n * eps, i.e. it is singular to double-precision working
   * accuracy.
   * @returns The inverse matrix.
   * @throws {SingularMatrixError} If the matrix is singular to working precision
   * or contains non-finite values.
   * @throws {Error} If the matrix is not square.
   * @see Matrix.tryInverse for a variant that returns null instead of throwing.
   */
  inverse(): Matrix {
    if (this.rows !== this.columns) {
      throw new Error(`Matrix.inverse: matrix must be square, got ${this.rows}x${this.columns}`);
    }
    const n = this.rows;
    const rowScale = new Array<number>(n).fill(1);
    const colScale = new Array<number>(n).fill(1);
    const a: number[][] = this.elements.map((row) => row.slice(0, n));

    // Row equilibration by powers of two (exact in floating point).
    for (let i = 0; i < n; i++) {
      let m = 0;

      for (let j = 0; j < n; j++) {
        m = Math.max(m, Math.abs(a[i][j]));
      }
      if (!Number.isFinite(m)) {
        throw new SingularMatrixError('Matrix.inverse: matrix contains non-finite values');
      }
      if (m === 0) {
        throw new SingularMatrixError(`Matrix.inverse: matrix is singular (row ${i} is zero)`);
      }
      rowScale[i] = Matrix.pow2Scale_(m);
      for (let j = 0; j < n; j++) {
        a[i][j] *= rowScale[i];
      }
    }
    // Column equilibration by powers of two.
    for (let j = 0; j < n; j++) {
      let m = 0;

      for (let i = 0; i < n; i++) {
        m = Math.max(m, Math.abs(a[i][j]));
      }
      if (m === 0) {
        throw new SingularMatrixError(`Matrix.inverse: matrix is singular (column ${j} is zero)`);
      }
      colScale[j] = Matrix.pow2Scale_(m);
      for (let i = 0; i < n; i++) {
        a[i][j] *= colScale[j];
      }
    }

    // Augment with the identity and run Gauss-Jordan with partial pivoting.
    const inv: number[][] = [];

    for (let i = 0; i < n; i++) {
      inv[i] = new Array<number>(n).fill(0);
      inv[i][i] = 1;
    }
    const tol = n * Number.EPSILON;

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let pivotMag = Math.abs(a[col][col]);

      for (let r = col + 1; r < n; r++) {
        const mag = Math.abs(a[r][col]);

        if (mag > pivotMag) {
          pivotMag = mag;
          pivotRow = r;
        }
      }
      if (!(pivotMag > tol)) {
        throw new SingularMatrixError(`Matrix.inverse: matrix is singular to working precision (pivot ${col} = ${pivotMag})`);
      }
      if (pivotRow !== col) {
        [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
        [inv[col], inv[pivotRow]] = [inv[pivotRow], inv[col]];
      }
      const pivot = a[col][col];

      for (let j = 0; j < n; j++) {
        a[col][j] /= pivot;
        inv[col][j] /= pivot;
      }
      for (let r = 0; r < n; r++) {
        if (r === col) {
          continue;
        }
        const f = a[r][col];

        if (f === 0) {
          continue;
        }
        for (let j = 0; j < n; j++) {
          a[r][j] -= f * a[col][j];
          inv[r][j] -= f * inv[col][j];
        }
      }
    }

    // Undo the equilibration: inv(A) = C * inv(B) * R.
    const out = Matrix.zero(n, n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        out.elements[i][j] = colScale[i] * inv[i][j] * rowScale[j];
      }
    }

    return out;
  }

  /**
   * Calculates the inverse of a square matrix, returning null instead of
   * throwing when the matrix is singular to working precision.
   * @returns The inverse matrix, or null if the matrix is singular.
   * @throws {Error} If the matrix is not square.
   * @see Matrix.inverse for the algorithm and the singularity criterion.
   */
  tryInverse(): Matrix | null {
    try {
      return this.inverse();
    } catch (e) {
      if (e instanceof SingularMatrixError) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Returns the power of two 2^-floor(log2(m)), so that m times the result
   * lies in [1, 2). Multiplying by a power of two is exact in IEEE 754
   * arithmetic (barring overflow or underflow).
   * @param m A positive finite magnitude.
   * @returns The power-of-two scale factor.
   */
  private static pow2Scale_(m: number): number {
    return 2 ** -Math.floor(Math.log2(m));
  }
}
