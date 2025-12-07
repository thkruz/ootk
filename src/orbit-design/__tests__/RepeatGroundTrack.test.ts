import { Degrees, Earth, Kilometers, ValidationError } from '../../main';
import { RepeatGroundTrack } from '../RepeatGroundTrack';

describe('RepeatGroundTrack', () => {
  const testEpoch = new Date('2024-01-01T00:00:00Z');

  describe('calculate()', () => {
    describe('basic functionality', () => {
      it('should calculate orbital elements for a simple RGT orbit', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 53 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
        expect(elements.semimajorAxis).toBeGreaterThan(Earth.radiusMean);
      });

      it('should return ClassicalElements with all required properties', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 53 as Degrees, { epoch: testEpoch });

        expect(elements.epoch).toBeDefined();
        expect(elements.semimajorAxis).toBeDefined();
        expect(elements.eccentricity).toBeDefined();
        expect(elements.inclination).toBeDefined();
        expect(elements.rightAscension).toBeDefined();
        expect(elements.argPerigee).toBeDefined();
        expect(elements.trueAnomaly).toBeDefined();
      });

      it('should use provided eccentricity', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 53 as Degrees, {
          epoch: testEpoch,
          eccentricity: 0.001,
        });

        expect(elements.eccentricity).toBeCloseTo(0.001, 4);
      });

      it('should use default near-circular eccentricity', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 53 as Degrees, { epoch: testEpoch });

        expect(elements.eccentricity).toBeLessThan(0.01);
      });
    });

    describe('known orbits', () => {
      it('should calculate Landsat-8 style orbit (233/16)', () => {
        // Landsat-8: 233 revs in 16 days, ~705 km altitude, 98.2° inclination
        const elements = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees, { epoch: testEpoch });
        const altitude = elements.semimajorAxis - Earth.radiusMean;

        // Should be approximately 705 km (within 20 km tolerance due to J2 modeling)
        expect(altitude).toBeGreaterThan(680);
        expect(altitude).toBeLessThan(730);
      });

      it('should calculate Sentinel-2 style orbit (143/10)', () => {
        // Sentinel-2: 143 revs in 10 days, ~786 km altitude, 98.6° inclination
        const elements = RepeatGroundTrack.calculate(143, 10, 98.6 as Degrees, { epoch: testEpoch });
        const altitude = elements.semimajorAxis - Earth.radiusMean;

        // Should be approximately 786 km
        expect(altitude).toBeGreaterThan(760);
        expect(altitude).toBeLessThan(810);
      });

      it('should calculate SPOT style orbit (369/26)', () => {
        // SPOT: 369 revs in 26 days, ~832 km altitude, 98.7° inclination
        const elements = RepeatGroundTrack.calculate(369, 26, 98.7 as Degrees, { epoch: testEpoch });
        const altitude = elements.semimajorAxis - Earth.radiusMean;

        // Should be approximately 832 km
        expect(altitude).toBeGreaterThan(800);
        expect(altitude).toBeLessThan(860);
      });

      it('should calculate ISS-like orbit (46/3)', () => {
        // ISS: 46 revs in 3 days, ~408 km altitude, 51.6° inclination
        const elements = RepeatGroundTrack.calculate(46, 3, 51.6 as Degrees, { epoch: testEpoch });
        const altitude = elements.semimajorAxis - Earth.radiusMean;

        // Should be approximately 408 km
        expect(altitude).toBeGreaterThan(380);
        expect(altitude).toBeLessThan(440);
      });
    });

    describe('sun-synchronous orbits', () => {
      it('should auto-calculate inclination when sunSynchronous=true', () => {
        const elements = RepeatGroundTrack.calculate(233, 16, undefined, {
          epoch: testEpoch,
          sunSynchronous: true,
        });

        // Sun-synchronous inclination should be ~96-99 degrees for LEO
        const incDeg = elements.inclinationDegrees;

        expect(incDeg).toBeGreaterThan(96);
        expect(incDeg).toBeLessThan(100);
      });

      it('should produce correct nodal precession rate for SSO', () => {
        const elements = RepeatGroundTrack.calculate(233, 16, undefined, {
          epoch: testEpoch,
          sunSynchronous: true,
        });

        // Nodal precession should be approximately 0.9856°/day
        // The nodalPrecessionRate getter returns rad/s, convert to deg/day
        const precessionDegPerDay = Math.abs(elements.nodalPrecessionRate) * 86400 * (180 / Math.PI);

        // Allow 0.1 deg/day tolerance due to J2 modeling differences
        expect(Math.abs(precessionDegPerDay - 0.9856)).toBeLessThan(0.1);
      });

      it('should match explicit inclination when close to SSO', () => {
        const ssoElements = RepeatGroundTrack.calculate(233, 16, undefined, {
          epoch: testEpoch,
          sunSynchronous: true,
        });

        const explicitElements = RepeatGroundTrack.calculate(233, 16, ssoElements.inclinationDegrees, {
          epoch: testEpoch,
        });

        // Altitudes should be very close
        const altDiff = Math.abs(ssoElements.semimajorAxis - explicitElements.semimajorAxis);

        expect(altDiff).toBeLessThan(1);
      });
    });

    describe('validation', () => {
      it('should throw ValidationError for non-integer revolutions', () => {
        expect(() => RepeatGroundTrack.calculate(15.5, 1, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for non-integer days', () => {
        expect(() => RepeatGroundTrack.calculate(15, 1.5, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for zero revolutions', () => {
        expect(() => RepeatGroundTrack.calculate(0, 1, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for zero days', () => {
        expect(() => RepeatGroundTrack.calculate(15, 0, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative revolutions', () => {
        expect(() => RepeatGroundTrack.calculate(-15, 1, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative days', () => {
        expect(() => RepeatGroundTrack.calculate(15, -1, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError when revolutions <= days', () => {
        // Must have more than 1 rev per day for LEO/MEO
        expect(() => RepeatGroundTrack.calculate(1, 1, 53 as Degrees)).toThrow(ValidationError);
        expect(() => RepeatGroundTrack.calculate(1, 2, 53 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for missing inclination when not SSO', () => {
        expect(() => RepeatGroundTrack.calculate(15, 1, undefined)).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative inclination', () => {
        expect(() => RepeatGroundTrack.calculate(15, 1, -10 as Degrees)).toThrow(ValidationError);
      });

      it('should throw ValidationError for inclination > 180', () => {
        expect(() => RepeatGroundTrack.calculate(15, 1, 200 as Degrees)).toThrow(ValidationError);
      });

      it('should accept boundary inclination values', () => {
        const elements0 = RepeatGroundTrack.calculate(15, 1, 0 as Degrees, { epoch: testEpoch });
        const elements180 = RepeatGroundTrack.calculate(15, 1, 180 as Degrees, { epoch: testEpoch });

        expect(elements0).toBeDefined();
        expect(elements180).toBeDefined();
      });
    });

    describe('edge cases', () => {
      it('should handle single day repeat cycle', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 53 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
        expect(elements.semimajorAxis).toBeGreaterThan(Earth.radiusMean);
      });

      it('should handle long repeat cycles (30 days)', () => {
        const elements = RepeatGroundTrack.calculate(467, 30, 53 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
      });

      it('should handle polar orbits (90 degrees)', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 90 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
        expect(elements.inclinationDegrees).toBeCloseTo(90, 1);
      });

      it('should handle retrograde orbits (>90 degrees)', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 120 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
        expect(elements.inclinationDegrees).toBeCloseTo(120, 1);
      });

      it('should handle equatorial orbits (0 degrees)', () => {
        const elements = RepeatGroundTrack.calculate(15, 1, 0 as Degrees, { epoch: testEpoch });

        expect(elements).toBeDefined();
        expect(elements.inclinationDegrees).toBeCloseTo(0, 1);
      });
    });
  });

  describe('findNearest()', () => {
    describe('basic functionality', () => {
      it('should find RGT orbits near target altitude', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
          inclination: 98 as Degrees,
          epoch: testEpoch,
        });

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
          expect(result.altitude).toBeGreaterThanOrEqual(650);
          expect(result.altitude).toBeLessThanOrEqual(750);
        }
      });

      it('should return results sorted by proximity to target', () => {
        const targetAlt = 700 as Kilometers;
        const results = RepeatGroundTrack.findNearest(targetAlt, 50 as Kilometers, {
          inclination: 98 as Degrees,
          epoch: testEpoch,
        });

        if (results.length > 1) {
          for (let i = 1; i < results.length; i++) {
            const prevDiff = Math.abs(results[i - 1].altitude - targetAlt);
            const currDiff = Math.abs(results[i].altitude - targetAlt);

            expect(currDiff).toBeGreaterThanOrEqual(prevDiff);
          }
        }
      });

      it('should include revolutions and days in results', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
          inclination: 98 as Degrees,
          epoch: testEpoch,
        });

        for (const result of results) {
          expect(result.revolutions).toBeGreaterThan(0);
          expect(result.days).toBeGreaterThan(0);
          expect(result.revolutions).toBeGreaterThan(result.days);
        }
      });

      it('should include ground track spacing', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
          inclination: 98 as Degrees,
          epoch: testEpoch,
        });

        for (const result of results) {
          expect(result.groundTrackSpacing).toBeGreaterThan(0);
          // Ground track spacing at equator = Earth circumference / revs
          const expectedSpacing = (2 * Math.PI * Earth.radiusEquator) / result.revolutions;

          expect(result.groundTrackSpacing).toBeCloseTo(expectedSpacing, 0);
        }
      });
    });

    describe('sun-synchronous search', () => {
      it('should find sun-synchronous RGT orbits', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
          sunSynchronous: true,
          epoch: testEpoch,
        });

        expect(results.length).toBeGreaterThan(0);
        for (const result of results) {
          expect(result.isSunSynchronous).toBe(true);
        }
      });

      it('should identify non-SSO orbits correctly', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
          inclination: 53 as Degrees, // Not sun-synchronous
          epoch: testEpoch,
        });

        for (const result of results) {
          expect(result.isSunSynchronous).toBe(false);
        }
      });
    });

    describe('options', () => {
      it('should respect maxDays option', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 100 as Kilometers, {
          inclination: 98 as Degrees,
          maxDays: 5,
          epoch: testEpoch,
        });

        for (const result of results) {
          expect(result.days).toBeLessThanOrEqual(5);
        }
      });

      it('should respect maxResults option', () => {
        const results = RepeatGroundTrack.findNearest(700 as Kilometers, 100 as Kilometers, {
          inclination: 98 as Degrees,
          maxResults: 3,
          epoch: testEpoch,
        });

        expect(results.length).toBeLessThanOrEqual(3);
      });
    });

    describe('validation', () => {
      it('should throw ValidationError for negative target altitude', () => {
        expect(() =>
          RepeatGroundTrack.findNearest(-100 as Kilometers, 50 as Kilometers, {
            inclination: 98 as Degrees,
          }),
        ).toThrow(ValidationError);
      });

      it('should throw ValidationError for zero target altitude', () => {
        expect(() =>
          RepeatGroundTrack.findNearest(0 as Kilometers, 50 as Kilometers, {
            inclination: 98 as Degrees,
          }),
        ).toThrow(ValidationError);
      });

      it('should throw ValidationError for negative max deviation', () => {
        expect(() =>
          RepeatGroundTrack.findNearest(700 as Kilometers, -50 as Kilometers, {
            inclination: 98 as Degrees,
          }),
        ).toThrow(ValidationError);
      });

      it('should throw ValidationError for zero max deviation', () => {
        expect(() =>
          RepeatGroundTrack.findNearest(700 as Kilometers, 0 as Kilometers, {
            inclination: 98 as Degrees,
          }),
        ).toThrow(ValidationError);
      });

      it('should throw ValidationError when inclination missing and not SSO', () => {
        expect(() => RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {})).toThrow(ValidationError);
      });
    });

    describe('edge cases', () => {
      it('should handle narrow altitude range', () => {
        const results = RepeatGroundTrack.findNearest(705 as Kilometers, 5 as Kilometers, {
          inclination: 98 as Degrees,
          epoch: testEpoch,
        });

        // May or may not find results depending on exact R/D combinations
        if (results.length > 0) {
          for (const result of results) {
            expect(result.altitude).toBeGreaterThanOrEqual(700);
            expect(result.altitude).toBeLessThanOrEqual(710);
          }
        }
      });

      it('should handle high altitude search', () => {
        const results = RepeatGroundTrack.findNearest(1500 as Kilometers, 100 as Kilometers, {
          inclination: 98 as Degrees,
          maxDays: 10,
          epoch: testEpoch,
        });

        // Higher altitude = fewer revs per day
        if (results.length > 0) {
          for (const result of results) {
            expect(result.altitude).toBeGreaterThan(1400);
            expect(result.altitude).toBeLessThan(1600);
          }
        }
      });
    });
  });

  describe('sunSynchronousInclination()', () => {
    describe('basic functionality', () => {
      it('should calculate SSO inclination for typical LEO altitude', () => {
        const inc = RepeatGroundTrack.sunSynchronousInclination(700 as Kilometers);

        // Should be around 98 degrees for 700 km
        expect(inc).toBeGreaterThan(96);
        expect(inc).toBeLessThan(100);
      });

      it('should return higher inclination for higher altitude', () => {
        const inc500 = RepeatGroundTrack.sunSynchronousInclination(500 as Kilometers);
        const inc900 = RepeatGroundTrack.sunSynchronousInclination(900 as Kilometers);

        // Higher altitude requires higher inclination for SSO
        expect(inc900).toBeGreaterThan(inc500);
      });

      it('should match expected values for common altitudes', () => {
        // Landsat-8 at ~705 km has ~98.2° inclination
        const incLandsat = RepeatGroundTrack.sunSynchronousInclination(705 as Kilometers);

        expect(incLandsat).toBeGreaterThan(97.5);
        expect(incLandsat).toBeLessThan(98.8);

        // Sentinel-2 at ~786 km has ~98.6° inclination
        const incSentinel = RepeatGroundTrack.sunSynchronousInclination(786 as Kilometers);

        expect(incSentinel).toBeGreaterThan(98);
        expect(incSentinel).toBeLessThan(99.2);
      });
    });

    describe('validation', () => {
      it('should throw ValidationError for negative altitude', () => {
        expect(() => RepeatGroundTrack.sunSynchronousInclination(-100 as Kilometers)).toThrow(ValidationError);
      });

      it('should throw ValidationError for zero altitude', () => {
        expect(() => RepeatGroundTrack.sunSynchronousInclination(0 as Kilometers)).toThrow(ValidationError);
      });

      it('should throw ValidationError for altitude below 160 km', () => {
        expect(() => RepeatGroundTrack.sunSynchronousInclination(100 as Kilometers)).toThrow(ValidationError);
      });
    });

    describe('edge cases', () => {
      it('should handle minimum valid altitude (160 km)', () => {
        const inc = RepeatGroundTrack.sunSynchronousInclination(160 as Kilometers);

        expect(inc).toBeGreaterThan(90);
        expect(inc).toBeLessThan(100);
      });

      it('should handle moderate LEO altitude', () => {
        const inc = RepeatGroundTrack.sunSynchronousInclination(400 as Kilometers);

        expect(inc).toBeGreaterThan(95);
        expect(inc).toBeLessThan(98);
      });

      it('should accept eccentricity parameter', () => {
        const incCircular = RepeatGroundTrack.sunSynchronousInclination(700 as Kilometers, 0.0001);
        const incElliptical = RepeatGroundTrack.sunSynchronousInclination(700 as Kilometers, 0.01);

        // Different eccentricity should give slightly different inclination
        expect(Math.abs(incCircular - incElliptical)).toBeGreaterThan(0);
        expect(Math.abs(incCircular - incElliptical)).toBeLessThan(1);
      });
    });
  });

  describe('integration tests', () => {
    it('should produce consistent results between calculate and findNearest', () => {
      // Calculate specific orbit
      const elements = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees, { epoch: testEpoch });
      const altitude = elements.semimajorAxis - Earth.radiusMean;

      // Search for orbits near that altitude
      const results = RepeatGroundTrack.findNearest(altitude as Kilometers, 10 as Kilometers, {
        inclination: 98.2 as Degrees,
        epoch: testEpoch,
      });

      // Should find the 233/16 orbit
      const found = results.find((r) => r.revolutions === 233 && r.days === 16);

      expect(found).toBeDefined();
    });

    it('should produce propagatable ClassicalElements', () => {
      const elements = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees, { epoch: testEpoch });

      // Convert to position/velocity
      const pv = elements.toPositionVelocity();

      expect(pv.position).toBeDefined();
      expect(pv.velocity).toBeDefined();

      // Position magnitude should be approximately SMA (within 1% for near-circular orbit)
      const posMag = Math.sqrt(pv.position.x ** 2 + pv.position.y ** 2 + pv.position.z ** 2);
      const tolerance = elements.semimajorAxis * 0.01; // 1% tolerance

      expect(Math.abs(posMag - elements.semimajorAxis)).toBeLessThan(tolerance);
    });

    it('should work with ConstellationGenerator pattern', () => {
      // Calculate RGT orbit, then use it for a constellation
      const elements = RepeatGroundTrack.calculate(233, 16, undefined, {
        epoch: testEpoch,
        sunSynchronous: true,
      });

      const altitude = (elements.semimajorAxis - Earth.radiusMean) as Kilometers;
      const inclination = elements.inclinationDegrees;

      // These values can be used with ConstellationGenerator
      expect(altitude).toBeGreaterThan(600);
      expect(altitude).toBeLessThan(800);
      expect(inclination).toBeGreaterThan(96);
      expect(inclination).toBeLessThan(100);
    });
  });
});
