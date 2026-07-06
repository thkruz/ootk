import { DownhillSimplex } from '../DownhillSimplex';

describe('DownhillSimplex', () => {
  describe('generateSimplex', () => {
    it('should generate a simplex with N+1 vertices for N-dimensional input', () => {
      const x0 = new Float64Array([1, 2, 3]);
      const simplex = DownhillSimplex.generateSimplex(x0);

      expect(simplex).toHaveLength(4); // 3D + 1 = 4 vertices
    });

    it('should include the initial guess as the first vertex', () => {
      const x0 = new Float64Array([1, 2]);
      const simplex = DownhillSimplex.generateSimplex(x0);

      expect(simplex[0]).toEqual(x0);
    });

    it('should generate vertices with default step size', () => {
      const x0 = new Float64Array([10, 20]);
      const simplex = DownhillSimplex.generateSimplex(x0);

      expect(simplex[1][0]).toBeCloseTo(10.1, 5);
      expect(simplex[1][1]).toBe(20);
      expect(simplex[2][0]).toBe(10);
      expect(simplex[2][1]).toBeCloseTo(20.2, 5);
    });

    it('should generate vertices with custom step size', () => {
      const x0 = new Float64Array([10, 20]);
      const simplex = DownhillSimplex.generateSimplex(x0, 0.1);

      expect(simplex[1][0]).toBeCloseTo(11, 5);
      expect(simplex[1][1]).toBe(20);
      expect(simplex[2][0]).toBe(10);
      expect(simplex[2][1]).toBeCloseTo(22, 5);
    });
  });

  describe('solveSimplex', () => {
    it('should minimize a simple quadratic function', () => {
      const costFn = (x: Float64Array) => (x[0] - 3) ** 2 + (x[1] - 5) ** 2;
      const initialGuess = new Float64Array([0, 0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.1);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-10,
        fTolerance: 1e-10,
        maxIter: 1000,
      });

      expect(result[0]).toBeCloseTo(3, 5);
      expect(result[1]).toBeCloseTo(5, 5);
    });

    it('should minimize Rosenbrock function', () => {
      const costFn = (x: Float64Array) => {
        const a = 1 - x[0];
        const b = x[1] - x[0] * x[0];

        return a * a + 100 * b * b;
      };
      const initialGuess = new Float64Array([0, 0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.1);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-8,
        fTolerance: 1e-8,
        maxIter: 5000,
      });

      expect(result[0]).toBeCloseTo(1, 3);
      expect(result[1]).toBeCloseTo(1, 3);
    });

    it('should work with 1D optimization', () => {
      const costFn = (x: Float64Array) => (x[0] - 7) ** 2;
      const initialGuess = new Float64Array([0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 1.0);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-10,
        fTolerance: 1e-10,
        maxIter: 1000,
      });

      expect(result[0]).toBeCloseTo(7, 5);
    });

    it('should respect maxIter limit', () => {
      const costFn = (x: Float64Array) => (x[0] - 3) ** 2 + (x[1] - 5) ** 2;
      const initialGuess = new Float64Array([0, 0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.1);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-20,
        fTolerance: 1e-20,
        maxIter: 1,
      });

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
    });

    it('should work with adaptive coefficients', () => {
      const costFn = (x: Float64Array) => (x[0] - 3) ** 2 + (x[1] - 5) ** 2;
      const initialGuess = new Float64Array([0, 0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 0.1);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-10,
        fTolerance: 1e-10,
        maxIter: 1000,
        adaptive: true,
      });

      expect(result[0]).toBeCloseTo(3, 5);
      expect(result[1]).toBeCloseTo(5, 5);
    });

    it('should handle xTolerance termination', () => {
      const costFn = (x: Float64Array) => x[0] ** 2 + x[1] ** 2;
      const initialGuess = new Float64Array([1, 1]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 1.0);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 0.1,
        fTolerance: 1e-20,
        maxIter: 10000,
      });

      expect(result[0]).toBeCloseTo(0, 1);
      expect(result[1]).toBeCloseTo(0, 1);
    });

    it('should handle fTolerance termination', () => {
      const costFn = (x: Float64Array) => x[0] ** 2 + x[1] ** 2;
      const initialGuess = new Float64Array([1, 1]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 1.0);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-20,
        fTolerance: 0.001,
        maxIter: 10000,
      });

      expect(result[0]).toBeCloseTo(0, 1);
      expect(result[1]).toBeCloseTo(0, 1);
    });

    it('should work with 3D optimization', () => {
      const costFn = (x: Float64Array) =>
        (x[0] - 1) ** 2 + (x[1] - 2) ** 2 + (x[2] - 3) ** 2;
      const initialGuess = new Float64Array([0, 0, 0]);
      const simplex = DownhillSimplex.generateSimplex(initialGuess, 1.0);

      const result = DownhillSimplex.solveSimplex(costFn, simplex, {
        xTolerance: 1e-10,
        fTolerance: 1e-10,
        maxIter: 2000,
      });

      expect(result[0]).toBeCloseTo(1, 5);
      expect(result[1]).toBeCloseTo(2, 5);
      expect(result[2]).toBeCloseTo(3, 5);
    });
  });
});
