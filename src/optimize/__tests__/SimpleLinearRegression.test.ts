import { SimpleLinearRegression } from '../SimpleLinearRegression';

describe('SimpleLinearRegression', () => {
  const daysSinceEpoch = [0, 1, 2, 3, 4, 5, 6, 7];
  const altitudeKm = [408.2, 407.9, 407.5, 407.2, 406.8, 406.5, 406.1, 405.8];
  let regression: SimpleLinearRegression;

  beforeEach(() => {
    regression = new SimpleLinearRegression(daysSinceEpoch, altitudeKm);
  });

  test('calculates the correct slope', () => {
    expect(regression.slope).toBeCloseTo(-0.3476190476190427, 3);
  });

  test('calculates the correct intercept', () => {
    expect(regression.intercept).toBeCloseTo(408.21666666666664, 2);
  });

  test('predicts altitude correctly for day 10', () => {
    const predictedAltitude = regression.evaluate(10);

    expect(predictedAltitude).toBeCloseTo(404.7404761904762, 2);
  });

  test('filters outliers correctly', () => {
    const cleanedRegression = regression.filterOutliers(2.0);

    expect(cleanedRegression.slope).toBeCloseTo(-0.3476190476190427, 3); // Adjust based on expected cleaned data
  });
});
