/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Vector3D, Vector, Radians } from '../main.js';

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
    this.columns = (elements[0] as number[]).length;
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
        (elements[i] as number[])[j] = value;
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

    (result.elements[0] as number[])[0] = 1.0;
    (result.elements[1] as number[])[1] = cosT;
    (result.elements[1] as number[])[2] = sinT;
    (result.elements[2] as number[])[1] = -sinT;
    (result.elements[2] as number[])[2] = cosT;

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

    (result.elements[0] as number[])[0] = cosT;
    (result.elements[0] as number[])[2] = -sinT;
    (result.elements[1] as number[])[1] = 1.0;
    (result.elements[2] as number[])[0] = sinT;
    (result.elements[2] as number[])[2] = cosT;

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

    (result.elements[0] as number[])[0] = cosT;
    (result.elements[0] as number[])[1] = sinT;
    (result.elements[1] as number[])[0] = -sinT;
    (result.elements[1] as number[])[1] = cosT;
    (result.elements[2] as number[])[2] = 1.0;

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
        (elements[i] as number[])[j] = 0.0;
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
        (elements[i] as number[])[j] = i === j ? 1.0 : 0.0;
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
        (elements[i] as number[])[j] = i === j ? d[i] as number : 0.0;
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
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j] as number) + (m.elements[i]?.[j] as number);
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
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j] as number) - (m.elements[i]?.[j] as number);
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
        (result.elements[i] ?? [])[j] = (this.elements[i]?.[j] as number) * n;
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
          ((result.elements[i] as number[])[j] as number) +=
            (this.elements[i]?.[k] as number) * (m.elements[k]?.[j] as number);
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
        (result.elements[i] as number[])[j] = (this.elements[i]?.[j] as number) * (m.elements[i]?.[j] as number);
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
        total += (this.elements[i]?.[j] as number) * (v.elements[j] as number);
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
            total += (this.elements[i]?.[j] as number) * v.x;
            break;
          case 1:
            total += (this.elements[i]?.[j] as number) * v.y;
            break;
          case 2:
            total += (this.elements[i]?.[j] as number) * v.z;
            break;
          default:
            break;
        }
      }
      result[i] = total as T;
    }

    return new Vector3D<T>((result[0] as T), (result[1] as T), (result[2] as T));
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
          (output.elements[i] as number[])[j] = 1 / (this.elements[i]?.[j] as number);
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
        (result.elements[j] as number[])[i] = (this.elements[i] as number[])[j] as number;
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
          total += (result.elements[i]?.[j] as number) * (result.elements[k]?.[j] as number);
        }
        (result.elements[i] as number[])[k] =
          i === k
            ? Math.sqrt((this.elements[i]?.[i] as number) - total)
            : (1 / (result.elements[k]?.[k] as number)) * ((this.elements[i]?.[k] as number) - total);
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

    this.elements[i] = this.elements[j] as number[];
    this.elements[j] = tmp as number[];
  }

  /**
   * Converts the matrix to reduced row echelon form using the Gaussian
   * elimination method. This method modifies the matrix in-place.
   */
  private toReducedRowEchelonForm_(): void {
    for (let lead = 0, row = 0; row < this.rows && lead < this.columns; ++row, ++lead) {
      let i = row;

      while ((this.elements[i]?.[lead] as number) === 0) {
        if (++i === this.rows) {
          i = row;
          if (++lead === this.columns) {
            return;
          }
        }
      }
      this._swapRows(i, row);
      if ((this.elements[row]?.[lead] as number) !== 0) {
        const f = this.elements[row]?.[lead] as number;

        for (let column = 0; column < this.columns; ++column) {
          (this.elements[row] as number[])[column] = ((this.elements[row] as number[])[column] as number) / f;
        }
      }
      for (let j = 0; j < this.rows; ++j) {
        if (j === row) {
          continue;
        }
        const f = (this.elements[j]?.[lead] as number);

        for (let column = 0; column < this.columns; ++column) {
          ((this.elements[j] as number[])[column] as number) -= f * (this.elements[row]?.[column] as number);
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
        (tmp.elements[row] as number[])[column] = (this.elements[row] as number[])[column] as number;
      }
      (tmp.elements[row] as number[])[row + this.columns] = 1.0;
    }
    tmp.toReducedRowEchelonForm_();
    const inv = Matrix.zero(this.rows, this.columns);

    for (let row = 0; row < this.rows; ++row) {
      for (let column = 0; column < this.columns; ++column) {
        ((inv.elements[row] as number[])[column] as number) = (tmp.elements[row]?.[column + this.columns] as number);
      }
    }

    return inv;
  }
}
