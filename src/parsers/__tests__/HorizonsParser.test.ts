/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { HorizonsParser, ParseError } from '../../main';

describe('HorizonsParser', () => {
  describe('parseVectors', () => {
    const sampleVectorData = `*******************************************************************************
JPL/HORIZONS                      1 Ceres                   2024-Dec-01 00:00:00
*******************************************************************************
Target body name: 1 Ceres
Center body name: Sun (10)
Reference frame: ICRF
$$SOE
2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB
   X = 1.234567890123456E+08 Y =-2.345678901234567E+08 Z =-1.234567890123456E+07
   VX= 1.234567890123456E+01 VY= 8.765432109876543E+00 VZ=-1.234567890123456E+00
2460646.500000000 = A.D. 2024-Dec-02 00:00:00.0000 TDB
   X = 1.345678901234567E+08 Y =-2.234567890123456E+08 Z =-1.134567890123456E+07
   VX= 1.334567890123456E+01 VY= 8.665432109876543E+00 VZ=-1.134567890123456E+00
$$EOE
*******************************************************************************`;

    it('should parse vector data', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);

      expect(result).toHaveProperty('ephemeris');
      expect(Array.isArray(result.ephemeris)).toBe(true);
      expect(result.ephemeris.length).toBe(2);
    });

    it('should extract epoch correctly', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);
      const firstEntry = result.ephemeris[0];

      expect(firstEntry).toHaveProperty('epoch');
      expect(firstEntry.epoch.toDateTime()).toBeInstanceOf(Date);
    });

    it('should extract position vector', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);
      const firstEntry = result.ephemeris[0];

      expect(firstEntry).toHaveProperty('position');
      expect(firstEntry.position).toHaveProperty('x');
      expect(firstEntry.position).toHaveProperty('y');
      expect(firstEntry.position).toHaveProperty('z');
    });

    it('should extract velocity vector', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);
      const firstEntry = result.ephemeris[0];

      expect(firstEntry).toHaveProperty('velocity');
      expect(firstEntry.velocity).toHaveProperty('x');
      expect(firstEntry.velocity).toHaveProperty('y');
      expect(firstEntry.velocity).toHaveProperty('z');
    });

    it('should parse scientific notation correctly', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);
      const firstEntry = result.ephemeris[0];

      // X = 1.234567890123456E+08 km
      expect(firstEntry.position.x).toBeCloseTo(1.234567890123456e8, 0);
    });

    it('should handle negative values', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);
      const firstEntry = result.ephemeris[0];

      // Y and Z are negative
      expect(firstEntry.position.y).toBeLessThan(0);
      expect(firstEntry.position.z).toBeLessThan(0);
    });

    it('should detect heliocentric from center body', () => {
      const result = HorizonsParser.parseVectors(sampleVectorData);

      expect(result.isHeliocentric).toBe(true);
    });
  });

  describe('parseObserver', () => {
    const sampleObserverData = `*******************************************************************************
JPL/HORIZONS                      1 Ceres                   2024-Dec-01 00:00:00
*******************************************************************************
Target body name: 1 Ceres
Center-site name: GEOCENTRIC
$$SOE
 2024-Dec-01 00:00,  123.4567,  -45.6789,  12.345,  100.123
 2024-Dec-02 00:00,  124.5678,  -44.5678,  12.456,  101.234
$$EOE
*******************************************************************************`;

    it('should parse observer data', () => {
      const result = HorizonsParser.parseObserver(sampleObserverData);

      expect(result).toHaveProperty('observations');
      expect(Array.isArray(result.observations)).toBe(true);
    });

    it('should extract target name', () => {
      const result = HorizonsParser.parseObserver(sampleObserverData);

      expect(result.targetName).toBe('1 Ceres');
    });
  });

  describe('target name parsing', () => {
    it('should strip parenthetical descriptors from target name', () => {
      const data = `Target body name: Artemis II (spacecraft) (-1024) {source: Artemis_II_merged}
Center body name: Earth (399)
Reference frame: ICRF
$$SOE
2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB
   X = 1.000000000000000E+04 Y = 2.000000000000000E+04 Z = 3.000000000000000E+04
   VX= 1.000000000000000E+00 VY= 2.000000000000000E+00 VZ= 3.000000000000000E+00
$$EOE`;

      const result = HorizonsParser.parseVectors(data);

      expect(result.targetName).toBe('Artemis II');
    });

    it('should strip numeric ID parenthetical from planet names', () => {
      const data = `Target body name: Mars (499)
Center body name: Sun (10)
$$SOE
2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB
   X = 1.000000000000000E+08 Y = 2.000000000000000E+08 Z = 3.000000000000000E+07
   VX= 1.000000000000000E+01 VY= 2.000000000000000E+01 VZ= 3.000000000000000E+00
$$EOE`;

      const result = HorizonsParser.parseVectors(data);

      expect(result.targetName).toBe('Mars');
    });

    it('should preserve simple names without parenthetical suffixes', () => {
      const data = `Target body name: 1 Ceres
Center body name: Sun (10)
$$SOE
2460645.500000000 = A.D. 2024-Dec-01 00:00:00.0000 TDB
   X = 1.000000000000000E+08 Y = 2.000000000000000E+08 Z = 3.000000000000000E+07
   VX= 1.000000000000000E+01 VY= 2.000000000000000E+01 VZ= 3.000000000000000E+00
$$EOE`;

      const result = HorizonsParser.parseVectors(data);

      expect(result.targetName).toBe('1 Ceres');
    });
  });

  describe('edge cases', () => {
    it('should throw ParseError for empty input', () => {
      expect(() => HorizonsParser.parseVectors('')).toThrow(ParseError);
      expect(() => HorizonsParser.parseVectors('')).toThrow('Horizons data is empty');
    });

    it('should throw ParseError for missing $$SOE/$$EOE markers', () => {
      const invalidData = 'No markers here';

      expect(() => HorizonsParser.parseVectors(invalidData)).toThrow(ParseError);
      expect(() => HorizonsParser.parseVectors(invalidData)).toThrow('Missing $$SOE or $$EOE markers');
    });
  });
});
