import { GoldenSection } from '../GoldenSection';

describe('GoldenSection', () => {
  test('finds minimum of a unimodal function', () => {
    const objectiveFunction = (x: number) => (x - 2) ** 2; // A simple parabola with minimum at x=2
    const result = GoldenSection.search(objectiveFunction, 0, 4, { tolerance: 0.001 });

    expect(result).toBeCloseTo(2, 3); // Expect the result to be close to 2
  });

  test('finds maximum of a unimodal function', () => {
    const objectiveFunction = (x: number) => -((x - 3) ** 2) + 9; // A simple parabola with maximum at x=3
    const result = GoldenSection.search(objectiveFunction, 0, 6, { tolerance: 0.001, solveMax: true });

    expect(result).toBeCloseTo(3, 3); // Expect the result to be close to 3
  });

  test('handles edge cases with tolerance', () => {
    const objectiveFunction = (x: number) => (x - 1) ** 2; // Minimum at x=1
    const result = GoldenSection.search(objectiveFunction, 0, 2, { tolerance: 1e-10 });

    expect(result).toBeCloseTo(1, 9); // Expect the result to be very close to 1
  });
});
