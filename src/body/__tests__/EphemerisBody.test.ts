/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  EphemerisBody,
  CelestialBodyType,
  Vector3D,
  Kilometers,
  KilometersPerSecond,
  EpochUTC,
} from '../../main';

describe('EphemerisBody', () => {
  // Create test ephemeris data
  const createTestEphemeris = () => [
    {
      epoch: EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z')),
      position: new Vector3D(
        300_000_000 as Kilometers,
        100_000_000 as Kilometers,
        50_000_000 as Kilometers,
      ),
      velocity: new Vector3D(
        10 as KilometersPerSecond,
        5 as KilometersPerSecond,
        2 as KilometersPerSecond,
      ),
    },
    {
      epoch: EpochUTC.fromDateTime(new Date('2024-01-02T00:00:00Z')),
      position: new Vector3D(
        300_864_000 as Kilometers, // ~10 km/s * 86400 s
        100_432_000 as Kilometers,
        50_172_800 as Kilometers,
      ),
      velocity: new Vector3D(
        10 as KilometersPerSecond,
        5 as KilometersPerSecond,
        2 as KilometersPerSecond,
      ),
    },
    {
      epoch: EpochUTC.fromDateTime(new Date('2024-01-03T00:00:00Z')),
      position: new Vector3D(
        301_728_000 as Kilometers,
        100_864_000 as Kilometers,
        50_345_600 as Kilometers,
      ),
      velocity: new Vector3D(
        10 as KilometersPerSecond,
        5 as KilometersPerSecond,
        2 as KilometersPerSecond,
      ),
    },
  ];

  describe('constructor', () => {
    it('should create instance with valid ephemeris', () => {
      const body = new EphemerisBody({
        id: 9001,
        name: 'Test Asteroid',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      expect(body.name).toBe('Test Asteroid');
      expect(body.bodyType).toBe(CelestialBodyType.ASTEROID);
    });

    it('should throw error for empty ephemeris', () => {
      expect(() => {
        new EphemerisBody({
          id: 9002,
          name: 'Empty',
          bodyType: CelestialBodyType.ASTEROID,
          ephemeris: [],
        });
      }).toThrow('Ephemeris array cannot be empty');
    });
  });

  describe('validity window', () => {
    it('should return validity window', () => {
      const ephemeris = createTestEphemeris();
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris,
        isHeliocentric: true,
      });

      const window = body.getValidityWindow();

      expect(window.start).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(window.end).toEqual(new Date('2024-01-03T00:00:00Z'));
    });

    it('should return true for date within validity window', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      expect(body.isValidAt(new Date('2024-01-02T00:00:00Z'))).toBe(true);
    });

    it('should return false for date outside validity window', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      expect(body.isValidAt(new Date('2024-06-01T00:00:00Z'))).toBe(false);
    });
  });

  describe('heliocentric position', () => {
    it('should return interpolated position for heliocentric body', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      const position = body.heliocentric(new Date('2024-01-02T00:00:00Z'));

      expect(position).toBeInstanceOf(Vector3D);
      expect(position.magnitude()).toBeGreaterThan(0);
    });

    it('should throw error for date outside validity window', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      expect(() => {
        body.heliocentric(new Date('2025-01-01T00:00:00Z'));
      }).toThrow('outside ephemeris validity');
    });

    it('should throw for geocentric body calling heliocentric', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: false,
      });

      expect(() => {
        body.heliocentric(new Date('2024-01-02T00:00:00Z'));
      }).toThrow('Geocentric to heliocentric conversion not yet implemented');
    });
  });

  describe('eci position', () => {
    it('should throw for heliocentric body calling eci', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      expect(() => {
        body.eci(new Date('2024-01-02T00:00:00Z'));
      }).toThrow('Heliocentric to geocentric conversion not yet implemented');
    });

    it('should return position for geocentric body', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: false,
      });

      const position = body.eci(new Date('2024-01-02T00:00:00Z'));

      expect(position).toBeInstanceOf(Vector3D);
    });
  });

  describe('velocity', () => {
    it('should return velocity when available', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: false,
      });

      const velocity = body.velocity(new Date('2024-01-02T00:00:00Z'));

      expect(velocity).toBeInstanceOf(Vector3D);
    });

    it('should return null when velocity not available', () => {
      const ephemerisNoVelocity = createTestEphemeris().map((ep) => ({
        epoch: ep.epoch,
        position: ep.position,
        // No velocity
      }));

      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: ephemerisNoVelocity,
        isHeliocentric: false,
      });

      const velocity = body.velocity(new Date('2024-01-02T00:00:00Z'));

      expect(velocity).toBeNull();
    });
  });

  describe('interpolation types', () => {
    it('should support lagrange interpolation', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: false,
        interpolationType: 'lagrange',
        interpolationOrder: 2,
      });

      const position = body.eci(new Date('2024-01-02T00:00:00Z'));

      expect(position).toBeInstanceOf(Vector3D);
    });

    it('should support spline interpolation', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: false,
        interpolationType: 'spline',
      });

      const position = body.eci(new Date('2024-01-02T00:00:00Z'));

      expect(position).toBeInstanceOf(Vector3D);
    });
  });

  describe('fromData factory', () => {
    it('should create EphemerisBody from raw data', () => {
      const data = [
        {
          date: new Date('2024-01-01T00:00:00Z'),
          position: { x: 300_000_000, y: 100_000_000, z: 50_000_000 },
          velocity: { x: 10, y: 5, z: 2 },
        },
        {
          date: new Date('2024-01-02T00:00:00Z'),
          position: { x: 300_864_000, y: 100_432_000, z: 50_172_800 },
          velocity: { x: 10, y: 5, z: 2 },
        },
        {
          date: new Date('2024-01-03T00:00:00Z'),
          position: { x: 301_728_000, y: 100_864_000, z: 50_345_600 },
          velocity: { x: 10, y: 5, z: 2 },
        },
      ];

      const body = EphemerisBody.fromData(
        99,
        'Ceres',
        CelestialBodyType.DWARF_PLANET,
        data,
        { isHeliocentric: true },
      );

      expect(body.name).toBe('Ceres');
      expect(body.bodyType).toBe(CelestialBodyType.DWARF_PLANET);
    });
  });

  describe('serialization', () => {
    it('should serialize with ephemeris metadata', () => {
      const body = new EphemerisBody({
        id: 9003,
        name: 'Test',
        bodyType: CelestialBodyType.ASTEROID,
        ephemeris: createTestEphemeris(),
        isHeliocentric: true,
      });

      const serialized = body.serialize();

      expect(serialized).toHaveProperty('isHeliocentric', true);
      expect(serialized).toHaveProperty('validityStart');
      expect(serialized).toHaveProperty('validityEnd');
      expect(serialized).toHaveProperty('ephemerisCount', 3);
    });
  });
});
