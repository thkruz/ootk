import { ClassicalElements, EpochUTC, J2000, Kilometers, KilometersPerSecond, Radians, TEME, Vector3D }
  from './../../src/main';
describe('TEME', () => {
  let stateVector: TEME;

  beforeEach(() => {
    stateVector = new J2000(
      EpochUTC.fromDateTime(new Date(1705109326817)),
      new Vector3D(1538.223335842895 as Kilometers, 5102.261204021967 as Kilometers, 4432.634965003577 as Kilometers),
      new Vector3D(
        -7.341518909379302 as KilometersPerSecond,
        0.6516718453998644 as KilometersPerSecond,
        1.7933882499861993 as KilometersPerSecond,
      ),
    ).toTEME();
  });

  // name
  it('should return the name of the coordinate system', () => {
    expect(stateVector.name).toMatchSnapshot();
  });

  // inertial
  it('should return whether the coordinate system is inertial', () => {
    expect(stateVector.inertial).toMatchSnapshot();
  });

  // fromClassicalElements
  it('should create a TEME coordinate from classical orbital elements', () => {
    const exampleDate = new Date(1705109326817);
    const epoch = EpochUTC.fromDateTime(exampleDate);
    const elements = new ClassicalElements({
      epoch,
      semimajorAxis: 6943.547853722985 as Kilometers,
      eccentricity: 0.0011235968124658146,
      inclination: 0.7509087232045765 as Radians,
      rightAscension: 0.028239555738616327 as Radians,
      argPerigee: 2.5386411901807353 as Radians,
      trueAnomaly: 0.5931399364974058 as Radians,
    });

    expect(TEME.fromClassicalElements(elements)).toMatchSnapshot();
  });

  // toJ2000
  it('should convert the TEME coordinates to J2000 coordinates', () => {
    expect(stateVector.toJ2000()).toMatchSnapshot();
  });
});
