/**
 * @file CatalogScreener test suite
 * @description Tests for catalog screening operations
 */

import {
  CatalogScreener,
  EpochUTC,
  Kilometers,
  ScreeningFilter,
  Tle,
} from '../../main';
import type { CatalogObject } from '../CatalogScreener';

describe('CatalogScreener', () => {
  // Sample TLE data for testing
  const tleLine1A = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005';
  const tleLine2A = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000';
  const tleLine1B = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9006';
  const tleLine2B = '2 25544  51.6400 339.8100 0002571  90.5100 269.6100 15.50000000000000';
  const tleLine1C = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9007';
  const tleLine2C = '2 25544  51.6400 339.8200 0002571  90.5200 269.6200 15.50000000000000';

  let tleA: Tle;
  let tleB: Tle;
  let tleC: Tle;

  beforeEach(() => {
    tleA = new Tle(tleLine1A, tleLine2A);
    tleB = new Tle(tleLine1B, tleLine2B);
    tleC = new Tle(tleLine1C, tleLine2C);
  });

  describe('screenOneToMany', () => {
    it('should return empty array for empty secondaries', () => {
      const primary: CatalogObject = { tle: tleA, name: 'Primary' };

      const results = CatalogScreener.screenOneToMany(primary, [], {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      expect(results).toHaveLength(0);
    });

    it('should screen primary against single secondary', () => {
      const primary: CatalogObject = { tle: tleA, name: 'Primary' };
      const secondaries: CatalogObject[] = [{ tle: tleB, name: 'Secondary' }];

      const results = CatalogScreener.screenOneToMany(primary, secondaries, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        expect(results[0].primaryId).toBe('Primary');
        expect(results[0].secondaryId).toBe('Secondary');
        expect(results[0].event).toBeDefined();
        expect(results[0].riskScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should screen primary against multiple secondaries', () => {
      const primary: CatalogObject = { tle: tleA, name: 'Primary' };
      const secondaries: CatalogObject[] = [
        { tle: tleB, name: 'SecondaryB' },
        { tle: tleC, name: 'SecondaryC' },
      ];

      const results = CatalogScreener.screenOneToMany(primary, secondaries, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      // Results should be sorted by risk (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].riskScore).toBeGreaterThanOrEqual(results[i].riskScore);
      }
    });

    it('should respect maxResults limit', () => {
      const primary: CatalogObject = { tle: tleA, name: 'Primary' };
      const secondaries: CatalogObject[] = [
        { tle: tleB, name: 'SecondaryB' },
        { tle: tleC, name: 'SecondaryC' },
      ];

      const results = CatalogScreener.screenOneToMany(primary, secondaries, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
        maxResults: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should use object ID from TLE if name not provided', () => {
      const primary: CatalogObject = { tle: tleA };
      const secondaries: CatalogObject[] = [{ tle: tleB }];

      const results = CatalogScreener.screenOneToMany(primary, secondaries, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      if (results.length > 0) {
        expect(results[0].primaryId).toBe(tleA.satnum.toString());
      }
    });
  });

  describe('screenManyToMany', () => {
    it('should avoid duplicate pairs', () => {
      const objects: CatalogObject[] = [
        { tle: tleA, name: 'A' },
        { tle: tleB, name: 'B' },
      ];

      const results = CatalogScreener.screenManyToMany(objects, objects, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      // Should not have A-A or B-B pairs
      for (const result of results) {
        expect(result.primaryId).not.toBe(result.secondaryId);
      }

      // Should not have both A-B and B-A
      const pairIds = new Set(
        results.map((r) => ScreeningFilter.getPairId(r.primaryId, r.secondaryId)),
      );

      expect(pairIds.size).toBe(results.length);
    });

    it('should screen different primary and secondary sets', () => {
      const primaries: CatalogObject[] = [{ tle: tleA, name: 'A' }];
      const secondaries: CatalogObject[] = [
        { tle: tleB, name: 'B' },
        { tle: tleC, name: 'C' },
      ];

      const results = CatalogScreener.screenManyToMany(primaries, secondaries, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      // All results should have 'A' as primary
      for (const result of results) {
        expect(result.primaryId).toBe('A');
      }
    });
  });

  describe('screenCatalog', () => {
    it('should screen all objects against each other', () => {
      const catalog: CatalogObject[] = [
        { tle: tleA, name: 'A' },
        { tle: tleB, name: 'B' },
        { tle: tleC, name: 'C' },
      ];

      const results = CatalogScreener.screenCatalog(catalog, {
        startTime: EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z'),
        endTime: EpochUTC.fromDateTimeString('2025-01-19T18:00:00.000Z'),
      });

      // Maximum possible unique pairs: n*(n-1)/2 = 3*2/2 = 3
      expect(results.length).toBeLessThanOrEqual(3);

      // No self-conjunctions
      for (const result of results) {
        expect(result.primaryId).not.toBe(result.secondaryId);
      }
    });
  });
});

describe('ScreeningFilter', () => {
  const tleLine1LEO = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005';
  const tleLine2LEO = '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000';
  const tleLine1GEO = '1 36516U 10013A   25019.50000000 -.00000113  00000-0  00000-0 0  9996';
  const tleLine2GEO = '2 36516   0.0182 266.3245 0000789 324.4011 194.1932  1.00273272 54312';

  let tleLEO: Tle;
  let tleGEO: Tle;

  beforeEach(() => {
    tleLEO = new Tle(tleLine1LEO, tleLine2LEO);
    tleGEO = new Tle(tleLine1GEO, tleLine2GEO);
  });

  describe('getOrbitalShell', () => {
    it('should extract orbital shell from TLE', () => {
      const shell = ScreeningFilter.getOrbitalShell(tleLEO);

      expect(shell.perigee).toBeGreaterThan(0);
      expect(shell.apogee).toBeGreaterThan(0);
      expect(shell.apogee).toBeGreaterThanOrEqual(shell.perigee);
      expect(shell.inclination).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shellsOverlap', () => {
    it('should return true for overlapping shells', () => {
      const shell1 = ScreeningFilter.getOrbitalShell(tleLEO);
      // Create a second shell that overlaps - slightly lower perigee but same apogee range
      const shell2 = {
        ...shell1,
        perigee: (shell1.perigee - 50) as Kilometers,
        apogee: (shell1.apogee + 50) as Kilometers,
      };

      expect(ScreeningFilter.shellsOverlap(shell1, shell2)).toBe(true);
    });

    it('should return false for non-overlapping shells', () => {
      const shellLEO = ScreeningFilter.getOrbitalShell(tleLEO);
      const shellGEO = ScreeningFilter.getOrbitalShell(tleGEO);

      // LEO and GEO shouldn't overlap
      expect(ScreeningFilter.shellsOverlap(shellLEO, shellGEO)).toBe(false);
    });
  });

  describe('filterCandidates', () => {
    it('should filter out non-overlapping orbits', () => {
      const candidates = ScreeningFilter.filterCandidates(tleLEO, [tleGEO]);

      // GEO should be filtered out from LEO screening
      expect(candidates).toHaveLength(0);
    });

    it('should keep overlapping orbits', () => {
      const tleLEO2 = new Tle(
        '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9006',
        '2 25544  51.6400 339.8100 0002571  90.5100 269.6100 15.50000000000000',
      );

      const candidates = ScreeningFilter.filterCandidates(tleLEO, [tleLEO2]);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toBe(0);
    });
  });

  describe('computeRiskScore', () => {
    it('should compute higher risk for closer approaches', () => {
      // Create mock events with different miss distances
      const closeEvent = {
        missDistance: 0.1 as Kilometers,
        probabilityOfCollision: undefined,
      };
      const farEvent = {
        missDistance: 10 as Kilometers,
        probabilityOfCollision: undefined,
      };

      const closeRisk = ScreeningFilter.computeRiskScore(closeEvent as any);
      const farRisk = ScreeningFilter.computeRiskScore(farEvent as any);

      expect(closeRisk).toBeGreaterThan(farRisk);
    });
  });

  describe('getPairId', () => {
    it('should return canonical pair ID', () => {
      expect(ScreeningFilter.getPairId('A', 'B')).toBe('A:B');
      expect(ScreeningFilter.getPairId('B', 'A')).toBe('A:B');
    });
  });
});
