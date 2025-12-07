import { J2000, Kilometers, KilometersPerSecond, Seconds, SpaceObjectType, Vector3D } from '../../main';
import { EpochUTC } from '../../time/EpochUTC';
import { CenterBody, CenterBodyMu } from '../CenterBody';
import { EphemerisSatellite } from '../EphemerisSatellite';
import { InterpolatorType } from '../InterpolatorType';

describe('EphemerisSatellite', () => {
  let testEphemeris: J2000[];
  // Base epoch: Jan 1, 2024 00:00:00 UTC
  const baseEpoch = 1704067200;

  beforeEach(() => {
    // Create sample ephemeris data for testing (ISS-like orbit)
    // Using realistic LEO state vectors
    testEphemeris = [
      new J2000(
        new EpochUTC((baseEpoch + 0) as Seconds),
        new Vector3D(6878.137, 0, 0) as Vector3D<Kilometers>,
        new Vector3D(0, 7.612, 0) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 600) as Seconds),
        new Vector3D(6000, 3000, 1000) as Vector3D<Kilometers>,
        new Vector3D(-2, 6, 1) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 1200) as Seconds),
        new Vector3D(4000, 5000, 2000) as Vector3D<Kilometers>,
        new Vector3D(-4, 4, 2) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 1800) as Seconds),
        new Vector3D(1000, 6000, 3000) as Vector3D<Kilometers>,
        new Vector3D(-6, 2, 2) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 2400) as Seconds),
        new Vector3D(-2000, 6500, 3500) as Vector3D<Kilometers>,
        new Vector3D(-7, -1, 1) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 3000) as Seconds),
        new Vector3D(-5000, 5000, 3000) as Vector3D<Kilometers>,
        new Vector3D(-5, -4, 0) as Vector3D<KilometersPerSecond>,
      ),
    ];
  });

  describe('constructor', () => {
    it('should create instance with valid ephemeris', () => {
      const sat = new EphemerisSatellite({
        id: 6001,
        name: 'Test Satellite',
        ephemeris: testEphemeris,
      });

      expect(sat).toBeInstanceOf(EphemerisSatellite);
      expect(sat.id).toBe(6001);
      expect(sat.name).toBe('Test Satellite');
      expect(sat.type).toBe(SpaceObjectType.EPHEMERIS_SATELLITE);
    });

    it('should throw error for empty ephemeris', () => {
      expect(() => {
        new EphemerisSatellite({
          id: 6002,
          name: 'Test',
          ephemeris: [],
        });
      }).toThrow('Ephemeris array cannot be empty');
    });

    it('should use default center body (EARTH)', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      expect(sat.centerBody).toBe(CenterBody.EARTH);
    });

    it('should accept custom center body', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        centerBody: CenterBody.MOON,
      });

      expect(sat.centerBody).toBe(CenterBody.MOON);
      expect(sat.mu).toBe(CenterBodyMu[CenterBody.MOON]);
    });

    it('should store metadata', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        metadata: { source: 'JPL', mission: 'Apollo' },
      });

      expect(sat.metadata).toEqual({ source: 'JPL', mission: 'Apollo' });
    });
  });

  describe('fromEphemeris', () => {
    it('should create instance from ephemeris array', () => {
      const sat = EphemerisSatellite.fromEphemeris('Test Sat', testEphemeris);

      expect(sat).toBeInstanceOf(EphemerisSatellite);
      expect(sat.name).toBe('Test Sat');
    });

    it('should accept options', () => {
      const sat = EphemerisSatellite.fromEphemeris('Test Sat', testEphemeris, {
        id: 6004,
        centerBody: CenterBody.MARS,
        interpolatorType: InterpolatorType.CUBIC_SPLINE,
      });

      expect(sat.id).toBe(6004);
      expect(sat.centerBody).toBe(CenterBody.MARS);
    });
  });

  describe('eci', () => {
    it('should return interpolated state for valid time', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 900) * 1000); // 900 seconds into coverage
      const state = sat.eci(date);

      expect(state).not.toBeNull();
      expect(state?.position).toBeDefined();
      expect(state?.velocity).toBeDefined();
    });

    it('should return null for time outside coverage', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 10000) * 1000); // Way outside
      const state = sat.eci(date);

      expect(state).toBeNull();
    });
  });

  describe('getJ2000', () => {
    it('should return J2000 state for valid epoch', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const epoch = new EpochUTC((baseEpoch + 600) as Seconds);
      const state = sat.getJ2000(epoch);

      expect(state).not.toBeNull();
      expect(state?.epoch.posix).toBe(baseEpoch + 600);
    });

    it('should return null for epoch outside coverage', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const epoch = new EpochUTC((baseEpoch + 10000) as Seconds);
      const state = sat.getJ2000(epoch);

      expect(state).toBeNull();
    });
  });

  describe('getTEME', () => {
    it('should return TEME state for valid epoch', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const epoch = new EpochUTC((baseEpoch + 600) as Seconds);
      const state = sat.getTEME(epoch);

      expect(state).not.toBeNull();
      expect(state?.position).toBeDefined();
      expect(state?.velocity).toBeDefined();
    });
  });

  describe('coverageWindow', () => {
    it('should reflect ephemeris bounds', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const window = sat.coverageWindow;

      expect(window.start.posix).toBe(baseEpoch);
      expect(window.end.posix).toBe(baseEpoch + 3000);
    });
  });

  describe('inCoverage', () => {
    it('should return true for epoch within window', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      expect(sat.inCoverage(new EpochUTC((baseEpoch + 600) as Seconds))).toBe(true);
      expect(sat.inCoverage(new EpochUTC((baseEpoch + 1500) as Seconds))).toBe(true);
    });

    it('should return false for epoch outside window', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      // Use epochs before the coverage window (but still positive)
      expect(sat.inCoverage(new EpochUTC((baseEpoch - 100) as Seconds))).toBe(false);
      expect(sat.inCoverage(new EpochUTC((baseEpoch + 5000) as Seconds))).toBe(false);
    });
  });

  describe('getOrbitPath', () => {
    it('should return Float32Array with correct format', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const path = sat.getOrbitPath(10);

      expect(path).toBeInstanceOf(Float32Array);
      expect(path.length).toBe(40); // 10 points * 4 values each (x, y, z, t)
    });

    it('should interpolate between ephemeris points', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const path = sat.getOrbitPath(5);

      // Check first point time (Float32 has limited precision for large epoch values)
      expect(path[3]).toBeCloseTo(baseEpoch, -3); // t0 = baseEpoch
      // Check last point time
      expect(path[19]).toBeCloseTo(baseEpoch + 3000, -3); // t4 = baseEpoch + 3000
    });
  });

  describe('getEphemerisAsFloat32', () => {
    it('should return raw ephemeris points', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const path = sat.getEphemerisAsFloat32();

      expect(path).toBeInstanceOf(Float32Array);
      expect(path.length).toBe(24); // 6 points * 4 values each
    });
  });

  describe('getNearestEphemerisPoint', () => {
    it('should find closest ephemeris point', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      // Epoch closer to baseEpoch + 600
      const nearest = sat.getNearestEphemerisPoint(new EpochUTC((baseEpoch + 650) as Seconds));

      expect(nearest).not.toBeNull();
      expect(nearest?.epoch.posix).toBe(baseEpoch + 600);
    });

    it('should return first point for very early epoch', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      // Still a positive epoch, but before coverage
      const nearest = sat.getNearestEphemerisPoint(new EpochUTC((baseEpoch - 500) as Seconds));

      expect(nearest).not.toBeNull();
      expect(nearest?.epoch.posix).toBe(baseEpoch); // First point
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        centerBody: CenterBody.MOON,
        metadata: { key: 'value' },
      });

      const cloned = sat.clone();

      expect(cloned).toBeInstanceOf(EphemerisSatellite);
      expect(cloned.id).toBe(sat.id);
      expect(cloned.name).toBe(sat.name);
      expect(cloned.centerBody).toBe(sat.centerBody);
      expect(cloned.metadata).toEqual(sat.metadata);

      // Should be independent
      expect(cloned).not.toBe(sat);
    });
  });

  describe('interpolator types', () => {
    it('should work with Lagrange interpolator (default)', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        interpolatorType: InterpolatorType.LAGRANGE,
      });

      const state = sat.getJ2000(new EpochUTC((baseEpoch + 600) as Seconds));

      expect(state).not.toBeNull();
    });

    it('should work with CubicSpline interpolator', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        interpolatorType: InterpolatorType.CUBIC_SPLINE,
      });

      const state = sat.getJ2000(new EpochUTC((baseEpoch + 600) as Seconds));

      expect(state).not.toBeNull();
    });

    it('should work with VerletBlend interpolator', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        interpolatorType: InterpolatorType.VERLET_BLEND,
      });

      const state = sat.getJ2000(new EpochUTC((baseEpoch + 600) as Seconds));

      expect(state).not.toBeNull();
    });
  });

  describe('ecef', () => {
    it('should return ECEF coordinates for valid time', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 600) * 1000);
      const ecef = sat.ecef(date);

      expect(ecef).not.toBeNull();
      expect(ecef?.x).toBeDefined();
      expect(ecef?.y).toBeDefined();
      expect(ecef?.z).toBeDefined();
    });

    it('should throw for time outside coverage', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 10000) * 1000);

      // ecef() uses toJ2000() internally which throws
      expect(() => sat.ecef(date)).toThrow('outside ephemeris coverage window');
    });
  });

  describe('lla', () => {
    it('should return geodetic coordinates for valid time', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 600) * 1000);
      const lla = sat.lla(date);

      expect(lla).not.toBeNull();
      expect(lla?.lat).toBeDefined();
      expect(lla?.lon).toBeDefined();
      expect(lla?.alt).toBeDefined();
      // Altitude should be positive (above Earth's surface)
      expect(lla!.alt).toBeGreaterThan(0);
    });
  });

  describe('toJ2000', () => {
    it('should return J2000 for valid date', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 600) * 1000);
      const j2000 = sat.toJ2000(date);

      expect(j2000).toBeDefined();
      expect(j2000.position).toBeDefined();
      expect(j2000.velocity).toBeDefined();
    });

    it('should throw for date outside coverage', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 10000) * 1000);

      expect(() => sat.toJ2000(date)).toThrow('outside ephemeris coverage window');
    });
  });

  describe('toITRF', () => {
    it('should return ITRF for valid date', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const date = new Date((baseEpoch + 600) * 1000);
      const itrf = sat.toITRF(date);

      expect(itrf).toBeDefined();
      expect(itrf.position).toBeDefined();
    });
  });

  describe('toClassicalElements', () => {
    it('should return classical elements for valid date', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      // Use first point - circular orbit at 500km altitude
      const date = new Date(baseEpoch * 1000);
      const elements = sat.toClassicalElements(date);

      expect(elements).toBeDefined();
      // Semi-major axis should be reasonable for this orbit
      expect(elements.semimajorAxis).toBeDefined();
    });
  });

  describe('getLinearInterpolatedState', () => {
    it('should return linear interpolated state', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const epoch = new EpochUTC((baseEpoch + 300) as Seconds); // Between first two points
      const state = sat.getLinearInterpolatedState(epoch);

      expect(state).not.toBeNull();
      expect(state?.position).toBeDefined();
      expect(state?.velocity).toBeDefined();
      expect(state?.stateVectorIndex).toBe(0);
    });

    it('should return null for epoch before coverage', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      // Use a positive epoch that's still before coverage
      const epoch = new EpochUTC((baseEpoch - 100) as Seconds);
      const state = sat.getLinearInterpolatedState(epoch);

      expect(state).toBeNull();
    });

    it('should return last point for epoch at end', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      const epoch = new EpochUTC((baseEpoch + 3000) as Seconds);
      const state = sat.getLinearInterpolatedState(epoch);

      expect(state).not.toBeNull();
      expect(state?.stateVectorIndex).toBe(5); // Last index
    });
  });

  describe('ephemerisLength', () => {
    it('should return number of state vectors', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      expect(sat.ephemerisLength).toBe(6);
    });
  });

  describe('interpolatorSizeBytes', () => {
    it('should return size in bytes', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
      });

      expect(sat.interpolatorSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('mu (gravitational parameter)', () => {
    it('should return correct mu for Earth', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        centerBody: CenterBody.EARTH,
      });

      expect(sat.mu).toBeCloseTo(398600.4418, 0);
    });

    it('should return correct mu for Moon', () => {
      const sat = new EphemerisSatellite({
        id: 6003,
        name: 'Test',
        ephemeris: testEphemeris,
        centerBody: CenterBody.MOON,
      });

      expect(sat.mu).toBeCloseTo(4902.8, 0);
    });
  });
});
