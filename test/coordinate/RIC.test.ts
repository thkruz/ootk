import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, RIC, Vector3D } from './../../src/main';

describe('RIC', () => {
  let stateVector: J2000;
  let origin: J2000;

  beforeEach(() => {
    stateVector = new J2000(
      EpochUTC.fromDateTime(new Date(1705109326817)),
      new Vector3D(1538.223335842895 as Kilometers, 5102.261204021967 as Kilometers, 4432.634965003577 as Kilometers),
      new Vector3D(
        -7.341518909379302 as KilometersPerSecond,
        0.6516718453998644 as KilometersPerSecond,
        1.7933882499861993 as KilometersPerSecond,
      ),
    );

    origin = new J2000(
      EpochUTC.fromDateTime(new Date(1705109326817)),
      new Vector3D(1540.223335842895 as Kilometers, 5102.251204021967 as Kilometers, 4432.644965003577 as Kilometers),
      new Vector3D(
        -7.331518909379302 as KilometersPerSecond,
        0.6516718453998644 as KilometersPerSecond,
        1.7933882499861993 as KilometersPerSecond,
      ),
    );
  });

  // Create a new RIC coordinate from J2000 state vectors and origin
  it('should create a new RIC coordinate from J2000 state vectors and origin', () => {
    const transform = new Matrix([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);

    const ric = RIC.fromJ2000Matrix(stateVector, origin, transform);

    expect(ric).toMatchSnapshot();
  });

  // Create a RIC coordinate system from a J2000 state and origin
  it('should create a RIC coordinate system from a J2000 state and origin', () => {
    const ric = RIC.fromJ2000(stateVector, origin);

    expect(ric).toMatchSnapshot();
  });

  /*
   * Transform the current RIC coordinate to the J2000 coordinate system using
   * the provided origin
   */
  it('should transform the current RIC coordinate to the J2000 coordinate system using the provided origin', () => {
    const transform = new Matrix([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const j2000 = ric.toJ2000Matrix(origin, transform);

    expect(j2000).toMatchSnapshot();
  });

  /*
   * Transform the current RIC coordinate to the J2000 coordinate system using
   * the provided origin and transform matrix
   */
  it('should transform the current RIC coordinate to J2000 using the provided origin and transform matrix', () => {
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const j2000 = ric.toJ2000(origin);

    expect(j2000).toMatchSnapshot();
  });

  // Get the name of the RIC coordinate system
  it('should get the name of the RIC coordinate system', () => {
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const name = ric.name;

    expect(name).toMatchSnapshot();
  });

  // toString
  it('should return a string representation of the RIC coordinate', () => {
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const string = ric.toString();

    expect(string).toMatchSnapshot();
  });

  // range
  it('should return the range of the RIC coordinate', () => {
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const range = ric.range;

    expect(range).toMatchSnapshot();
  });

  // rangeRate
  it('should return the range rate of the RIC coordinate', () => {
    const ric = new RIC(stateVector.position, stateVector.velocity);
    const rangeRate = ric.rangeRate;

    expect(rangeRate).toMatchSnapshot();
  });
});
