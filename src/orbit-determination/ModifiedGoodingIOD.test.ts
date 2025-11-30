import { EpochUTC, J2000, Kilometers, KilometersPerSecond, RadecTopocentric, Radians, RadiansPerSecond, Vector3D } from '../main';
import { ObservationOptical } from '../observation/ObservationOptical';
import { ModifiedGoodingIOD } from './ModifiedGoodingIOD';

describe('ModifiedGoodingIOD', () => {
  let iod: ModifiedGoodingIOD;
  let mockObservations: ObservationOptical[];

  beforeEach(() => {
    iod = new ModifiedGoodingIOD();

    const site = new J2000(
      EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z')),
      new Vector3D<Kilometers>(8000 as Kilometers, 7000 as Kilometers, 8000 as Kilometers),
      new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
    const epoch1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
    const epoch2 = EpochUTC.fromDateTime(new Date('2024-01-01T00:10:00.000Z'));
    const epoch3 = EpochUTC.fromDateTime(new Date('2024-01-01T00:20:00.000Z'));

    const radec1 = new RadecTopocentric(epoch1, 0.5 as Radians, 0.5 as Radians, 10000 as Kilometers, 0 as RadiansPerSecond, 0 as RadiansPerSecond);
    const radec2 = new RadecTopocentric(epoch2, 0.6 as Radians, 0.6 as Radians, 10000 as Kilometers, 0 as RadiansPerSecond, 0 as RadiansPerSecond);
    const radec3 = new RadecTopocentric(epoch3, 0.7 as Radians, 0.7 as Radians, 10000 as Kilometers, 0 as RadiansPerSecond, 0 as RadiansPerSecond);

    mockObservations = [
      new ObservationOptical(site, radec1),
      new ObservationOptical(site, radec2),
      new ObservationOptical(site, radec3),
    ];
  });

  describe('constructor', () => {
    it('should create instance with default Earth mu', () => {
      expect(iod).toBeInstanceOf(ModifiedGoodingIOD);
    });

    it('should create instance with custom mu', () => {
      const customIod = new ModifiedGoodingIOD(398600.4418);

      expect(customIod).toBeInstanceOf(ModifiedGoodingIOD);
    });
  });

  describe('solve', () => {
    it('should throw error when fewer than 3 observations provided', () => {
      expect(() => {
        iod.solve([mockObservations[0], mockObservations[1]]);
      }).toThrow('At least 3 observations required for Gooding IOD.');
    });

    it('should return J2000 state when valid observations provided', () => {
      const result = iod.solve(mockObservations);

      expect(result).toBeInstanceOf(J2000);
      expect(result.position).toBeInstanceOf(Vector3D);
      expect(result.velocity).toBeInstanceOf(Vector3D);
    });

    it('should accept optional solve parameters', () => {
      const result = iod.solve(mockObservations, undefined, undefined, {
        nRev: 1,
        direction: false,
        posSearch: 20.0,
        velSearch: 0.2,
        tolerance: 1e-8,
        printIter: false,
      });

      expect(result).toBeInstanceOf(J2000);
    });

    it('should accept initial range estimates', () => {
      const r0 = 7000 as Kilometers;
      const rN = 7000 as Kilometers;
      const result = iod.solve(mockObservations, r0, rN);

      expect(result).toBeInstanceOf(J2000);
    });

    it('should use default options when not provided', () => {
      const result = iod.solve(mockObservations);

      expect(result).toBeInstanceOf(J2000);
    });
  });
});
