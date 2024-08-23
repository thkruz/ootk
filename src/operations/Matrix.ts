/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { Radians, Vector, Vector3D } from '../main.js';

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
    this.columns = elements[0].length;
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
        elements[i][j] = value;
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

    result.elements[0][0] = 1.0;
    result.elements[1][1] = cosT;
    result.elements[1][2] = sinT;
    result.elements[2][1] = -sinT;
    result.elements[2][2] = cosT;

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

    result.elements[0][0] = cosT;
    result.elements[0][2] = -sinT;
    result.elements[1][1] = 1.0;
    result.elements[2][0] = sinT;
    result.elements[2][2] = cosT;

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

    result.elements[0][0] = cosT;
    result.elements[0][1] = sinT;
    result.elements[1][0] = -sinT;
    result.elements[1][1] = cosT;
    result.elements[2][2] = 1.0;

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
        elements[i][j] = 0.0;
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
        elements[i][j] = i === j ? 1.0 : 0.0;
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
        elements[i][j] = i === j ? d[i] : 0.0;
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
        result.elements[i][j] = this.elements[i][j] + m.elements[i][j];
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
        result.elements[i][j] = this.elements[i][j] - m.elements[i][j];
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
        result.elements[i][j] = this.elements[i][j] * n;
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
          result.elements[i][j] += this.elements[i][k] * m.elements[k][j];
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
        result.elements[i][j] = this.elements[i][j] * m.elements[i][j];
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
        total += this.elements[i][j] * v.elements[j];
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
            total += this.elements[i][j] * v.x;
            break;
          case 1:
            total += this.elements[i][j] * v.y;
            break;
          case 2:
            total += this.elements[i][j] * v.z;
            break;
          default:
            break;
        }
      }
      result[i] = total as T;
    }

    return new Vector3D<T>(result[0], result[1], result[2]);
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
        if (this.elements[i][j] !== 0) {
          output.elements[i][j] = 1 / this.elements[i][j];
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
        result.elements[j][i] = this.elements[i][j];
      }
    }

    return result;
  }

  /**
   * Performs the Cholesky decomposition on the matrix.
   * @returns A new Matrix object representing the Cholesky decomposition of the
   * original matrix.
   */
  cholesky(): Matrix {
    const result = Matrix.zero(this.rows, this.rows);

    for (let i = 0; i < this.rows; i++) {
      for (let k = 0; k < i + 1; k++) {
        let total = 0.0;

        for (let j = 0; j < k; j++) {
          total += result.elements[i][j] * result.elements[k][j];
        }
        result.elements[i][k] =
          i === k
            ? Math.sqrt(this.elements[i][i] - total)
            : (1 / result.elements[k][k]) * (this.elements[i][k] - total);
      }
    }

    return result;
  }

  /**
   * Swaps two rows in the matrix.
   * @param i - The index of the first row.
   * @param j - The index of the second row.
   */
  private _swapRows(i: number, j: number): void {
    if (i === j) {
      return;
    }
    const tmp = this.elements[i];

    this.elements[i] = this.elements[j];
    this.elements[j] = tmp;
  }

  /**
   * Converts the matrix to reduced row echelon form using the Gaussian
   * elimination method. This method modifies the matrix in-place.
   */
  private _toReducedRowEchelonForm(): void {
    for (let lead = 0, row = 0; row < this.rows && lead < this.columns; ++row, ++lead) {
      let i = row;

      while (this.elements[i][lead] === 0) {
        if (++i === this.rows) {
          i = row;
          if (++lead === this.columns) {
            return;
          }
        }
      }
      this._swapRows(i, row);
      if (this.elements[row][lead] !== 0) {
        const f = this.elements[row][lead];

        for (let column = 0; column < this.columns; ++column) {
          this.elements[row][column] /= f;
        }
      }
      for (let j = 0; j < this.rows; ++j) {
        if (j === row) {
          continue;
        }
        const f = this.elements[j][lead];

        for (let column = 0; column < this.columns; ++column) {
          this.elements[j][column] -= f * this.elements[row][column];
        }
      }
    }
  }

  /**
   * Calculates the inverse of the matrix.
   * @returns The inverse of the matrix.
   */
  inverse(): Matrix {
    const tmp = Matrix.zero(this.rows, this.columns * 2);

    for (let row = 0; row < this.rows; ++row) {
      for (let column = 0; column < this.columns; ++column) {
        tmp.elements[row][column] = this.elements[row][column];
      }
      tmp.elements[row][row + this.columns] = 1.0;
    }
    tmp._toReducedRowEchelonForm();
    const inv = Matrix.zero(this.rows, this.columns);

    for (let row = 0; row < this.rows; ++row) {
      for (let column = 0; column < this.columns; ++column) {
        inv.elements[row][column] = tmp.elements[row][column + this.columns];
      }
    }

    return inv;
  }
}
