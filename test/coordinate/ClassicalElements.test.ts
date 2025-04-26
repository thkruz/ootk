import { ClassicalElements, EpochUTC, J2000, Kilometers, KilometersPerSecond, Radians, Vector3D }
  from './../../src/main';

describe('ClassicalElements', () => {
  const epoch = EpochUTC.fromDateTime(new Date('2024-01-14T14:39:39.914Z'));
  let elements: ClassicalElements;

  beforeEach(() => {
    elements = new ClassicalElements({
      epoch,
      semimajorAxis: 6943.547853722985 as Kilometers,
      eccentricity: 0.0011235968124658146,
      inclination: 0.7509087232045765 as Radians,
      rightAscension: 0.028239555738616327 as Radians,
      argPerigee: 2.5386411901807353 as Radians,
      trueAnomaly: 0.5931399364974058 as Radians,
    });
  });

  // can be constructed with valid parameters
  it('should construct a ClassicalElements object with valid parameters', () => {
    expect(elements).toMatchSnapshot();
  });

  // can convert to EquinoctialElements
  it('should convert ClassicalElements to EquinoctialElements', () => {
    const equinoctialElements = elements.toEquinoctialElements();

    expect(equinoctialElements).toMatchSnapshot();
  });

  // can propagate to a new epoch
  it('should propagate ClassicalElements to a new epoch', () => {
    const propEpoch = EpochUTC.fromDateTime(new Date('2024-01-15T14:39:39.914Z'));
    const propagatedElements = elements.propagate(propEpoch);

    expect(propagatedElements).toMatchSnapshot();
  });

  // can calculate mean motion
  it('should calculate the mean motion of ClassicalElements', () => {
    const meanMotion = elements.meanMotion;

    expect(meanMotion).toMatchSnapshot();
  });

  // can calculate period
  it('should calculate the period of ClassicalElements', () => {
    const period = elements.period;

    expect(period).toMatchSnapshot();
  });

  // can calculate apogee
  it('should calculate the apogee of ClassicalElements', () => {
    const apogee = elements.apogee;

    expect(apogee).toMatchSnapshot();
  });

  // can calculate perigee
  it('should calculate the perigee of ClassicalElements', () => {
    const perigee = elements.perigee;

    expect(perigee).toMatchSnapshot();
  });

  // can calculate orbit regime
  it('should calculate the orbit regime of ClassicalElements', () => {
    const orbitRegime = elements.getOrbitRegime();

    expect(orbitRegime).toMatchSnapshot();
  });

  // can convert to PositionVelocity
  it('should convert ClassicalElements to PositionVelocity', () => {
    const positionVelocity = elements.toPositionVelocity();

    expect(positionVelocity).toMatchSnapshot();
  });

  // can convert toString
  it('should convert ClassicalElements to string', () => {
    const string = elements.toString();

    expect(string).toMatchSnapshot();
  });

  // can calculate inclination in degrees
  it('should calculate inclination in degrees', () => {
    const inclination = elements.inclinationDegrees;

    expect(inclination).toMatchSnapshot();
  });
  // can calculate right ascension in degrees
  it('should calculate right ascension in degrees', () => {
    const rightAscension = elements.rightAscensionDegrees;

    expect(rightAscension).toMatchSnapshot();
  });
  // can calculate argument of perigee in degrees
  it('should calculate argument of perigee in degrees', () => {
    const argPerigee = elements.argPerigeeDegrees;

    expect(argPerigee).toMatchSnapshot();
  });
  // can calculate true anomaly in degrees
  it('should calculate true anomaly in degrees', () => {
    const trueAnomaly = elements.trueAnomalyDegrees;

    expect(trueAnomaly).toMatchSnapshot();
  });

  // can create from StateVector
  it('should create ClassicalElements from StateVector', () => {
    const stateVector = new J2000(
      EpochUTC.fromDateTime(new Date(1705109326817)),
      new Vector3D(1538.223335842895 as Kilometers, 5102.261204021967 as Kilometers, 4432.634965003577 as Kilometers),
      new Vector3D(
        -7.341518909379302 as KilometersPerSecond,
        0.6516718453998644 as KilometersPerSecond,
        1.7933882499861993 as KilometersPerSecond,
      ),
    );

    const classicalElements = ClassicalElements.fromStateVector(stateVector);

    expect(classicalElements).toMatchSnapshot();
  });
});
