import {
  Degrees,
  GroundObject,
  Kilometers,
  RAD2DEG,
  Satellite,
  SatelliteParams,
  TleLine1,
  TleLine2,
} from '../../src/main';

const dateObj = new Date(1661400000000);

const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

const llaObserver = {
  lat: 40 as Degrees,
  lon: -75 as Degrees,
  alt: 0 as Kilometers,
};

describe('Basic Satellite functionality', () => {
  it('should create a new Sat object', () => {
    const sat = new Satellite({ name: 'Test', tle1, tle2 });

    expect(sat).toBeDefined();
    expect(sat.inclination).toBe(51.6415);
    expect(sat.rightAscension).toBe(161.8339);
    expect(sat.satrec).toBeDefined();
  });

  it('should allow getting eci coordinates', () => {
    const sat = new Satellite({ name: 'Test', tle1, tle2 });

    const eci = sat.eci(dateObj).position;

    expect(eci.x).toBeCloseTo(6512.640035319078);
    expect(eci.y).toBeCloseTo(-1545.524934684146);
    expect(eci.z).toBeCloseTo(-1195.219347050479);
  });

  it('should allow getting ecf coordinates', () => {
    const sat = new Satellite({ name: 'Test', tle1, tle2 });

    const eci = sat.ecf(dateObj);

    expect(eci.x).toBeCloseTo(4585.677469309576);
    expect(eci.y).toBeCloseTo(-4875.929624270418);
    expect(eci.z).toBeCloseTo(-1195.219347050479);
  });

  it('should allow getting lla coordinates', () => {
    const sat = new Satellite({ name: 'Test', tle1, tle2 });

    const eci = sat.lla(dateObj);

    expect(eci.lat).toBeCloseTo(-0.17779469476167792 * RAD2DEG);
    expect(eci.lon).toBeCloseTo(-0.8160653803347542 * RAD2DEG);
    expect(eci.alt).toBeCloseTo(421.9147233728436);
  });

  it('should be able to get the orbital period', () => {
    const sat = new Satellite({ name: 'Test', tle1, tle2 });

    expect(sat.period).toBeCloseTo(92.89920734635164);
  });
});

describe('Satellite', () => {
  let satellite: Satellite;
  let observer: GroundObject;
  let exampleDate: Date;

  beforeEach(() => {
    const satelliteParams: SatelliteParams = {
      tle1,
      tle2,
    };

    const mockExampleDate = new Date(1705109326817);

    exampleDate = new Date(mockExampleDate.getTime());
    satellite = new Satellite(satelliteParams);
    observer = new GroundObject(llaObserver);
  });
  // can be instantiated with valid input parameters
  it('should instantiate Satellite with valid input parameters', () => {
    expect(satellite).toMatchSnapshot();
  });

  // can calculate and return RAE coordinates
  it('should calculate and return RAE coordinates', () => {
    const rae = satellite.toRae(observer, exampleDate);

    expect(rae).toMatchSnapshot();
  });

  // can calculate and return ECI coordinates
  it('should calculate and return ECI coordinates', () => {
    const eci = satellite.eci(exampleDate);

    expect(eci).toMatchSnapshot();
  });

  // can calculate and return ECF coordinates
  it('should calculate and return ECF coordinates correctly', () => {
    const ecfCoordinates = satellite.ecf(exampleDate);

    expect(ecfCoordinates).toMatchSnapshot();
  });

  // can calculate and return LLA coordinates
  it('should calculate and return LLA coordinates when given a date', () => {
    const lla = satellite.lla(exampleDate);

    expect(lla).toMatchSnapshot();
  });

  // can calculate and return Geodetic coordinates
  it('should calculate and return Geodetic coordinates when given a date', () => {
    const geodetic = satellite.toGeodetic(exampleDate);

    expect(geodetic).toMatchSnapshot();
  });

  // can calculate and return ITRF coordinates
  it('should calculate and return ITRF coordinates when called', () => {
    const itrfCoordinates = satellite.toITRF(exampleDate);

    expect(itrfCoordinates).toMatchSnapshot();
  });

  // can calculate and return RIC coordinates
  it('should calculate and return RIC coordinates correctly', () => {
    const referenceSatellite = new Satellite({
      tle1: '1 25544U 98067A   21278.52661806  .00000800  00000-0  20684-4 0  9995' as TleLine1,
      tle2: '2 25544  51.6442  13.1247 0008036  23.6079 336.5377 15.48861704303602' as TleLine2,
    });

    const ric = satellite.toRIC(referenceSatellite, exampleDate);

    expect(ric).toMatchSnapshot();
  });

  // can calculate and return range to an observer
  it('should calculate and return range to an observer', () => {
    const range = satellite.rng(observer, exampleDate);

    expect(range).toMatchSnapshot();
  });

  // can calculate and return azimuth and elevation angles
  it('should calculate and return azimuth and elevation angles correctly', () => {
    const azimuth = satellite.az(observer, exampleDate);
    const elevation = satellite.el(observer, exampleDate);

    expect(azimuth).toMatchSnapshot();
    expect(elevation).toMatchSnapshot();
  });
});
