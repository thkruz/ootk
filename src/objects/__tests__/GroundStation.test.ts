/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { Geodetic } from '../../coordinate/Geodetic';
import { Degrees, Kilometers, Radians, SpaceObjectType } from '../../types/types';
import { DEG2RAD } from '../../utils/constants';
import { GroundStation } from '../GroundStation';

describe('GroundStation', () => {
  describe('constructor', () => {
    it('should create a GroundStation with valid parameters', () => {
      const station = new GroundStation({
        id: 3001,
        name: 'Test Station',
        lat: 40.7128 as Degrees,
        lon: -74.006 as Degrees,
        alt: 0.01 as Kilometers,
      });

      expect(station).toBeDefined();
      expect(station.id).toBe(3001);
      expect(station.name).toBe('Test Station');
      expect(station.lat).toBe(40.7128);
      expect(station.lon).toBe(-74.006);
      expect(station.alt).toBe(0.01);
      expect(station.type).toBe(SpaceObjectType.GROUND_SENSOR_STATION);
    });

    it('should throw error for invalid latitude', () => {
      expect(
        () =>
          new GroundStation({
            id: 3002,
            lat: 91 as Degrees,
            lon: 0 as Degrees,
            alt: 0 as Kilometers,
          }),
      ).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      expect(
        () =>
          new GroundStation({
            id: 3002,
            lat: 0 as Degrees,
            lon: 181 as Degrees,
            alt: 0 as Kilometers,
          }),
      ).toThrow('Invalid longitude');
    });
  });

  describe('fromGeodetic', () => {
    it('should create a GroundStation from Geodetic coordinates', () => {
      const geodetic = new Geodetic(
        (40.7128 * DEG2RAD) as Radians,
        (-74.006 * DEG2RAD) as Radians,
        0.01 as Kilometers,
      );

      const station = GroundStation.fromGeodetic(geodetic, 'NYC Station', 3005);

      expect(station.id).toBe(3005);
      expect(station.name).toBe('NYC Station');
      expect(station.lat).toBeCloseTo(40.7128, 4);
      expect(station.lon).toBeCloseTo(-74.006, 4);
      expect(station.alt).toBe(0.01);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the GroundStation', () => {
      const original = new GroundStation({
        id: 3003,
        name: 'Original Station',
        lat: 45 as Degrees,
        lon: -90 as Degrees,
        alt: 0.5 as Kilometers,
        metadata: { key: 'value' },
      });

      const cloned = original.clone();

      expect(cloned).not.toBe(original);
      expect(cloned.id).toBe(original.id);
      expect(cloned.name).toBe(original.name);
      expect(cloned.lat).toBe(original.lat);
      expect(cloned.lon).toBe(original.lon);
      expect(cloned.alt).toBe(original.alt);
    });

    it('should have independent sensors and commDevices arrays', () => {
      const original = new GroundStation({
        id: 3003,
        lat: 45 as Degrees,
        lon: -90 as Degrees,
        alt: 0 as Kilometers,
      });

      const cloned = original.clone();

      expect(cloned.sensors).not.toBe(original.sensors);
      expect(cloned.commDevices).not.toBe(original.commDevices);
    });
  });

  describe('moveTo', () => {
    it('should create a new GroundStation at the specified position', () => {
      const original = new GroundStation({
        id: 3003,
        name: 'Original Station',
        lat: 40 as Degrees,
        lon: -74 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const moved = original.moveTo(51.5 as Degrees, -0.1 as Degrees);

      expect(moved).not.toBe(original);
      expect(moved.lat).toBe(51.5);
      expect(moved.lon).toBe(-0.1);
      expect(moved.alt).toBe(0.1); // altitude preserved
      expect(moved.id).toBe(original.id);
      expect(moved.name).toBe(original.name);
    });

    it('should leave the original instance unchanged', () => {
      const original = new GroundStation({
        id: 3003,
        lat: 40 as Degrees,
        lon: -74 as Degrees,
        alt: 0.1 as Kilometers,
      });

      original.moveTo(51.5 as Degrees, -0.1 as Degrees);

      expect(original.lat).toBe(40);
      expect(original.lon).toBe(-74);
      expect(original.alt).toBe(0.1);
    });

    it('should allow specifying a new altitude', () => {
      const original = new GroundStation({
        id: 3003,
        lat: 40 as Degrees,
        lon: -74 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const moved = original.moveTo(51.5 as Degrees, -0.1 as Degrees, 0.5 as Kilometers);

      expect(moved.alt).toBe(0.5);
    });

    it('should validate the new position', () => {
      const station = new GroundStation({
        id: 3004,
        lat: 40 as Degrees,
        lon: -74 as Degrees,
        alt: 0 as Kilometers,
      });

      expect(() => station.moveTo(100 as Degrees, 0 as Degrees)).toThrow('Invalid latitude');
      expect(() => station.moveTo(0 as Degrees, 200 as Degrees)).toThrow('Invalid longitude');
    });
  });

  describe('isGroundObject', () => {
    it('should return true', () => {
      const station = new GroundStation({
        id: 3004,
        lat: 0 as Degrees,
        lon: 0 as Degrees,
        alt: 0 as Kilometers,
      });

      expect(station.isGroundObject()).toBe(true);
    });
  });

  describe('toString', () => {
    it('should return a formatted string representation', () => {
      const station = new GroundStation({
        id: 3001,
        name: 'Test Station',
        lat: 40.7128 as Degrees,
        lon: -74.006 as Degrees,
        alt: 0.01 as Kilometers,
      });

      const str = station.toString();

      expect(str).toContain('[GroundStation]');
      expect(str).toContain('3001');
      expect(str).toContain('Test Station');
      expect(str).toContain('40.7128');
      expect(str).toContain('-74.0060');
    });
  });
});
