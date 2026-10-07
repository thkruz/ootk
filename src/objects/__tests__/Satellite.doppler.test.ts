import { cKmPerSec, Degrees, GroundStation, Kilometers, Satellite, TleLine1, TleLine2 } from '../../main';

/**
 * dopplerFactor() must agree with the range rate implied by rae().
 *
 * Convention: observed = transmitted * factor, factor = 1 - rdot / c, with rdot
 * the geometric range rate (positive receding), so factor > 1 while approaching.
 */
describe('Satellite.dopplerFactor agrees with rae() range rate', () => {
  const sat = new Satellite({
    name: 'SAR test LEO',
    tle1: '1 61701U 27015A   27076.25694444  .00001000  00000-0  10000-3 0  9995' as TleLine1,
    tle2: '2 61701  97.2000 280.0000 0010000  90.0000 275.7500 15.60000000123458' as TleLine2,
  });
  const galway = new GroundStation({ name: 'Galway', lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers });
  const epochMs = Date.UTC(2027, 2, 17, 6, 10, 0); // day 076 of 2027
  const h = 0.5; // seconds, central difference half-step

  const rangeRateFromRae = (ms: number): number => {
    const r1 = sat.rae(galway, new Date(ms + h * 1000))!.rng;
    const r0 = sat.rae(galway, new Date(ms - h * 1000))!.rng;

    return (r1 - r0) / (2 * h);
  };

  /** Finds the first pass with a peak above 30 degrees and returns its AOS/LOS times. */
  const findPass = (): { aos: number; los: number; tca: number } => {
    let aos: number | null = null;
    let tca = 0;
    let maxEl = -90;

    for (let ms = epochMs; ms < epochMs + 2 * 86400e3; ms += 10e3) {
      const el = sat.rae(galway, new Date(ms))!.el;

      if (el > 0) {
        aos ??= ms;
        if (el > maxEl) {
          maxEl = el;
          tca = ms;
        }
      } else if (aos !== null) {
        if (maxEl > 30) {
          return { aos, los: ms, tca };
        }
        aos = null;
        maxEl = -90;
      }
    }
    throw new Error('no pass found');
  };

  it('matches 1 - rdot/c across a high pass including TCA to a few m/s', () => {
    const { aos, los, tca } = findPass();
    let maxErrMS = 0;
    let tcaChecked = false;

    for (let ms = aos; ms <= los; ms += 5e3) {
      const factor = sat.dopplerFactor(galway, new Date(ms))!;
      const rdotFactor = (1 - factor) * cKmPerSec;
      const rdotRae = rangeRateFromRae(ms);

      maxErrMS = Math.max(maxErrMS, Math.abs(rdotFactor - rdotRae) * 1000);
      if (Math.abs(ms - tca) <= 5e3) {
        tcaChecked = true;
      }
    }

    expect(tcaChecked).toBe(true);
    // Under 1 m/s (was 217 m/s with the spherical-Earth observer; residual is ~0.3 m/s)
    expect(maxErrMS).toBeLessThan(1);
  });

  it('is > 1 while approaching and < 1 while receding', () => {
    const { aos, los } = findPass();

    expect(sat.dopplerFactor(galway, new Date(aos + 30e3))!).toBeGreaterThan(1);
    expect(sat.dopplerFactor(galway, new Date(los - 30e3))!).toBeLessThan(1);
    expect(sat.applyDoppler(12e9, galway, new Date(aos + 30e3))!).toBeGreaterThan(12e9);
  });
});
