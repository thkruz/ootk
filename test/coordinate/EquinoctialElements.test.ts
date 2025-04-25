import { EquinoctialElements, EpochUTC, Kilometers, Radians } from '../../src/main';

describe('ClassicalElements', () => {
  const epoch = EpochUTC.fromDateTime(new Date('2024-01-14T14:39:39.914Z'));
  let elements: EquinoctialElements;
  let elements2: EquinoctialElements;

  beforeEach(() => {
    elements = new EquinoctialElements({
      epoch,
      a: 6935.754028093152 as Kilometers,
      h: 0.000647924735354646,
      k: -0.00023984363760690404,
      p: 0.06877966401254976,
      q: 0.38775089544898517,
      lambda: 7.675800884962325 as Radians,
      mu: 398600.4415,
      I: 1,
    });
    elements2 = new EquinoctialElements({
      epoch,
      a: 6937.389795521736 as Kilometers,
      h: 0.0008140324591775426,
      k: 0.00025609012211642304,
      p: 0.09761971480018718,
      q: 0.3198440470005213,
      lambda: 7.224398200203262 as Radians,
      mu: 398600.4415,
      I: -1,
    });
  });

  // toString
  it('should return a string representation of the EquinoctialElements object', () => {
    expect(elements.toString()).toEqual(
      [
        '[EquinoctialElements]',
        `  Epoch: ${epoch}`,
        `  a: ${elements.a} km`,
        `  h: ${elements.h}`,
        `  k: ${elements.k}`,
        `  p: ${elements.p}`,
        `  q: ${elements.q}`,
        `  lambda: ${elements.lambda} rad`,
      ].join('\n'),
    );
  });

  // semiMajorAxis
  it('should return the semi-major axis', () => {
    expect(elements.semimajorAxis).toMatchSnapshot();
    expect(elements2.semimajorAxis).toMatchSnapshot();
  });

  // meanLongitude
  it('should return the mean longitude', () => {
    expect(elements.meanLongitude).toMatchSnapshot();
    expect(elements2.meanLongitude).toMatchSnapshot();
  });

  // meanMotion
  it('should return the mean motion', () => {
    expect(elements.meanMotion).toMatchSnapshot();
    expect(elements2.meanMotion).toMatchSnapshot();
  });

  // retrogradeFactor
  it('should return the retrograde factor', () => {
    expect(elements.retrogradeFactor).toMatchSnapshot();
    expect(elements2.retrogradeFactor).toMatchSnapshot();
  });

  // isPrograde
  it('should return true if the orbit is prograde', () => {
    expect(elements.isPrograde()).toMatchSnapshot();
    expect(elements2.isPrograde()).toMatchSnapshot();
  });

  // isRetrograde
  it('should return true if the orbit is retrograde', () => {
    expect(elements.isRetrograde()).toMatchSnapshot();
    expect(elements2.isRetrograde()).toMatchSnapshot();
  });

  // period
  it('should return the period', () => {
    expect(elements.period).toMatchSnapshot();
    expect(elements2.period).toMatchSnapshot();
  });

  // revsPerDay
  it('should return the revs per day', () => {
    expect(elements.revsPerDay).toMatchSnapshot();
    expect(elements2.revsPerDay).toMatchSnapshot();
  });

  // toClassicalElements
  it('should return the ClassicalElements object', () => {
    expect(elements.toClassicalElements()).toMatchSnapshot();
    expect(elements2.toClassicalElements()).toMatchSnapshot();
  });

  // toPositionVelocity
  it('should return the PositionVelocity object', () => {
    expect(elements.toPositionVelocity()).toMatchSnapshot();
    expect(elements2.toPositionVelocity()).toMatchSnapshot();
  });
});
