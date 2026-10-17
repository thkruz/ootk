/**
 * @file ConjunctionAssessment coarse-to-fine TCA search
 * @description The opt-in `tcaSearchMode: 'coarse-to-fine'` must find the same TCA as the default
 * branch and bound.
 */

import { ConjunctionAssessment, EpochUTC, Seconds, Tle } from '../../main';

describe('ConjunctionAssessment coarse-to-fine TCA search', () => {
  // ISS-like orbit and a copy with RAAN +40 deg, phased to meet near the plane intersections
  const primary = new Tle(
    '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9009',
    '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000004',
  );
  const secondary = new Tle(
    '1 99999U 98067B   25019.50000000  .00016717  00000-0  10270-3 0  9004',
    '2 99999  51.6400  19.8000 0002571  90.5000 244.1933 15.50000000000007',
  );

  it('matches branch and bound to 1 ms on a crossing LEO pair over 72 h', () => {
    const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const endTime = startTime.roll((72 * 3600) as Seconds);
    const assessment = new ConjunctionAssessment({ tle: primary }, { tle: secondary });
    const window = { startTime, endTime, searchStepSize: 240 as Seconds };
    const exhaustive = assessment.assess(window);
    const coarse = assessment.assess({ ...window, tcaSearchMode: 'coarse-to-fine' });

    // About 90 approaches within a few km of each other; the global one is below 10 km
    expect(exhaustive.missDistance).toBeLessThan(10);
    expect(Math.abs(coarse.tca.posix - exhaustive.tca.posix)).toBeLessThan(1e-3);
    expect(Math.abs(coarse.missDistance - exhaustive.missDistance)).toBeLessThan(1e-6);
  });

  it('picks the deeper of the two approaches in one orbit, as a 1 s brute-force scan does', () => {
    // The same pair meets near both intersection points of the planes: two approaches per orbit
    const startTime = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const endTime = startTime.roll((95 * 60) as Seconds);
    const assessment = new ConjunctionAssessment({ tle: primary }, { tle: secondary });
    const window = { startTime, endTime, searchStepSize: 240 as Seconds };
    const coarse = assessment.assess({ ...window, tcaSearchMode: 'coarse-to-fine' });
    const exhaustive = assessment.assess(window);

    // Brute force: range every second, local minima below 100 km
    const range = (t: number): number => {
      const epoch = new EpochUTC(t as Seconds);

      return primary.propagate(epoch).toJ2000().position.distance(secondary.propagate(epoch).toJ2000().position);
    };
    const samples: number[] = [];

    for (let t: number = startTime.posix; t <= endTime.posix; t += 1) {
      samples.push(range(t));
    }
    const minima: { i: number; r: number }[] = [];

    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] < 100 && samples[i] <= samples[i - 1] && samples[i] <= samples[i + 1]) {
        minima.push({ i, r: samples[i] });
      }
    }
    const deepest = minima.reduce((x, y) => (y.r < x.r ? y : x));
    const other = minima.find((m) => m !== deepest)!;

    expect(minima.length).toBe(2);
    // The two approaches are about half an orbit apart and differ in depth
    expect(Math.abs(other.i - deepest.i)).toBeGreaterThan(30 * 60);
    expect(Math.abs(coarse.tca.posix - (startTime.posix + deepest.i))).toBeLessThanOrEqual(1);
    expect(coarse.missDistance).toBeLessThanOrEqual(deepest.r);
    expect(Math.abs(coarse.tca.posix - exhaustive.tca.posix)).toBeLessThan(1e-3);
  });

  it('returns the window start for an empty window', () => {
    const epoch = EpochUTC.fromDateTimeString('2025-01-19T12:00:00.000Z');
    const event = new ConjunctionAssessment({ tle: primary }, { tle: secondary }).assess({ startTime: epoch, endTime: epoch, tcaSearchMode: 'coarse-to-fine' });

    expect(event.tca.posix).toBe(epoch.posix);
  });
});
