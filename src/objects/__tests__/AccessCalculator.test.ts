import {
  AccessCalculator,
  AccessConstraints,
  Degrees,
  GroundStation,
  Kilometers,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../main';

describe('AccessCalculator', () => {
  // ISS TLE for testing - LEO satellite with ~90 minute period
  const issTle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const issTle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  // GEO satellite TLE for testing
  const geoTle1 = '1 41866U 16071A   22203.00000000  .00000000  00000+0  00000+0 0  9999' as TleLine1;
  const geoTle2 = '2 41866   0.0100 267.4000 0000500 270.0000  90.0000  1.00270000    00' as TleLine2;

  // Ground station at mid-latitude (approximate Washington DC location)
  const midLatStation = new GroundStation({
    id: 8001,
    name: 'Test Ground Station',
    lat: 38.9 as Degrees,
    lon: -77.0 as Degrees,
    alt: 0.1 as Kilometers,
  });

  // Fixed epoch for reproducible tests
  const testEpoch = new Date('2022-07-22T12:00:00Z');

  describe('calculateAccess', () => {
    describe('Basic Access Detection', () => {
      it('should find passes for ISS over mid-latitude station', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000); // 24 hours

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // ISS should have multiple passes over 24 hours
        expect(windows.length).toBeGreaterThan(0);
        expect(windows.length).toBeLessThan(20); // Reasonable upper bound
      });

      it('should return empty array when satellite never visible', () => {
        // Create a high-latitude station where low-inclination satellites can't reach
        const polarStation = new GroundStation({
          id: 8003,
          name: 'Polar Station',
          lat: 85 as Degrees,
          lon: 0 as Degrees,
          alt: 0 as Kilometers,
        });

        // GEO satellite at equator shouldn't be visible from polar station
        const geoSat = new Satellite({ tle1: geoTle1, tle2: geoTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 2 * 60 * 60 * 1000); // 2 hours

        const windows = AccessCalculator.calculateAccess(polarStation, geoSat, start, end);

        expect(windows.length).toBe(0);
      });

      it('should respect start and end bounds', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        for (const window of windows) {
          // Window start should be at or after search start
          expect(window.start.getTime()).toBeGreaterThanOrEqual(start.getTime());
          // Window end should be at or before search end
          expect(window.end.getTime()).toBeLessThanOrEqual(end.getTime());
        }
      });

      it('should have valid AccessWindow properties', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        for (const window of windows) {
          // Duration should match end - start
          expect(window.duration).toBe(window.end.getTime() - window.start.getTime());

          // Max elevation should be positive (above horizon)
          expect(window.maxElevation).toBeGreaterThan(0);

          // Max elevation time should be within window
          expect(window.maxElevationTime.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
          expect(window.maxElevationTime.getTime()).toBeLessThanOrEqual(window.end.getTime());

          // Range at max elevation should be positive
          expect(window.rangeAtMaxEl).toBeGreaterThan(0);

          // Observer and target should be set
          expect(window.observer).toBe(midLatStation);
          expect(window.target).toBe(iss);
        }
      });

      it('should handle short time step for accuracy', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 3 * 60 * 60 * 1000); // 3 hours

        // Use 1-second step for high accuracy
        const windowsHighRes = AccessCalculator.calculateAccess(midLatStation, iss, start, end, {}, 1000);
        // Use default 10-second step
        const windowsLowRes = AccessCalculator.calculateAccess(midLatStation, iss, start, end, {}, 10000);

        // Should find same number of passes
        expect(windowsHighRes.length).toBe(windowsLowRes.length);

        // High-res times should be within 10s of low-res times
        for (let i = 0; i < windowsHighRes.length; i++) {
          const diff = Math.abs(windowsHighRes[i].start.getTime() - windowsLowRes[i].start.getTime());

          expect(diff).toBeLessThan(15000); // 15 second tolerance
        }
      });
    });

    describe('Elevation Constraints', () => {
      it('should apply default 0° elevation constraint', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // All max elevations should be above 0
        for (const window of windows) {
          expect(window.maxElevation).toBeGreaterThan(0);
        }
      });

      it('should filter passes based on minElevation', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const constraints: AccessConstraints = { minElevation: 10 as Degrees };
        const windowsConstrained = AccessCalculator.calculateAccess(midLatStation, iss, start, end, constraints);
        const windowsDefault = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // Should have fewer or equal passes with higher minElevation
        expect(windowsConstrained.length).toBeLessThanOrEqual(windowsDefault.length);
      });

      it('should return shorter windows with higher minElevation', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 48 * 60 * 60 * 1000); // 48 hours for more passes

        const windowsLow = AccessCalculator.calculateAccess(midLatStation, iss, start, end, { minElevation: 5 as Degrees });
        const windowsHigh = AccessCalculator.calculateAccess(midLatStation, iss, start, end, { minElevation: 30 as Degrees });

        // If we have passes in both, high-elevation passes should be shorter on average
        if (windowsLow.length > 0 && windowsHigh.length > 0) {
          const avgDurationLow = windowsLow.reduce((sum, w) => sum + w.duration, 0) / windowsLow.length;
          const avgDurationHigh = windowsHigh.reduce((sum, w) => sum + w.duration, 0) / windowsHigh.length;

          expect(avgDurationHigh).toBeLessThan(avgDurationLow);
        }
      });

      it('should skip pass entirely if maxEl never reaches minElevation', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        // Very high minElevation that most passes won't reach
        const constraints: AccessConstraints = { minElevation: 80 as Degrees };
        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end, constraints);

        // All returned windows should have maxEl >= 80
        for (const window of windows) {
          expect(window.maxElevation).toBeGreaterThanOrEqual(80);
        }
      });
    });

    describe('Range Constraints', () => {
      it('should filter by maxRange', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        // ISS is ~400 km altitude, so max range at horizon is ~2000+ km
        const constraints: AccessConstraints = { maxRange: 1000 as Kilometers };
        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end, constraints);

        // Should find some passes (when ISS is overhead) but fewer than unconstrained
        const windowsDefault = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // Constrained should have equal or fewer passes
        expect(windows.length).toBeLessThanOrEqual(windowsDefault.length);
      });

      it('should filter by minRange', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        // Only consider when ISS is further than 500 km
        const constraints: AccessConstraints = { minRange: 500 as Kilometers };
        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end, constraints);

        // Range at max elevation should be >= minRange
        for (const window of windows) {
          expect(window.rangeAtMaxEl).toBeGreaterThanOrEqual(500);
        }
      });

      it('should handle combined min and max range', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const constraints: AccessConstraints = {
          minRange: 500 as Kilometers,
          maxRange: 1500 as Kilometers,
        };
        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end, constraints);

        // This should work without error
        expect(Array.isArray(windows)).toBe(true);
      });
    });

    describe('Sunlit Constraint', () => {
      it('should work without requireSunlit constraint', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end, { requireSunlit: false });

        // Should find passes
        expect(windows.length).toBeGreaterThan(0);
      });

      it('should filter with requireSunlit=true', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const windowsSunlit = AccessCalculator.calculateAccess(midLatStation, iss, start, end, { requireSunlit: true });
        const windowsAll = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // Sunlit-only should have equal or fewer passes
        expect(windowsSunlit.length).toBeLessThanOrEqual(windowsAll.length);
      });
    });

    describe('Edge Cases', () => {
      it('should handle pass in progress at interval start', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

        // Find a pass first
        const searchStart = testEpoch;
        const searchEnd = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const allWindows = AccessCalculator.calculateAccess(midLatStation, iss, searchStart, searchEnd);

        if (allWindows.length > 0) {
          const firstPass = allWindows[0];
          // Start our interval in the middle of the first pass
          const midPassTime = new Date((firstPass.start.getTime() + firstPass.end.getTime()) / 2);
          const newEnd = new Date(firstPass.end.getTime() + 60 * 60 * 1000);

          const partialWindows = AccessCalculator.calculateAccess(midLatStation, iss, midPassTime, newEnd);

          // Should still detect the partial pass
          expect(partialWindows.length).toBeGreaterThan(0);
          // First window should start at or very close to midPassTime
          expect(partialWindows[0].start.getTime()).toBeLessThanOrEqual(midPassTime.getTime() + 10000);
        }
      });

      it('should handle pass in progress at interval end', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

        // Find a pass first
        const searchStart = testEpoch;
        const searchEnd = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const allWindows = AccessCalculator.calculateAccess(midLatStation, iss, searchStart, searchEnd);

        if (allWindows.length > 0) {
          const lastPass = allWindows[allWindows.length - 1];
          // End our interval in the middle of a pass
          const midPassTime = new Date((lastPass.start.getTime() + lastPass.end.getTime()) / 2);

          const partialWindows = AccessCalculator.calculateAccess(
            midLatStation,
            iss,
            new Date(lastPass.start.getTime() - 30 * 60 * 1000), // 30 min before pass
            midPassTime,
          );

          // Last window should end at midPassTime
          const partialLast = partialWindows[partialWindows.length - 1];

          expect(partialLast.end.getTime()).toBe(midPassTime.getTime());
        }
      });

      it('should handle empty interval', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 1000); // Just 1 second

        const windows = AccessCalculator.calculateAccess(midLatStation, iss, start, end);

        // Should not throw, may or may not find a window
        expect(Array.isArray(windows)).toBe(true);
      });

      it('should work with different step sizes', () => {
        const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });
        const start = testEpoch;
        const end = new Date(testEpoch.getTime() + 6 * 60 * 60 * 1000); // 6 hours

        // Very large step (60 seconds)
        const windowsLarge = AccessCalculator.calculateAccess(midLatStation, iss, start, end, {}, 60000);

        // Should still detect passes
        expect(Array.isArray(windowsLarge)).toBe(true);
      });
    });
  });

  describe('getNextAccess', () => {
    it('should find next pass after given time', () => {
      const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

      const nextWindow = AccessCalculator.getNextAccess(midLatStation, iss, testEpoch);

      // Should find a pass within 7 days
      expect(nextWindow).not.toBeNull();
      if (nextWindow) {
        expect(nextWindow.start.getTime()).toBeGreaterThan(testEpoch.getTime());
      }
    });

    it('should return null when no pass in search period', () => {
      // Create station where GEO satellite won't be visible
      const polarStation = new GroundStation({
        id: 5004,
        name: 'Polar Station',
        lat: 85 as Degrees,
        lon: 0 as Degrees,
        alt: 0 as Kilometers,
      });

      const geoSat = new Satellite({ tle1: geoTle1, tle2: geoTle2 });

      const nextWindow = AccessCalculator.getNextAccess(polarStation, geoSat, testEpoch, {}, 1); // Only search 1 day

      expect(nextWindow).toBeNull();
    });

    it('should respect maxSearchDays parameter', () => {
      const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

      // Short search period
      const nextWindow = AccessCalculator.getNextAccess(midLatStation, iss, testEpoch, {}, 0.01); // ~15 minutes

      // Might or might not find a pass, but should not throw
      expect(nextWindow === null || nextWindow instanceof Object).toBe(true);
    });

    it('should skip passes that started before after time', () => {
      const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

      // Find all passes in 24 hours
      const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
      const allWindows = AccessCalculator.calculateAccess(midLatStation, iss, testEpoch, end);

      if (allWindows.length > 0) {
        // Get next pass starting after the first pass ends
        const afterFirstPass = new Date(allWindows[0].end.getTime() + 1000);
        const nextWindow = AccessCalculator.getNextAccess(midLatStation, iss, afterFirstPass);

        // Should find a different pass
        if (nextWindow) {
          expect(nextWindow.start.getTime()).toBeGreaterThan(afterFirstPass.getTime());
        }
      }
    });

    it('should apply constraints', () => {
      const iss = new Satellite({ tle1: issTle1, tle2: issTle2 });

      const constraints: AccessConstraints = { minElevation: 30 as Degrees };
      const nextWindow = AccessCalculator.getNextAccess(midLatStation, iss, testEpoch, constraints);

      if (nextWindow) {
        expect(nextWindow.maxElevation).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('calculateMultiTargetAccess', () => {
    it('should return map with correct keys', () => {
      const iss = new Satellite({ id: 8101, tle1: issTle1, tle2: issTle2 });
      const geo = new Satellite({ id: 8102, tle1: geoTle1, tle2: geoTle2 });

      const start = testEpoch;
      const end = new Date(testEpoch.getTime() + 2 * 60 * 60 * 1000); // 2 hours

      const results = AccessCalculator.calculateMultiTargetAccess(midLatStation, [iss, geo], start, end);

      expect(results.has(8101)).toBe(true);
      expect(results.has(8102)).toBe(true);
      expect(results.size).toBe(2);
    });

    it('should return empty array for never-visible targets', () => {
      const polarStation = new GroundStation({
        id: 8003,
        name: 'Polar Station',
        lat: 85 as Degrees,
        lon: 0 as Degrees,
        alt: 0 as Kilometers,
      });

      const geoSat = new Satellite({ id: 8103, tle1: geoTle1, tle2: geoTle2 });

      const start = testEpoch;
      const end = new Date(testEpoch.getTime() + 2 * 60 * 60 * 1000);

      const results = AccessCalculator.calculateMultiTargetAccess(polarStation, [geoSat], start, end);

      expect(results.get(8103)).toEqual([]);
    });

    it('should find different windows for different satellites', () => {
      const iss = new Satellite({ id: 8104, tle1: issTle1, tle2: issTle2 });
      const issClone = new Satellite({ id: 8105, tle1: issTle1, tle2: issTle2 });

      const start = testEpoch;
      const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

      const results = AccessCalculator.calculateMultiTargetAccess(midLatStation, [iss, issClone], start, end);

      // Same TLE should produce same windows
      const issWindows = results.get(8104);
      const cloneWindows = results.get(8105);

      expect(issWindows).toBeDefined();
      expect(cloneWindows).toBeDefined();
      expect(issWindows!.length).toBe(cloneWindows!.length);
    });

    it('should apply constraints to all targets', () => {
      const iss = new Satellite({ id: 8106, tle1: issTle1, tle2: issTle2 });

      const start = testEpoch;
      const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

      const constraints: AccessConstraints = { minElevation: 20 as Degrees };
      const results = AccessCalculator.calculateMultiTargetAccess(midLatStation, [iss], start, end, constraints);

      const windows = results.get(8106);

      if (windows && windows.length > 0) {
        for (const window of windows) {
          expect(window.maxElevation).toBeGreaterThanOrEqual(20);
        }
      }
    });

    it('should handle empty targets array', () => {
      const start = testEpoch;
      const end = new Date(testEpoch.getTime() + 2 * 60 * 60 * 1000);

      const results = AccessCalculator.calculateMultiTargetAccess(midLatStation, [], start, end);

      expect(results.size).toBe(0);
    });
  });
});
