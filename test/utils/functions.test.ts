import {
  Degrees,
  Radians,
  SpaceObjectType,
  acoth,
  acsch,
  array2d,
  asech,
  concat,
  copySign,
  covariance,
  createVec,
  csch,
  deg2rad,
  gamma,
  linearInterpolate,
  log10,
  mean,
  rad2deg,
  sech,
  sign,
  spaceObjType2Str,
  std,
  wrapAngle,
  derivative,
  jacobian,
} from '../../src/main';

// jacobian
it('should be calculate jacobian', () => {
  expect(jacobian((xs: Float64Array) => xs, 1, new Float64Array([1, 2, 3]))).toMatchSnapshot();
});

// derivative
it('should be calculate derivative', () => {
  expect(derivative((x: number) => x * x, 1)).toMatchSnapshot();
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
});
