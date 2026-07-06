/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { Degrees, Kilometers, SpaceObjectType } from '../../types/types';
import { DynamicGroundObject, WaypointData } from '../DynamicGroundObject';

describe('DynamicGroundObject', () => {
  // Test waypoints - simple path from North Pole to Iceland to New York
  const testWaypoints: WaypointData[] = [
    { time: new Date('2025-12-24T00:00:00Z'), lat: 90 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
    { time: new Date('2025-12-24T01:00:00Z'), lat: 64.1 as Degrees, lon: -21.9 as Degrees, alt: 10 as Kilometers },
    { time: new Date('2025-12-24T02:00:00Z'), lat: 40.7 as Degrees, lon: -74 as Degrees, alt: 10 as Kilometers },
  ];

  describe('constructor', () => {
    it('should create a DynamicGroundObject with valid waypoints', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(obj).toBeDefined();
      expect(obj.id).toBe(5001);
      expect(obj.name).toBe('Test Object');
      expect(obj.type).toBe(SpaceObjectType.DYNAMIC_GROUND_OBJECT);
      expect(obj.waypointCount).toBe(3);
      expect(obj.interpolationMethod).toBe('greatCircle');
    });

    it('should throw error with empty waypoints array', () => {
      expect(
        () =>
          new DynamicGroundObject({
            id: 5001,
            name: 'Test Object',
            waypoints: [],
          }),
      ).toThrow('DynamicGroundObject requires at least one waypoint');
    });

    it('should sort waypoints by time', () => {
      const unsortedWaypoints: WaypointData[] = [
        { time: new Date('2025-12-24T02:00:00Z'), lat: 40 as Degrees, lon: -74 as Degrees, alt: 10 as Kilometers },
        { time: new Date('2025-12-24T00:00:00Z'), lat: 90 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
        { time: new Date('2025-12-24T01:00:00Z'), lat: 64 as Degrees, lon: -22 as Degrees, alt: 10 as Kilometers },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: unsortedWaypoints,
      });

      const waypoints = obj.waypoints;

      expect(waypoints[0].lat).toBe(90);
      expect(waypoints[1].lat).toBe(64);
      expect(waypoints[2].lat).toBe(40);
    });

    it('should accept custom interpolation method', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'linear',
      });

      expect(obj.interpolationMethod).toBe('linear');
    });
  });

  describe('getLLA', () => {
    let obj: DynamicGroundObject;

    beforeEach(() => {
      obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'linear',
      });
    });

    it('should return exact waypoint position at waypoint time', () => {
      const lla = obj.getLLA(new Date('2025-12-24T00:00:00Z'));

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBe(90);
      expect(lla!.lon).toBe(0);
      expect(lla!.alt).toBe(10);
    });

    it('should interpolate position between waypoints', () => {
      // Midpoint between first and second waypoint
      const lla = obj.getLLA(new Date('2025-12-24T00:30:00Z'));

      expect(lla).not.toBeNull();
      // Should be roughly halfway between lat 90 and 64.1
      expect(lla!.lat).toBeGreaterThan(64.1);
      expect(lla!.lat).toBeLessThan(90);
    });

    it('should return null for time before first waypoint', () => {
      const lla = obj.getLLA(new Date('2025-12-23T23:00:00Z'));

      expect(lla).toBeNull();
    });

    it('should return null for time after last waypoint', () => {
      const lla = obj.getLLA(new Date('2025-12-24T03:00:00Z'));

      expect(lla).toBeNull();
    });

    it('should return last waypoint position at end time', () => {
      const lla = obj.getLLA(new Date('2025-12-24T02:00:00Z'));

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBeCloseTo(40.7, 5);
      expect(lla!.lon).toBeCloseTo(-74, 5);
    });
  });

  describe('interpolation methods', () => {
    // Two points on opposite sides of the globe
    const antipodalWaypoints: WaypointData[] = [
      { time: new Date('2025-01-01T00:00:00Z'), lat: 0 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
      { time: new Date('2025-01-01T01:00:00Z'), lat: 0 as Degrees, lon: 90 as Degrees, alt: 10 as Kilometers },
    ];

    it('linear interpolation should take direct lat/lon path', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: antipodalWaypoints,
        interpolationMethod: 'linear',
      });

      const lla = obj.getLLA(new Date('2025-01-01T00:30:00Z'));

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBeCloseTo(0, 5);
      expect(lla!.lon).toBeCloseTo(45, 5); // Midpoint of 0 and 90
    });

    it('greatCircle interpolation should follow great circle path', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: antipodalWaypoints,
        interpolationMethod: 'greatCircle',
      });

      const lla = obj.getLLA(new Date('2025-01-01T00:30:00Z'));

      expect(lla).not.toBeNull();
      // Great circle at equator should be the same as linear for longitude
      expect(lla!.lon).toBeCloseTo(45, 5);
    });

    it('spline interpolation should produce smooth path', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'spline',
      });

      const lla = obj.getLLA(new Date('2025-12-24T00:30:00Z'));

      expect(lla).not.toBeNull();
      // Should be somewhere between the waypoints
      expect(lla!.lat).toBeGreaterThan(40);
      expect(lla!.lat).toBeLessThan(90);
    });
  });

  describe('longitude wrapping', () => {
    it('should handle longitude crossing -180/180 boundary correctly', () => {
      const wrappingWaypoints: WaypointData[] = [
        { time: new Date('2025-01-01T00:00:00Z'), lat: 45 as Degrees, lon: 170 as Degrees, alt: 10 as Kilometers },
        { time: new Date('2025-01-01T01:00:00Z'), lat: 45 as Degrees, lon: -170 as Degrees, alt: 10 as Kilometers },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: wrappingWaypoints,
        interpolationMethod: 'linear',
      });

      const lla = obj.getLLA(new Date('2025-01-01T00:30:00Z'));

      expect(lla).not.toBeNull();
      // Should cross at 180 or -180, so midpoint should be around 180 or -180
      expect(Math.abs(lla!.lon)).toBeGreaterThan(170);
    });
  });

  describe('getEci and getEcef', () => {
    let obj: DynamicGroundObject;

    beforeEach(() => {
      obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });
    });

    it('should return ECI position at valid time', () => {
      const eci = obj.getEci(new Date('2025-12-24T01:00:00Z'));

      expect(eci).not.toBeNull();
      expect(typeof eci!.x).toBe('number');
      expect(typeof eci!.y).toBe('number');
      expect(typeof eci!.z).toBe('number');
    });

    it('should return ECEF position at valid time', () => {
      const ecef = obj.getEcef(new Date('2025-12-24T01:00:00Z'));

      expect(ecef).not.toBeNull();
      expect(typeof ecef!.x).toBe('number');
      expect(typeof ecef!.y).toBe('number');
      expect(typeof ecef!.z).toBe('number');
    });

    it('should return null for invalid time', () => {
      expect(obj.getEci(new Date('2025-12-23T00:00:00Z'))).toBeNull();
      expect(obj.getEcef(new Date('2025-12-23T00:00:00Z'))).toBeNull();
    });
  });

  describe('getJ2000 and getGeodetic', () => {
    let obj: DynamicGroundObject;

    beforeEach(() => {
      obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });
    });

    it('should return J2000 state at valid time', () => {
      const j2000 = obj.getJ2000(new Date('2025-12-24T01:00:00Z'));

      expect(j2000).not.toBeNull();
      expect(j2000!.position).toBeDefined();
      expect(j2000!.velocity).toBeDefined();
    });

    it('should return Geodetic at valid time', () => {
      const geodetic = obj.getGeodetic(new Date('2025-12-24T01:00:00Z'));

      expect(geodetic).not.toBeNull();
      expect(geodetic!.lat).toBeDefined();
      expect(geodetic!.lon).toBeDefined();
      expect(geodetic!.alt).toBeDefined();
    });
  });

  describe('time-dependent base class method overrides', () => {
    it('should throw error when calling lla() without time', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(() => obj.lla()).toThrow('DynamicGroundObject position is time-dependent');
    });

    it('should throw error when calling ecef() without time', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(() => obj.ecef()).toThrow('DynamicGroundObject position is time-dependent');
    });

    it('should throw error when calling eci() without time', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(() => obj.eci()).toThrow('DynamicGroundObject position is time-dependent');
    });
  });

  describe('waypoint management', () => {
    it('should add waypoint and keep sorted order', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: [
          { time: new Date('2025-12-24T00:00:00Z'), lat: 90 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
          { time: new Date('2025-12-24T02:00:00Z'), lat: 40 as Degrees, lon: -74 as Degrees, alt: 10 as Kilometers },
        ],
      });

      obj.addWaypoint({
        time: new Date('2025-12-24T01:00:00Z'),
        lat: 64 as Degrees,
        lon: -22 as Degrees,
        alt: 10 as Kilometers,
      });

      expect(obj.waypointCount).toBe(3);
      const waypoints = obj.waypoints;

      expect(waypoints[1].lat).toBe(64);
    });

    it('should validate waypoint coordinates on add', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(() =>
        obj.addWaypoint({
          time: new Date('2025-12-24T03:00:00Z'),
          lat: 91 as Degrees,
          lon: 0 as Degrees,
          alt: 10 as Kilometers,
        }),
      ).toThrow('Invalid latitude');

      expect(() =>
        obj.addWaypoint({
          time: new Date('2025-12-24T03:00:00Z'),
          lat: 45 as Degrees,
          lon: 181 as Degrees,
          alt: 10 as Kilometers,
        }),
      ).toThrow('Invalid longitude');

      expect(() =>
        obj.addWaypoint({
          time: new Date('2025-12-24T03:00:00Z'),
          lat: 45 as Degrees,
          lon: 0 as Degrees,
          alt: -1 as Kilometers,
        }),
      ).toThrow('Invalid altitude');
    });

    it('should remove waypoint by time', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      const removed = obj.removeWaypoint(new Date('2025-12-24T01:00:00Z'));

      expect(removed).toBe(true);
      expect(obj.waypointCount).toBe(2);
    });

    it('should return false when removing non-existent waypoint', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      const removed = obj.removeWaypoint(new Date('2025-12-24T05:00:00Z'));

      expect(removed).toBe(false);
      expect(obj.waypointCount).toBe(3);
    });

    it('should throw error when removing last waypoint', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: [{ time: new Date('2025-12-24T00:00:00Z'), lat: 90 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers }],
      });

      expect(() => obj.removeWaypoint(new Date('2025-12-24T00:00:00Z'))).toThrow('Cannot remove last waypoint');
    });
  });

  describe('time window', () => {
    let obj: DynamicGroundObject;

    beforeEach(() => {
      obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });
    });

    it('should return correct start time', () => {
      expect(obj.startTime.toISOString()).toBe('2025-12-24T00:00:00.000Z');
    });

    it('should return correct end time', () => {
      expect(obj.endTime.toISOString()).toBe('2025-12-24T02:00:00.000Z');
    });

    it('should return correct duration', () => {
      expect(obj.duration).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
    });

    it('should correctly identify valid times', () => {
      expect(obj.isValidAt(new Date('2025-12-24T00:00:00Z'))).toBe(true);
      expect(obj.isValidAt(new Date('2025-12-24T01:00:00Z'))).toBe(true);
      expect(obj.isValidAt(new Date('2025-12-24T02:00:00Z'))).toBe(true);
      expect(obj.isValidAt(new Date('2025-12-23T23:00:00Z'))).toBe(false);
      expect(obj.isValidAt(new Date('2025-12-24T03:00:00Z'))).toBe(false);
    });
  });

  describe('history tracking', () => {
    it('should not track history by default', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(obj.positionHistory).toBeNull();
    });

    it('should track history when enabled via constructor', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      // Make some position queries
      obj.getLLA(new Date('2025-12-24T00:00:00Z'));
      obj.getLLA(new Date('2025-12-24T00:30:00Z'));
      obj.getLLA(new Date('2025-12-24T01:00:00Z'));

      expect(obj.positionHistory).not.toBeNull();
      expect(obj.positionHistory!.length).toBe(3);
    });

    it('should enable history after construction', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      obj.enableHistory({ maxLength: 50 });

      expect(obj.positionHistory).not.toBeNull();

      obj.getLLA(new Date('2025-12-24T01:00:00Z'));
      expect(obj.positionHistory!.length).toBe(1);
    });

    it('should disable history', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      obj.getLLA(new Date('2025-12-24T01:00:00Z'));
      obj.disableHistory();

      expect(obj.positionHistory).toBeNull();
    });
  });

  describe('getTrail', () => {
    it('should return all waypoints when count is less than maxPoints', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      const trail = obj.getTrail(10);

      expect(trail.length).toBe(3);
    });

    it('should sample waypoints when count exceeds maxPoints', () => {
      // Create many waypoints
      const manyWaypoints: WaypointData[] = [];

      for (let i = 0; i < 20; i++) {
        manyWaypoints.push({
          time: new Date(`2025-12-24T${String(i).padStart(2, '0')}:00:00Z`),
          lat: (45 + i) as Degrees,
          lon: (i * 5) as Degrees,
          alt: 10 as Kilometers,
        });
      }

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: manyWaypoints,
      });

      const trail = obj.getTrail(5);

      expect(trail.length).toBe(5);
    });

    it('should return history entries when history is enabled', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      // Query positions to populate history
      obj.getLLA(new Date('2025-12-24T00:00:00Z'));
      obj.getLLA(new Date('2025-12-24T00:30:00Z'));
      obj.getLLA(new Date('2025-12-24T01:00:00Z'));
      obj.getLLA(new Date('2025-12-24T01:30:00Z'));

      const trail = obj.getTrail(2);

      expect(trail.length).toBe(2);
      // Should return the last 2 entries
      expect(trail[0].time.getTime()).toBe(new Date('2025-12-24T01:00:00Z').getTime());
      expect(trail[1].time.getTime()).toBe(new Date('2025-12-24T01:30:00Z').getTime());
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'spline',
        metadata: { key: 'value' },
      });

      const cloned = obj.clone();

      expect(cloned.id).toBe(obj.id);
      expect(cloned.name).toBe(obj.name);
      expect(cloned.waypointCount).toBe(obj.waypointCount);
      expect(cloned.interpolationMethod).toBe(obj.interpolationMethod);
      expect(cloned.metadata).toEqual(obj.metadata);

      // Verify it's a deep copy
      cloned.addWaypoint({
        time: new Date('2025-12-24T03:00:00Z'),
        lat: 30 as Degrees,
        lon: -80 as Degrees,
        alt: 10 as Kilometers,
      });
      expect(cloned.waypointCount).toBe(4);
      expect(obj.waypointCount).toBe(3);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON-compatible format', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'linear',
      });

      const serialized = obj.serialize();

      expect(serialized.type).toBe('DynamicGroundObject');
      expect(serialized.id).toBe(5001);
      expect(serialized.name).toBe('Test Object');
      expect((serialized as Record<string, unknown>).waypoints).toBeDefined();
      expect((serialized as Record<string, unknown>).interpolationMethod).toBe('linear');
    });
  });

  describe('isGroundObject', () => {
    it('should return true', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(obj.isGroundObject()).toBe(true);
    });
  });

  describe('getCurrentLLA and getCurrentEci', () => {
    it('should return current position when time is valid', () => {
      // Create waypoints spanning a wide time range including now
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const waypoints: WaypointData[] = [
        { time: oneHourAgo, lat: 45 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers },
        { time: oneHourFromNow, lat: 46 as Degrees, lon: 1 as Degrees, alt: 10 as Kilometers },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints,
      });

      const currentLla = obj.getCurrentLLA();

      expect(currentLla).not.toBeNull();

      const currentEci = obj.getCurrentEci();

      expect(currentEci).not.toBeNull();
    });
  });

  describe('single waypoint', () => {
    it('should work with single waypoint', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: [{ time: new Date('2025-12-24T01:00:00Z'), lat: 45 as Degrees, lon: -75 as Degrees, alt: 5 as Kilometers }],
      });

      const lla = obj.getLLA(new Date('2025-12-24T01:00:00Z'));

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBe(45);
      expect(lla!.lon).toBe(-75);
      expect(lla!.alt).toBe(5);

      // Outside of single waypoint should return null
      expect(obj.getLLA(new Date('2025-12-24T00:00:00Z'))).toBeNull();
      expect(obj.getLLA(new Date('2025-12-24T02:00:00Z'))).toBeNull();
    });
  });

  describe('two waypoints edge cases', () => {
    it('should handle two waypoints at same location different times', () => {
      const waypoints: WaypointData[] = [
        { time: new Date('2025-01-01T00:00:00Z'), lat: 45 as Degrees, lon: -75 as Degrees, alt: 10 as Kilometers },
        { time: new Date('2025-01-01T01:00:00Z'), lat: 45 as Degrees, lon: -75 as Degrees, alt: 10 as Kilometers },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints,
      });

      const lla = obj.getLLA(new Date('2025-01-01T00:30:00Z'));

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBe(45);
      expect(lla!.lon).toBe(-75);
    });

    it('should handle two waypoints for spline (falls back to linear)', () => {
      const waypoints: WaypointData[] = [
        { time: new Date('2025-01-01T00:00:00Z'), lat: 40 as Degrees, lon: -75 as Degrees, alt: 10 as Kilometers },
        { time: new Date('2025-01-01T01:00:00Z'), lat: 50 as Degrees, lon: -70 as Degrees, alt: 20 as Kilometers },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints,
        interpolationMethod: 'spline',
      });

      const lla = obj.getLLA(new Date('2025-01-01T00:30:00Z'));

      expect(lla).not.toBeNull();
      // Should be close to midpoint
      expect(lla!.lat).toBeGreaterThan(40);
      expect(lla!.lat).toBeLessThan(50);
    });
  });

  describe('interpolation method change', () => {
    it('should allow changing interpolation method after construction', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        interpolationMethod: 'linear',
      });

      expect(obj.interpolationMethod).toBe('linear');

      obj.interpolationMethod = 'greatCircle';
      expect(obj.interpolationMethod).toBe('greatCircle');

      obj.interpolationMethod = 'spline';
      expect(obj.interpolationMethod).toBe('spline');
    });
  });

  describe('waypoint metadata', () => {
    it('should preserve waypoint metadata', () => {
      const waypoints: WaypointData[] = [
        {
          time: new Date('2025-12-24T00:00:00Z'),
          lat: 90 as Degrees,
          lon: 0 as Degrees,
          alt: 10 as Kilometers,
          metadata: { stop: 'North Pole', gifts: 0 },
        },
        {
          time: new Date('2025-12-24T01:00:00Z'),
          lat: 64.1 as Degrees,
          lon: -21.9 as Degrees,
          alt: 10 as Kilometers,
          metadata: { stop: 'Iceland', gifts: 1000 },
        },
      ];

      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints,
      });

      const retrievedWaypoints = obj.waypoints;

      expect(retrievedWaypoints[0].metadata).toEqual({ stop: 'North Pole', gifts: 0 });
      expect(retrievedWaypoints[1].metadata).toEqual({ stop: 'Iceland', gifts: 1000 });
    });
  });

  describe('history API consistency', () => {
    it('should provide isHistoryEnabled getter', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(obj.isHistoryEnabled).toBe(false);

      obj.enableHistory({ maxLength: 50 });
      expect(obj.isHistoryEnabled).toBe(true);

      obj.disableHistory();
      expect(obj.isHistoryEnabled).toBe(false);
    });

    it('should provide history getter as alias for positionHistory', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      expect(obj.history).toBe(obj.positionHistory);
      expect(obj.history).not.toBeNull();
    });

    it('should return null for both getters when history is disabled', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      expect(obj.history).toBeNull();
      expect(obj.positionHistory).toBeNull();
      expect(obj.isHistoryEnabled).toBe(false);
    });
  });

  describe('clone with history options', () => {
    it('should preserve history config but start empty by default', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      obj.getLLA(new Date('2025-12-24T01:00:00Z'));
      expect(obj.positionHistory!.length).toBe(1);

      const cloned = obj.clone();

      expect(cloned.isHistoryEnabled).toBe(true);
      expect(cloned.positionHistory!.config.maxLength).toBe(100);
      expect(cloned.positionHistory!.length).toBe(0);
    });

    it('should clone history entries when cloneHistory is true', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      obj.getLLA(new Date('2025-12-24T01:00:00Z'));
      obj.getLLA(new Date('2025-12-24T01:30:00Z'));

      const cloned = obj.clone({ cloneHistory: true });

      expect(cloned.positionHistory!.length).toBe(2);
    });

    it('should have independent history after cloning with cloneHistory', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
        historyConfig: { maxLength: 100 },
      });

      obj.getLLA(new Date('2025-12-24T01:00:00Z'));

      const cloned = obj.clone({ cloneHistory: true });

      // Add to original
      obj.getLLA(new Date('2025-12-24T01:30:00Z'));

      // Cloned should still have 1 entry
      expect(obj.positionHistory!.length).toBe(2);
      expect(cloned.positionHistory!.length).toBe(1);
    });

    it('should not have history enabled if original had no history', () => {
      const obj = new DynamicGroundObject({
        id: 5001,
        name: 'Test Object',
        waypoints: testWaypoints,
      });

      const cloned = obj.clone();

      expect(cloned.isHistoryEnabled).toBe(false);
    });
  });
});
