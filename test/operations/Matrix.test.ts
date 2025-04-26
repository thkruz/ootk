import { Matrix, Radians, Vector } from '../../src/main';

describe('Matrix', () => {
  // should create a matrix with the correct number of rows and columns
  it('should create a matrix with the correct number of rows and columns', () => {
    const elements = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const matrix = new Matrix(elements);

    expect(matrix.elements).toEqual(elements);
    expect(matrix.rows).toBe(elements.length);
    expect(matrix.columns).toBe((elements[0] as number[]).length);
  });

  // should add two matrices correctly
  it('should add two matrices correctly', () => {
    const matrix1 = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const matrix2 = new Matrix([
      [9, 8, 7],
      [6, 5, 4],
      [3, 2, 1],
    ]);
    const result = matrix1.add(matrix2);

    expect(result.elements).toEqual([
      [10, 10, 10],
      [10, 10, 10],
      [10, 10, 10],
    ]);
    expect(result.rows).toBe(3);
    expect(result.columns).toBe(3);
  });

  // should subtract two matrices correctly
  it('should subtract two matrices correctly', () => {
    const matrix1 = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const matrix2 = new Matrix([
      [9, 8, 7],
      [6, 5, 4],
      [3, 2, 1],
    ]);
    const result = matrix1.subtract(matrix2);

    expect(result.elements).toEqual([
      [-8, -6, -4],
      [-2, 0, 2],
      [4, 6, 8],
    ]);
    expect(result.rows).toBe(3);
    expect(result.columns).toBe(3);
  });

  // should scale a matrix correctly
  it('should scale a matrix correctly', () => {
    const matrix = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const result = matrix.scale(2);

    expect(result.elements).toEqual([
      [2, 4, 6],
      [8, 10, 12],
      [14, 16, 18],
    ]);
    expect(result.rows).toBe(3);
    expect(result.columns).toBe(3);
  });

  // should multiply two matrices correctly
  it('should multiply two matrices correctly', () => {
    const matrix1 = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const matrix2 = new Matrix([
      [9, 8, 7],
      [6, 5, 4],
      [3, 2, 1],
    ]);
    const result = matrix1.multiply(matrix2);

    expect(result.elements).toEqual([
      [30, 24, 18],
      [84, 69, 54],
      [138, 114, 90],
    ]);
    expect(result.rows).toBe(3);
    expect(result.columns).toBe(3);
  });

  // should multiply a matrix and a vector correctly
  it('should multiply a matrix and a vector correctly', () => {
    const matrix = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const vector = new Vector([1, 2, 3]);
    const result = matrix.multiplyVector(vector);

    expect(result.elements).toEqual([14, 32, 50]);
  });

  // should create a matrix with empty rows
  it('should create a matrix with empty rows', () => {
    const matrix = new Matrix([[], [], []]);

    expect(matrix.elements).toEqual([[], [], []]);
    expect(matrix.rows).toBe(3);
    expect(matrix.columns).toBe(0);
  });

  // should create a matrix with empty columns
  it('should create a matrix with empty columns', () => {
    const matrix = new Matrix([[1], [2], [3]]);

    expect(matrix.elements).toEqual([[1], [2], [3]]);
    expect(matrix.rows).toBe(3);
    expect(matrix.columns).toBe(1);
  });

  // should multiply a matrix and a 3D vector correctly
  it('should multiply a matrix and a 3D vector correctly when the matrix and vector are valid', () => {
    const matrixElements = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const vectorElements = [1, 2, 3];
    const expectedElements = [14, 32, 50];
    const matrix = new Matrix(matrixElements);
    const vector = new Vector(vectorElements);

    const result = matrix.multiplyVector(vector);

    expect(result.elements).toEqual(expectedElements);
  });

  // should calculate the outer product of two matrices correctly
  it('should calculate the outer product of two matrices correctly', () => {
    const matrix1 = new Matrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    const matrix2 = new Matrix([
      [9, 8, 7],
      [6, 5, 4],
      [3, 2, 1],
    ]);
    const expected = new Matrix([
      [9, 16, 21],
      [24, 25, 24],
      [21, 16, 9],
    ]);
    const result = matrix1.outerProduct(matrix2);

    expect(result).toEqual(expected);
  });

  // should calculate the transpose of a matrix correctly
  it('should calculate the transpose of a matrix correctly', () => {
    const elements = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const matrix = new Matrix(elements);
    const transpose = matrix.transpose();

    expect(transpose.elements).toEqual([
      [1, 4, 7],
      [2, 5, 8],
      [3, 6, 9],
    ]);
    expect(transpose.rows).toBe(matrix.columns);
    expect(transpose.columns).toBe(matrix.rows);
  });

  // should calculate the inverse of a matrix correctly
  it('should calculate the inverse of a matrix correctly', () => {
    const elements = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const matrix = new Matrix(elements);
    const inverse = matrix.inverse();

    expect(inverse.elements).toMatchSnapshot();
  });

  // allZeros
  it('should return true if all elements are zero', () => {
    const matrix = Matrix.allZeros(3, 3);

    expect(matrix.elements).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  // fill
  it('should fill a matrix with the correct value', () => {
    const matrix = Matrix.fill(3, 3, 1);

    expect(matrix.elements).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
  });

  // rotX
  it('should create a rotation matrix around the x-axis', () => {
    const matrix = Matrix.rotX((Math.PI / 2) as Radians);

    expect(matrix.elements).toMatchSnapshot();
  });

  // rotY
  it('should create a rotation matrix around the y-axis', () => {
    const matrix = Matrix.rotY((Math.PI / 2) as Radians);

    expect(matrix.elements).toMatchSnapshot();
  });

  // rotZ
  it('should create a rotation matrix around the z-axis', () => {
    const matrix = Matrix.rotZ((Math.PI / 2) as Radians);

    expect(matrix.elements).toMatchSnapshot();
  });

  // identity
  it('should create an identity matrix', () => {
    const matrix = Matrix.identity(3);

    expect(matrix.elements).toMatchSnapshot();
  });

  // diagonal
  it('should create a diagonal matrix', () => {
    const matrix = Matrix.diagonal([1, 2, 3]);

    expect(matrix.elements).toMatchSnapshot();
  });

  // reciprocal
  it('should create a reciprocal matrix', () => {
    const matrix = Matrix.allZeros(3, 3).reciprocal();

    expect(matrix.elements).toMatchSnapshot();
  });

  // cholesky
  it('should create a cholesky matrix', () => {
    const matrix = Matrix.allZeros(3, 3).cholesky();

    expect(matrix.elements).toMatchSnapshot();
  });
});
