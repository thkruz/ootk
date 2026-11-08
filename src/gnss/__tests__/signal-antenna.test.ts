/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { ValidationError } from '../../errors';
import type { Degrees } from '../../types/types';
import { GnssAntenna } from '../GnssAntenna';
import { BEIDOU_B1I, GALILEO_E1_OS, GLONASS_L1OF, GNSS_SIGNALS, GPS_L1C, GPS_L1_CA, GPS_L2C, GPS_L5 } from '../GnssSignal';

describe('GnssSignal presets', () => {
  // IS-GPS-200N Table 3-Va p.16 (L1 C/A, L2 C), IS-GPS-705J Table 3-III p.11 (L5), IS-GPS-800H Table 3.2-1 p.7 (L1C).
  // The last three are secondary sources (not read from an ICD), flagged in GnssSignal.ts.
  it.each([
    [GPS_L1_CA, -158.5, 1575.42e6, 1.023e6, 'primary'],
    [GPS_L2C, -160, 1227.6e6, 1.023e6, 'primary'],
    [GPS_L1C, -157, 1575.42e6, 1.023e6, 'primary'],
    [GPS_L5, -157.9, 1176.45e6, 10.23e6, 'primary'],
    [GALILEO_E1_OS, -157.25, 1575.42e6, 1.023e6, 'secondary'],
    [GLONASS_L1OF, -161, 1602e6, 0.511e6, 'secondary'],
    [BEIDOU_B1I, -163, 1561.098e6, 2.046e6, 'secondary'],
  ])('%#: has the documented values', (sig, pmin, fc, rc, quality) => {
    expect(sig.minimumReceivedPowerDbw).toBe(pmin);
    expect(sig.carrierFrequencyHz).toBeCloseTo(fc, 0);
    expect(sig.chipRateHz).toBeCloseTo(rc, 0);
    expect(sig.sourceQuality).toBe(quality);
    expect(sig.source.length).toBeGreaterThan(10);
    expect(sig.referenceAntennaGainDbic).toBe(0);
  });

  it('indexes every preset by id and freezes them', () => {
    expect(Object.keys(GNSS_SIGNALS)).toHaveLength(7);
    expect(GNSS_SIGNALS['gps-l1ca']).toBe(GPS_L1_CA);
    expect(Object.isFrozen(GPS_L1_CA)).toBe(true);
  });
});

describe('GnssAntenna', () => {
  const table = [
    { el: 0, gainDbic: -6 },
    { el: 5, gainDbic: -3 },
    { el: 30, gainDbic: 0 },
    { el: 90, gainDbic: 4 },
  ];

  it('interpolates linearly in dB between points', () => {
    const a = new GnssAntenna({ elevationGainTable: table });

    // f = (15 - 5) / (30 - 5) = 0.4; gain = -3 + 0.4 * 3 = -1.8 dBic. Exact arithmetic, 1e-12.
    expect(a.getGainToward(0 as Degrees, 15 as Degrees)).toBeCloseTo(-1.8, 12);
  });

  it('returns table values at the knots and ignores azimuth', () => {
    const a = new GnssAntenna({ elevationGainTable: table });

    expect(a.getGainToward(123 as Degrees, 30 as Degrees)).toBe(0);
    expect(a.getGainToward(0 as Degrees, 30 as Degrees)).toBe(0);
  });

  it('holds the end values outside the table and accepts unsorted input', () => {
    const a = new GnssAntenna({ elevationGainTable: [...table].reverse() });

    expect(a.getGainToward(0 as Degrees, -45 as Degrees)).toBe(-6);
    expect(a.getGainToward(0 as Degrees, 90 as Degrees)).toBe(4);
    expect(a.gain).toBe(4);
  });

  // Kaplan and Hegarty 2006 pp. 262-263: about -3 dBic at 5 degrees and +1.5 dBic at zenith.
  it('typicalFrpa matches the Kaplan and Hegarty anchors', () => {
    const a = GnssAntenna.typicalFrpa();

    expect(a.getGainToward(0 as Degrees, 5 as Degrees)).toBe(-3);
    expect(a.getGainToward(0 as Degrees, 90 as Degrees)).toBe(1.5);
  });

  it('round-trips through serialize/deserialize and clone', () => {
    const a = new GnssAntenna({ elevationGainTable: table });
    const b = GnssAntenna.deserialize(a.serialize());

    expect(a.serialize().type).toBe('gnss');
    expect(b.elevationGainTable).toEqual(a.elevationGainTable);
    expect(a.clone().elevationGainTable).toEqual(a.elevationGainTable);
  });

  it('validates input', () => {
    expect(() => new GnssAntenna({ elevationGainTable: [] })).toThrow(ValidationError);
    expect(() => new GnssAntenna({ elevationGainTable: [{ el: 100, gainDbic: 0 }] })).toThrow(ValidationError);
    expect(() => new GnssAntenna({ elevationGainTable: [{ el: 10, gainDbic: NaN }] })).toThrow(ValidationError);
    expect(
      () =>
        new GnssAntenna({
          elevationGainTable: [
            { el: 10, gainDbic: 0 },
            { el: 10, gainDbic: 1 },
          ],
        }),
    ).toThrow(ValidationError);
  });
});
