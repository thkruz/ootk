import {
  AngularDiameterMethod,
  AngularDistanceMethod,
  Degrees,
  EcefVec3,
  Kilometers,
  KilometersPerSecond,
  Radians,
  SpaceObjectType,
  acoth,
  acsch,
  angularDiameter,
  angularDistance,
  array2d,
  asech,
  clamp,
  concat,
  copySign,
  covariance,
  createVec,
  csch,
  deg2rad,
  derivative,
  dopplerFactor,
  evalPoly,
  factorial,
  gamma,
  getDayOfYear,
  isLeapYear,
  jacobian,
  linearInterpolate,
  log10,
  matchHalfPlane,
  mean,
  newtonM,
  newtonNu,
  rad2deg,
  sech,
  sign,
  spaceObjType2Str,
  std,
  toPrecision,
  wrapAngle,
} from '../../main';

// jacobian
it('should be calculate jacobian', () => {
  expect(jacobian((xs: Float64Array) => xs, 1, new Float64Array([1, 2, 3]))).toMatchSnapshot();
});

// derivative
it('should be calculate derivative', () => {
  expect(derivative((x: number) => x * x, 1)).toMatchSnapshot();
});

it('should return correct derivative value when called', () => {
  const df = derivative((x: number) => x * x);

  // Derivative of x^2 is 2x, so at x=3 should be approximately 6
  expect(df(3)).toBeCloseTo(6, 3);
  // At x=0 should be approximately 0
  expect(df(0)).toBeCloseTo(0, 3);
});


describe('functions', () => {
  it('should be calculate log10', () => {
    expect(log10(100)).toMatchSnapshot();
  });

  // sech
  it('should be calculate sech', () => {
    expect(sech(1)).toMatchSnapshot();
  });

  // csch
  it('should be calculate csch', () => {
    expect(csch(1)).toMatchSnapshot();
  });

  // acsch
  it('should be calculate acsch', () => {
    expect(acsch(1)).toMatchSnapshot();
  });

  // asech
  it('should be calculate asech', () => {
    expect(asech(1)).toMatchSnapshot();
  });

  // acotch
  it('should be calculate acotch', () => {
    expect(acoth(1)).toMatchSnapshot();
  });

  // copySign
  it('should be calculate copySign', () => {
    expect(copySign(1, 1)).toMatchSnapshot();
    expect(copySign(-1, 1)).toMatchSnapshot();
    expect(copySign(1, -1)).toMatchSnapshot();
    expect(copySign(-1, -1)).toMatchSnapshot();
  });

  // concat
  it('should be calculate concat', () => {
    expect(concat(new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6]))).toMatchSnapshot();
  });

  // wrapAngle
  it('should be calculate wrapAngle', () => {
    expect(wrapAngle(1 as Radians)).toMatchSnapshot();
    expect(wrapAngle(5 as Radians)).toMatchSnapshot();
    expect(wrapAngle(-5 as Radians)).toMatchSnapshot();
  });

  // createVec
  it('should be calculate createVec', () => {
    const vec = createVec(1, 2, 3);

    expect(vec).toMatchSnapshot();
  });

  // spaceObjType2Str
  it('should be calculate spaceObjType2Str', () => {
    expect(spaceObjType2Str(SpaceObjectType.DEBRIS)).toMatchSnapshot();
  });

  // sign
  it('should be calculate sign', () => {
    expect(sign(1)).toMatchSnapshot();
    expect(sign(-1)).toMatchSnapshot();
  });

  // array2d
  it('should be calculate array2d', () => {
    expect(array2d(1, 2, 3)).toMatchSnapshot();
  });

  // gamma
  it('should be calculate gamma', () => {
    expect(gamma(1)).toMatchSnapshot();
  });

  // covariance
  it('should be calculate covariance', () => {
    expect(covariance([1, 2, 3], [1, 2, 3])).toMatchSnapshot();
  });

  // std
  it('should be calculate std', () => {
    expect(std([1, 2, 3])).toMatchSnapshot();
  });

  // mean
  it('should be calculate mean', () => {
    expect(mean([1, 2, 3])).toMatchSnapshot();
  });

  // linearInterpolate
  it('should be calculate linearInterpolate', () => {
    expect(linearInterpolate(1, 2, 0.5, 0, 1)).toMatchSnapshot();
  });

  // rad2deg
  it('should be calculate rad2deg', () => {
    expect(rad2deg(1 as Radians)).toMatchSnapshot();
  });

  // deg2rad
  it('should be calculate deg2rad', () => {
    expect(deg2rad(1 as Degrees)).toMatchSnapshot();
  });

  // factorial
  it('should calculate factorial of positive numbers', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(factorial(10)).toBe(3628800);
  });

  it('should calculate factorial of negative numbers using absolute value', () => {
    expect(factorial(-5)).toBe(120);
    expect(factorial(-1)).toBe(1);
  });

});

// evalPoly
describe('evalPoly', () => {
  it('should evaluate polynomial', () => {
    // Polynomial: 2x^2 + 3x + 1 at x=2 -> 2(4) + 3(2) + 1 = 15
    expect(evalPoly(2, new Float64Array([2, 3, 1]))).toBe(15);
    // Polynomial: 1x^0 = 1 at any x
    expect(evalPoly(5, new Float64Array([1]))).toBe(1);
    // Polynomial: x^2 at x=3 -> 9
    expect(evalPoly(3, new Float64Array([1, 0, 0]))).toBe(9);
  });
});

// matchHalfPlane
describe('matchHalfPlane', () => {
  it('should match half plane correctly', () => {
    expect(matchHalfPlane(0.5, 0.4)).toBeCloseTo(0.5);
    expect(matchHalfPlane(0.5, Math.PI)).toBeCloseTo(2 * Math.PI - 0.5);
    expect(matchHalfPlane(Math.PI / 4, Math.PI / 4)).toBeCloseTo(Math.PI / 4);
  });
});

// angularDistance
describe('angularDistance', () => {
  it('should calculate angular distance using cosine method', () => {
    const result = angularDistance(0, 0, Math.PI / 2, 0, AngularDistanceMethod.Cosine);

    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('should calculate angular distance using haversine method', () => {
    const result = angularDistance(0, 0, Math.PI / 2, 0, AngularDistanceMethod.Haversine);

    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('should default to cosine method', () => {
    const result = angularDistance(0, 0, Math.PI / 2, 0);

    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('should throw for invalid method', () => {
    expect(() => angularDistance(0, 0, 0, 0, 999 as AngularDistanceMethod)).toThrow(
      'Invalid angular distance method.',
    );
  });
});

// angularDiameter
describe('angularDiameter', () => {
  it('should calculate angular diameter using sphere method', () => {
    const result = angularDiameter(1, 10, AngularDiameterMethod.Sphere);

    expect(result).toBeCloseTo(2 * Math.asin(1 / 20));
  });

  it('should calculate angular diameter using circle method', () => {
    const result = angularDiameter(1, 10, AngularDiameterMethod.Circle);

    expect(result).toBeCloseTo(2 * Math.atan(1 / 20));
  });

  it('should default to sphere method', () => {
    const result = angularDiameter(1, 10);

    expect(result).toBeCloseTo(2 * Math.asin(1 / 20));
  });

  it('should throw for invalid method', () => {
    expect(() => angularDiameter(1, 10, 999 as AngularDiameterMethod)).toThrow('Invalid angular diameter method.');
  });
});

// newtonM
describe('newtonM', () => {
  it('should calculate eccentric and true anomaly for circular orbit', () => {
    const result = newtonM(0, Math.PI / 4);

    expect(result.e0).toBeCloseTo(Math.PI / 4);
    expect(result.nu).toBeCloseTo(Math.PI / 4);
  });

  it('should calculate eccentric and true anomaly for elliptical orbit', () => {
    const result = newtonM(0.5, Math.PI / 4);

    expect(result.e0).toBeDefined();
    expect(result.nu).toBeDefined();
  });

  it('should handle negative mean anomaly', () => {
    const result = newtonM(0.5, -Math.PI / 2);

    expect(result.e0).toBeDefined();
    expect(result.nu).toBeDefined();
  });

  it('should handle mean anomaly greater than PI', () => {
    const result = newtonM(0.5, Math.PI + 0.5);

    expect(result.e0).toBeDefined();
    expect(result.nu).toBeDefined();
  });
});

// newtonNu
describe('newtonNu', () => {
  it('should calculate eccentric and mean anomaly for circular orbit', () => {
    const result = newtonNu(0, Math.PI / 4);

    expect(result.e0).toBeCloseTo(Math.PI / 4);
    expect(result.m).toBeCloseTo(Math.PI / 4);
  });

  it('should calculate eccentric and mean anomaly for elliptical orbit', () => {
    const result = newtonNu(0.5, Math.PI / 4);

    expect(result.e0).toBeDefined();
    expect(result.m).toBeDefined();
  });

  it('should normalize mean anomaly to [0, 2*PI]', () => {
    const result = newtonNu(0.5, -Math.PI / 4);

    expect(result.m).toBeGreaterThanOrEqual(0);
    expect(result.m).toBeLessThan(2 * Math.PI);
  });

  it('should handle large negative true anomaly', () => {
    const result = newtonNu(0.5, -3 * Math.PI);

    expect(result.m).toBeGreaterThanOrEqual(0);
    expect(result.m).toBeLessThan(2 * Math.PI);
    expect(result.e0).toBeDefined();
  });

  it('should handle eccentricity close to 1', () => {
    const result = newtonNu(0.99, Math.PI / 6);

    expect(result.e0).toBeDefined();
    expect(result.m).toBeGreaterThanOrEqual(0);
  });
});

// clamp
describe('clamp', () => {
  it('should clamp values correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

// isLeapYear
describe('isLeapYear', () => {
  it('should identify leap years correctly', () => {
    expect(isLeapYear(new Date('2000-01-01'))).toBe(true);
    expect(isLeapYear(new Date('2004-01-01'))).toBe(true);
    expect(isLeapYear(new Date('2020-01-01'))).toBe(true);
  });

  it('should identify non-leap years correctly', () => {
    expect(isLeapYear(new Date('2001-01-01'))).toBe(false);
    expect(isLeapYear(new Date('2100-01-01'))).toBe(false);
    expect(isLeapYear(new Date('1900-01-01'))).toBe(false);
  });
});

// getDayOfYear
describe('getDayOfYear', () => {
  it('should not throw for empty date', () => {
    expect(() => getDayOfYear()).not.toThrow();
  });

  it('should calculate day of year for January dates', () => {
    expect(getDayOfYear(new Date('2023-01-01T00:00:00Z'))).toBe(1);
    expect(getDayOfYear(new Date('2023-01-31T00:00:00Z'))).toBe(31);
  });

  it('should calculate day of year for non-leap year', () => {
    expect(getDayOfYear(new Date('2023-03-01T00:00:00Z'))).toBe(60);
    expect(getDayOfYear(new Date('2023-12-31T00:00:00Z'))).toBe(365);
  });

  it('should calculate day of year for leap year', () => {
    expect(getDayOfYear(new Date('2024-03-01T00:00:00Z'))).toBe(61);
    expect(getDayOfYear(new Date('2024-12-31T00:00:00Z'))).toBe(366);
  });
});

// toPrecision
describe('toPrecision', () => {
  it('should round to specified precision', () => {
    expect(toPrecision(3.14159, 2)).toBe(3.14);
    expect(toPrecision(3.14159, 4)).toBe(3.1416);
    expect(toPrecision(3.5, 0)).toBe(4);
    expect(toPrecision(2.555, 2)).toBe(2.56);
  });
});

// dopplerFactor
describe('dopplerFactor', () => {
  it('should calculate doppler factor', () => {
    const location = { x: 6378, y: 0, z: 0 } as EcefVec3<Kilometers>;
    const position = { x: 42164, y: 0, z: 0 } as EcefVec3<Kilometers>;
    const velocity = { x: 0, y: 3.075, z: 0 } as EcefVec3<KilometersPerSecond>;

    const result = dopplerFactor(location, position, velocity);

    expect(result).toBeCloseTo(1, 2);
  });
});

// std with isSample
describe('std edge cases', () => {
  it('should calculate sample standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const populationStd = std(values, false);
    const sampleStd = std(values, true);

    expect(sampleStd).toBeGreaterThan(populationStd);
  });
});

// covariance with isSample
describe('covariance edge cases', () => {
  it('should calculate sample covariance', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    const populationCov = covariance(a, b, false);
    const sampleCov = covariance(a, b, true);

    expect(sampleCov).toBeGreaterThan(populationCov);
  });
});

// wrapAngle edge case
describe('wrapAngle edge cases', () => {
  it('should wrap -PI to PI', () => {
    expect(wrapAngle(-Math.PI as Radians)).toBe(Math.PI);
  });

  // factorial
  describe('factorial', () => {
    it('should calculate factorial of positive numbers', () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
      expect(factorial(5)).toBe(120);
      expect(factorial(10)).toBe(3628800);
    });

    it('should calculate factorial of negative numbers using absolute value', () => {
      expect(factorial(-5)).toBe(120);
      expect(factorial(-1)).toBe(1);
    });

    it('should handle large numbers', () => {
      expect(factorial(20)).toBe(2432902008176640000);
    });
  });
});
