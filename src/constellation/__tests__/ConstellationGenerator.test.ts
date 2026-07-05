import { Degrees, Kilometers, ValidationError } from '../../main';
import { ConstellationGenerator } from '../ConstellationGenerator';

describe('ConstellationGenerator', () => {
  const testEpoch = new Date('2024-01-01T00:00:00Z');

  describe('walker()', () => {
    describe('basic functionality', () => {
      it('should generate correct number of satellites for 24/3/1 constellation', () => {
        const sats = ConstellationGenerator.walker(
          550 as Kilometers,
          53 as Degrees,
          24,
          3,
          1,
          testEpoch,
        );

        expect(sats.length).toBe(24);
      });

      it('should generate correct number of satellites for 6/2/0 constellation', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        expect(sats.length).toBe(6);
      });

      it('should generate single satellite for 1/1/0 constellation', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 1, 1, 0, testEpoch);

        expect(sats.length).toBe(1);
      });

      it('should generate satellites with correct naming convention', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        expect(sats[0].name).toBe('Walker-P1-S1');
        expect(sats[1].name).toBe('Walker-P1-S2');
        expect(sats[2].name).toBe('Walker-P1-S3');
        expect(sats[3].name).toBe('Walker-P2-S1');
        expect(sats[4].name).toBe('Walker-P2-S2');
        expect(sats[5].name).toBe('Walker-P2-S3');
      });
    });

    describe('orbital elements', () => {
      it('should set correct semi-major axis based on altitude', () => {
        const altitude = 550 as Kilometers;
        const sats = ConstellationGenerator.walker(altitude, 53 as Degrees, 1, 1, 0, testEpoch);

        // Earth.radiusMean is ~6371 km
        const expectedSma = 550 + 6371.00519;

        expect(Math.abs(sats[0].semiMajorAxis - expectedSma)).toBeLessThan(1);
      });

      it('should set correct inclination', () => {
        const inclination = 53 as Degrees;
        const sats = ConstellationGenerator.walker(550 as Kilometers, inclination, 1, 1, 0, testEpoch);

        expect(Math.abs(sats[0].inclination - 53)).toBeLessThan(0.1);
      });

      it('should generate near-circular orbits', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        for (const sat of sats) {
          expect(sat.eccentricity).toBeLessThan(0.001);
        }
      });
    });

    describe('RAAN distribution', () => {
      it('should space RAAN equally at 180 degrees for 2-plane constellation', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        const plane1Raan = sats[0].rightAscension;
        const plane2Raan = sats[3].rightAscension;

        // RAAN difference should be 180 degrees
        const raanDiff = Math.abs(plane2Raan - plane1Raan);

        expect(Math.abs(raanDiff - 180)).toBeLessThan(1);
      });

      it('should space RAAN equally at 120 degrees for 3-plane constellation', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 12, 3, 0, testEpoch);

        const plane1Raan = sats[0].rightAscension;
        const plane2Raan = sats[4].rightAscension;
        const plane3Raan = sats[8].rightAscension;

        expect(Math.abs(plane2Raan - plane1Raan - 120)).toBeLessThan(1);
        expect(Math.abs(plane3Raan - plane2Raan - 120)).toBeLessThan(1);
      });

      it('should space RAAN equally at 60 degrees for 6-plane constellation', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 24, 6, 0, testEpoch);

        const plane1Raan = sats[0].rightAscension;
        const plane2Raan = sats[4].rightAscension;

        expect(Math.abs(plane2Raan - plane1Raan - 60)).toBeLessThan(1);
      });
    });

    describe('satellite spacing within plane', () => {
      it('should space satellites equally within a plane', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        // 3 sats per plane = 120 degree spacing
        const sat1Ma = sats[0].meanAnomaly;
        const sat2Ma = sats[1].meanAnomaly;
        const sat3Ma = sats[2].meanAnomaly;

        // Normalize angles and check spacing
        let diff1 = (sat2Ma - sat1Ma + 360) % 360;
        let diff2 = (sat3Ma - sat2Ma + 360) % 360;

        if (diff1 > 180) {
          diff1 = 360 - diff1;
        }
        if (diff2 > 180) {
          diff2 = 360 - diff2;
        }

        expect(Math.abs(diff1 - 120)).toBeLessThan(5);
        expect(Math.abs(diff2 - 120)).toBeLessThan(5);
      });
    });

    describe('phasing', () => {
      it('should apply no offset when phasing is 0', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);

        // With F=0, first sat in each plane should have same relative position
        const plane1Sat1Ma = sats[0].meanAnomaly;
        const plane2Sat1Ma = sats[3].meanAnomaly;

        // They should be approximately equal (within tolerance)
        expect(Math.abs(plane1Sat1Ma - plane2Sat1Ma) % 360).toBeLessThan(5);
      });

      it('should apply offset when phasing is non-zero', () => {
        const satsNoPhase = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch);
        const satsWithPhase = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 1, testEpoch);

        // With F=1, plane 2 should be offset by 1*(360/6) = 60 degrees
        const p1s1NoPhase = satsNoPhase[0].meanAnomaly;
        const p2s1NoPhase = satsNoPhase[3].meanAnomaly;

        const p1s1WithPhase = satsWithPhase[0].meanAnomaly;
        const p2s1WithPhase = satsWithPhase[3].meanAnomaly;

        // Plane 1 should be the same in both
        expect(Math.abs(p1s1NoPhase - p1s1WithPhase)).toBeLessThan(1);

        // Plane 2 should be offset by 60 degrees in phased version
        const diffNoPhase = (p2s1NoPhase - p1s1NoPhase + 360) % 360;
        const diffWithPhase = (p2s1WithPhase - p1s1WithPhase + 360) % 360;

        expect(Math.abs((diffWithPhase - diffNoPhase + 360) % 360 - 60)).toBeLessThan(5);
      });
    });

    describe('propagation', () => {
      it('should generate satellites that can be propagated', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 1, testEpoch);

        const futureTime = new Date(testEpoch.getTime() + 60 * 60 * 1000); // 1 hour later

        for (const sat of sats) {
          const pos = sat.eci(futureTime);

          expect(pos).not.toBeNull();
          expect(pos!.position.x).toBeDefined();
          expect(pos!.position.y).toBeDefined();
          expect(pos!.position.z).toBeDefined();
          // Position magnitude should be roughly SMA
          const magnitude = Math.sqrt(pos!.position.x ** 2 + pos!.position.y ** 2 + pos!.position.z ** 2);

          expect(magnitude).toBeGreaterThan(6000);
          expect(magnitude).toBeLessThan(8000);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle polar orbit (90 degrees)', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 90 as Degrees, 4, 2, 0, testEpoch);

        expect(sats.length).toBe(4);
        expect(Math.abs(sats[0].inclination - 90)).toBeLessThan(0.1);
      });

      it('should handle retrograde orbit (>90 degrees)', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 120 as Degrees, 4, 2, 0, testEpoch);

        expect(sats.length).toBe(4);
        expect(Math.abs(sats[0].inclination - 120)).toBeLessThan(0.1);
      });

      it('should handle equatorial orbit (0 degrees)', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 0 as Degrees, 4, 2, 0, testEpoch);

        expect(sats.length).toBe(4);
        expect(sats[0].inclination).toBeLessThan(0.1);
      });

      it('should handle high altitude GEO-like orbit', () => {
        const sats = ConstellationGenerator.walker(35786 as Kilometers, 0 as Degrees, 3, 3, 0, testEpoch);

        expect(sats.length).toBe(3);
        // GEO SMA is about 42164 km
        expect(sats[0].semiMajorAxis).toBeGreaterThan(40000);
      });
    });
  });

  describe('fromPattern()', () => {
    describe('basic pattern parsing', () => {
      it('should parse basic T/P/F pattern with separate parameters', () => {
        const sats = ConstellationGenerator.fromPattern('24/3/1', testEpoch, 550 as Kilometers, 53 as Degrees);

        expect(sats.length).toBe(24);
      });

      it('should parse extended altitude:inclination:T/P/F pattern', () => {
        const sats = ConstellationGenerator.fromPattern('550:53:24/3/1', testEpoch);

        expect(sats.length).toBe(24);
      });

      it('should handle whitespace in pattern', () => {
        const sats = ConstellationGenerator.fromPattern('  550:53:6/2/0  ', testEpoch);

        expect(sats.length).toBe(6);
      });

      it('should prefer explicit parameters over pattern values', () => {
        // Pattern says 550:53, but we provide 600:60
        const sats = ConstellationGenerator.fromPattern('550:53:6/2/0', testEpoch, 600 as Kilometers, 60 as Degrees);

        expect(sats.length).toBe(6);
        // Should use the explicit parameters
        expect(sats[0].semiMajorAxis).toBeGreaterThan(6371 + 590); // ~600 km altitude
        expect(Math.abs(sats[0].inclination - 60)).toBeLessThan(1);
      });
    });

    describe('pattern validation', () => {
      it('should throw ValidationError for invalid pattern format', () => {
        expect(() => ConstellationGenerator.fromPattern('24/3', testEpoch, 550 as Kilometers, 53 as Degrees)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError when altitude missing from both pattern and params', () => {
        expect(() => ConstellationGenerator.fromPattern('24/3/1', testEpoch)).toThrow(ValidationError);
      });

      it('should throw ValidationError when inclination missing from both pattern and params', () => {
        expect(() => ConstellationGenerator.fromPattern('24/3/1', testEpoch, 550 as Kilometers)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for non-numeric values in pattern', () => {
        expect(() => ConstellationGenerator.fromPattern('abc:53:24/3/1', testEpoch)).toThrow(ValidationError);
      });

      it('should throw ValidationError for too many colons', () => {
        expect(() => ConstellationGenerator.fromPattern('550:53:24:3/1', testEpoch)).toThrow(ValidationError);
      });
    });
  });

  describe('validation', () => {
    describe('altitude validation', () => {
      it('should throw ValidationError for negative altitude', () => {
        expect(() => ConstellationGenerator.walker(-100 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for zero altitude', () => {
        expect(() => ConstellationGenerator.walker(0 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for altitude below 160 km', () => {
        expect(() => ConstellationGenerator.walker(100 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for altitude above 400,000 km', () => {
        expect(() => ConstellationGenerator.walker(500000 as Kilometers, 53 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should accept minimum valid altitude (160 km)', () => {
        const sats = ConstellationGenerator.walker(160 as Kilometers, 53 as Degrees, 1, 1, 0, testEpoch);

        expect(sats.length).toBe(1);
      });
    });

    describe('inclination validation', () => {
      it('should throw ValidationError for negative inclination', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, -10 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for inclination above 180', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 200 as Degrees, 6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should accept boundary inclination values', () => {
        const sats0 = ConstellationGenerator.walker(550 as Kilometers, 0 as Degrees, 1, 1, 0, testEpoch);
        const sats180 = ConstellationGenerator.walker(550 as Kilometers, 180 as Degrees, 1, 1, 0, testEpoch);

        expect(sats0.length).toBe(1);
        expect(sats180.length).toBe(1);
      });
    });

    describe('satellite count validation', () => {
      it('should throw ValidationError for non-integer totalSats', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6.5, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for zero totalSats', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 0, 1, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for negative totalSats', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, -6, 2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });
    });

    describe('planes validation', () => {
      it('should throw ValidationError for non-integer planes', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2.5, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for zero planes', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 0, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for negative planes', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, -2, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });
    });

    describe('divisibility validation', () => {
      it('should throw ValidationError when totalSats not divisible by planes', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 7, 3, 0, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should accept when totalSats is divisible by planes', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 12, 4, 0, testEpoch);

        expect(sats.length).toBe(12);
      });
    });

    describe('phasing validation', () => {
      it('should throw ValidationError for negative phasing', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, -1, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for phasing >= planes', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 2, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should throw ValidationError for non-integer phasing', () => {
        expect(() => ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 2, 0.5, testEpoch)).toThrow(
          ValidationError,
        );
      });

      it('should accept maximum valid phasing (planes - 1)', () => {
        const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 6, 3, 2, testEpoch);

        expect(sats.length).toBe(6);
      });
    });
  });

  describe('real-world constellations', () => {
    it('should generate GPS-like constellation (24/6/1)', () => {
      const sats = ConstellationGenerator.walker(20200 as Kilometers, 55 as Degrees, 24, 6, 1, testEpoch);

      expect(sats.length).toBe(24);
      expect(Math.abs(sats[0].inclination - 55)).toBeLessThan(0.5);
      // MEO altitude should give SMA around 26,500 km
      expect(sats[0].semiMajorAxis).toBeGreaterThan(26000);
    });

    it('should generate Iridium-like constellation (66/6/2)', () => {
      const sats = ConstellationGenerator.walker(780 as Kilometers, 86.4 as Degrees, 66, 6, 2, testEpoch);

      expect(sats.length).toBe(66);
      expect(Math.abs(sats[0].inclination - 86.4)).toBeLessThan(0.5);
    });

    it('should generate Galileo-like constellation (24/3/1)', () => {
      const sats = ConstellationGenerator.walker(23222 as Kilometers, 56 as Degrees, 24, 3, 1, testEpoch);

      expect(sats.length).toBe(24);
      expect(Math.abs(sats[0].inclination - 56)).toBeLessThan(0.5);
    });

    it('should generate Starlink-shell-like constellation using fromPattern', () => {
      // Starlink shell 1: ~550km, 53 deg, 72 sats per plane, 22 planes
      // Using smaller numbers for test: 22/11/1
      const sats = ConstellationGenerator.fromPattern('550:53:22/11/1', testEpoch);

      expect(sats.length).toBe(22);
    });
  });
});
