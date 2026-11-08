/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { ValidationError } from '../../errors';
import { GroundStation } from '../../objects/GroundStation';
import { Satellite } from '../../objects/Satellite';
import { lla2ecef } from '../../transforms/transforms';
import type { Degrees, Kilometers, TleLine1, TleLine2 } from '../../types/types';
import { GnssAntenna } from '../GnssAntenna';
import { GnssReceiver, type GnssSatellite, type GnssReceiverParams } from '../GnssReceiver';
import { GPS_L1_CA } from '../GnssSignal';
import { BOLTZMANN_J_PER_K, calculateInterfererAtReceiver, calculateJammingResistanceFactor, systemNoiseTemperatureK } from '../link';
import { GPS_TLES } from './gps-tles.fixture';

const C_M_S = 299792458;
const DEG = Math.PI / 180;
const NOISE = { noiseFigureDb: 2, antennaTemperatureK: 100 };
const T0 = new Date('2026-03-09T12:00:00Z');
const at = (sec: number): Date => new Date(T0.getTime() + sec * 1000);

const site = new GroundStation({ lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers, name: 'site' });
const sats: GnssSatellite[] = GPS_TLES.map((t) => ({
  id: t.name,
  object: new Satellite({ tle1: t.tle1 as TleLine1, tle2: t.tle2 as TleLine2, name: t.name }),
}));

const makeReceiver = (over: Partial<GnssReceiverParams> = {}): GnssReceiver =>
  new GnssReceiver({
    signal: GPS_L1_CA,
    antenna: GnssAntenna.typicalFrpa(),
    noise: NOISE,
    acquisitionThresholdDbHz: 32,
    ...over,
  });

/** Independent geometry: elevation and ECEF line-of-sight unit vector computed from raw ECEF, not ecef2rae. */
function independentGeometry(date: Date): { el: number; los: number[] }[] {
  const lla = site.lla();
  const rx = lla2ecef(lla);
  const lat = lla.lat * DEG;
  const lon = lla.lon * DEG;
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];

  return sats.map((s) => {
    const e = s.object.ecef(date)!;
    const d = [e.x - rx.x, e.y - rx.y, e.z - rx.z];
    const r = Math.hypot(d[0], d[1], d[2]);
    const los = d.map((v) => v / r);

    return { el: Math.asin(los[0] * up[0] + los[1] * up[1] + los[2] * up[2]) / DEG, los };
  });
}

/** PDOP from an ECEF-frame H matrix, rows [-los, 1] (sign is irrelevant to PDOP), by plain Gauss-Jordan. */
function independentPdop(rows: number[][]): number {
  const n = 4;
  const a = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => rows.reduce((acc, r) => acc + r[i] * r[j], 0)).concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
  );

  for (let c = 0; c < n; c++) {
    let p = c;

    for (let r = c + 1; r < n; r++) {
      if (Math.abs(a[r][c]) > Math.abs(a[p][c])) {
        p = r;
      }
    }
    [a[c], a[p]] = [a[p], a[c]];
    const div = a[c][c];

    a[c] = a[c].map((v) => v / div);
    for (let r = 0; r < n; r++) {
      if (r !== c) {
        const f = a[r][c];

        a[r] = a[r].map((v, k) => v - f * a[c][k]);
      }
    }
  }

  return Math.sqrt(a[0][4] + a[1][5] + a[2][6]);
}

describe('GnssReceiver with 26 real GPS TLEs', () => {
  it('counts visible satellites and PDOP like an independent ECEF recomputation', () => {
    const geom = independentGeometry(T0);
    const visible = geom.filter((g) => g.el >= 5);
    const expectedPdop = independentPdop(visible.map((g) => [...g.los, 1]));
    const result = makeReceiver().step(T0, site, sats);

    expect(visible.length).toBeGreaterThanOrEqual(4);
    expect(result.trackedCount).toBe(visible.length);
    expect(result.hasFix).toBe(true);
    // Frame-independent quantity; both sides use sub-microradian geometry, so 1e-6.
    expect(Math.abs(result.dop.pdop - expectedPdop)).toBeLessThan(1e-6);
    expect(result.dop.pdop).toBeGreaterThan(1);
    expect(result.dop.pdop).toBeLessThan(6);
    // Sanity on the elevation values the receiver reports.
    result.satellites.forEach((s, i) => {
      expect(s.el).toBeCloseTo(geom[i].el, 1);
    });
  });

  it('reports unseen satellites without C/N0 and tracked ones above threshold', () => {
    const result = makeReceiver().step(T0, site, sats);

    for (const s of result.satellites) {
      if (s.state === 'unseen') {
        expect(s.cn0DbHz).toBeNull();
        expect(s.el!).toBeLessThan(5);
      } else {
        expect(s.state).toBe('tracking');
        expect(s.effectiveCn0DbHz!).toBeCloseTo(s.cn0DbHz!, 9);
        expect(s.cn0DbHz!).toBeGreaterThan(32);
      }
    }
  });

  it('has no fix and null time-since-fix when too few satellites are offered', () => {
    const r = makeReceiver().step(T0, site, sats.slice(0, 2));

    expect(r.hasFix).toBe(false);
    expect(r.timeSinceLastFixSec).toBeNull();
    expect(r.dop.pdop).toBe(Infinity);
  });
});

describe('jammer range (Kaplan and Hegarty 2006 Eq. 6.8 with FSPL solved analytically)', () => {
  // Procedure: acquire all satellites without a jammer, then apply a narrowband (Q = 1) jammer directly overhead.
  // The overhead antenna gain is 1.5 dBic (typicalFrpa). The tracking threshold is crossed when
  //   J/C = Q Rc (10^-2.8 - 10^(-CN0/10))   (Eq. 6.22 with Q = 1)
  // so J_thr = C + 10 log10(J/C), and with J = EIRP - FSPL + 1.5 the threshold distance follows from
  //   FSPL = 20 log10(4 pi d f / c)  ->  d = c / (4 pi f) 10^(FSPL / 20).
  // 10 percent either side of the distance corresponds to about +-0.9 dB of J.
  const eirpDbw = -12;
  const fs = GPS_L1_CA.carrierFrequencyHz;

  function thresholdDistanceKm(cn0DbHz: number, tsysK: number): number {
    const n0Dbw = 10 * Math.log10(BOLTZMANN_J_PER_K * tsysK);
    const cDbw = cn0DbHz + n0Dbw;
    const jc = 1 * GPS_L1_CA.chipRateHz * (10 ** -2.8 - 10 ** (-cn0DbHz / 10));
    const jThr = cDbw + 10 * Math.log10(jc);
    const fspl = eirpDbw + 1.5 - jThr;

    return ((C_M_S / (4 * Math.PI * fs)) * 10 ** (fspl / 20)) / 1000;
  }

  const run = (scale: number): { target: string; state: string; d: number } => {
    const rx = makeReceiver();
    const base = rx.step(T0, site, sats);
    const target = base.satellites.find((s) => s.state === 'tracking')!;
    const d = thresholdDistanceKm(target.cn0DbHz!, systemNoiseTemperatureK(NOISE));
    const jammer = {
      position: { lat: site.lat, lon: site.lon, alt: (site.alt + d * scale) as Kilometers },
      eirpDbw,
      centerFrequencyHz: fs,
      bandwidthHz: 0,
      spectralType: 'narrowband' as const,
    };
    const next = rx.step(at(1), site, sats, [jammer]);

    return { target: target.id, state: next.satellites.find((s) => s.id === target.id)!.state, d };
  };

  it('the threshold distance is a plausible tens of km (sanity of the analytic solve)', () => {
    const { d } = run(1);

    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(200);
  });

  it('loses lock at 0.9 of the threshold distance', () => {
    expect(run(0.9).state).toBe('lost');
  });

  it('keeps lock at 1.1 of the threshold distance (tracking threshold is below acquisition)', () => {
    expect(run(1.1).state).toBe('tracking');
  });

  it('a strong jammer removes the fix and time-since-fix grows; recovery restores it', () => {
    const rx = makeReceiver();
    const jam = {
      position: { lat: site.lat, lon: site.lon, alt: (site.alt + 1) as Kilometers },
      eirpDbw: 30,
      centerFrequencyHz: fs,
      bandwidthHz: 20.46e6,
      spectralType: 'bandlimited-noise' as const,
    };

    expect(rx.step(T0, site, sats).hasFix).toBe(true);
    const down1 = rx.step(at(60), site, sats, [jam]);
    const down2 = rx.step(at(90), site, sats, [jam]);

    expect(down1.trackedCount).toBe(0);
    expect(down1.hasFix).toBe(false);
    expect(down1.timeSinceLastFixSec).toBe(60);
    expect(down2.timeSinceLastFixSec).toBe(90);

    const back = rx.step(at(100), site, sats);

    expect(back.hasFix).toBe(true);
    expect(back.timeSinceLastFixSec).toBe(0);
  });

  it('never having a fix leaves time-since-fix null', () => {
    const rx = makeReceiver();
    const jam = {
      position: { lat: site.lat, lon: site.lon, alt: (site.alt + 1) as Kilometers },
      eirpDbw: 30,
      centerFrequencyHz: fs,
      bandwidthHz: 20.46e6,
      spectralType: 'bandlimited-noise' as const,
    };

    expect(rx.step(T0, site, sats, [jam]).timeSinceLastFixSec).toBeNull();
  });
});

describe('implementation loss cancels in J/C (Kaplan and Hegarty 2006, Eq. 6.24, p. 263)', () => {
  const fs = GPS_L1_CA.carrierFrequencyHz;
  const bw = GPS_L1_CA.defaultReceiverBandwidthHz;
  const tsys = systemNoiseTemperatureK(NOISE);
  const n0Dbw = 10 * Math.log10(BOLTZMANN_J_PER_K * tsys);
  const lossDb = 2; // Kaplan's worked example uses L = 2 dB

  /** One tracked satellite, receiver with L = 2 dB, optional powerOffsetDb on the satellite. */
  const firstTracked = (offset: number): { rx: GnssReceiver; id: string; cn0: number; az: number; el: number; sat: GnssSatellite } => {
    const rx = makeReceiver({ implementationLossDb: lossDb, noise: NOISE });
    const probe = rx.step(T0, site, sats);
    const t = probe.satellites.find((s) => s.state === 'tracking')!;
    const sat: GnssSatellite = { ...sats.find((s) => s.id === t.id)!, powerOffsetDb: offset };

    rx.reset();

    return { rx, id: t.id, cn0: t.cn0DbHz!, az: t.az!, el: t.el!, sat };
  };

  // Table 6.4, BLWN row: unjammed C/N0 = 41.9 dB-Hz (with L = 2 dB), 28 dB-Hz threshold, Q = 2.22, J/S at the
  // antenna input 39.9 dB with Gsv - Gj = 4.5 dB, so the inside-receiver J/C is 39.9 - 4.5 = 35.4 dB
  // (calculateJammingToSignalForCn0(41.9, 28, 2.22) is checked against this in link.test.ts). Here the whole receiver
  // path is run: the satellite power offset tunes C/N0 to 41.9 exactly, the jammer is set so J/C measured against the
  // signal BEFORE L equals 35.4 dB, and the effective C/N0 must come out at 28.0 dB-Hz. Published to 0.1 dB.
  it('reproduces Table 6.4 (J/S 39.9 dB, Q 2.22 gives 28 dB-Hz) with L = 2 dB', () => {
    const { rx, cn0, sat } = firstTracked(0);
    const shifted = firstTracked(41.9 - cn0);
    const q = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs, bandwidthHz: 2 * GPS_L1_CA.chipRateHz, spectralType: 'bandlimited-noise' }, bw);
    const base = { position: { lat: site.lat, lon: site.lon, alt: (site.alt + 10) as Kilometers }, eirpDbw: 0, centerFrequencyHz: fs, bandwidthHz: 2 * GPS_L1_CA.chipRateHz, spectralType: 'bandlimited-noise' as const };
    const p0 = calculateInterfererAtReceiver(base, site.lla(), GnssAntenna.typicalFrpa(), GPS_L1_CA, bw, T0).jammerPowerDbw;

    expect(sat.id).toBe(shifted.id);
    const rx2 = shifted.rx;
    const unjammed = rx2.step(T0, site, [shifted.sat]);

    expect(unjammed.satellites[0].cn0DbHz).toBeCloseTo(41.9, 9);
    expect(q.q).toBeCloseTo(2.22, 2);
    rx2.reset();
    const cRawDbw = 41.9 + n0Dbw + lossDb; // signal power before L
    const jammer = { ...base, eirpDbw: cRawDbw + 35.4 - p0 };
    const jammed = rx2.step(T0, site, [shifted.sat], [jammer]);

    expect(rx).toBeDefined();
    expect(Math.abs(jammed.satellites[0].effectiveCn0DbHz! - 28)).toBeLessThan(0.1);
  });

  // The old code put L on the signal only, so J/C was 2 dB too large and the effective C/N0 about 1 dB low here.
  // Independent check of the same case through Eq. 6.8 directly with Craw.
  it('J/C seen by the receiver equals Jraw/Craw regardless of L', () => {
    const a = firstTracked(0);
    const cn0 = a.cn0;
    const rawC = cn0 + n0Dbw + lossDb;
    const base = { position: { lat: site.lat, lon: site.lon, alt: (site.alt + 10) as Kilometers }, eirpDbw: -10, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' as const };
    const p = calculateInterfererAtReceiver(base, site.lla(), GnssAntenna.typicalFrpa(), GPS_L1_CA, bw, T0).jammerPowerDbw;
    const eff = a.rx.step(T0, site, sats, [base]).satellites.find((s) => s.id === a.id)!.effectiveCn0DbHz!;
    const expected = -10 * Math.log10(10 ** (-cn0 / 10) + (10 ** ((p - rawC) / 10)) / (1 * GPS_L1_CA.chipRateHz));

    expect(eff).toBeCloseTo(expected, 6);
  });

  // Lock-loss distance: the analytic threshold uses J/C = J/S-type ratio against the signal before L, so the
  // distance depends on L only through the unjammed C/N0 it produces. Solve it analytically with Craw = C/N0 + N0 + L.
  it('the lock-loss jammer distance brackets the analytic threshold computed with the signal before L', () => {
    const eirpDbw = -12;
    const probe = firstTracked(0);
    const cn0 = probe.cn0;
    const jc = GPS_L1_CA.chipRateHz * (10 ** -2.8 - 10 ** (-cn0 / 10));
    const jThr = cn0 + n0Dbw + lossDb + 10 * Math.log10(jc);
    const fspl = eirpDbw + 1.5 - jThr;
    const dKm = ((C_M_S / (4 * Math.PI * fs)) * 10 ** (fspl / 20)) / 1000;
    const stateAt = (scale: number): string => {
      const t = firstTracked(0);
      const jammer = {
        position: { lat: site.lat, lon: site.lon, alt: (site.alt + dKm * scale) as Kilometers },
        eirpDbw,
        centerFrequencyHz: fs,
        bandwidthHz: 0,
        spectralType: 'narrowband' as const,
      };

      t.rx.step(T0, site, sats);

      return t.rx.step(at(1), site, sats, [jammer]).satellites.find((s) => s.id === t.id)!.state;
    };

    expect(stateAt(0.98)).toBe('lost');
    expect(stateAt(1.02)).toBe('tracking');
  });
});

describe('lock hysteresis and acquisition', () => {
  const first = (_unused?: GnssReceiver): GnssSatellite => {
    const r = makeReceiver();
    const res = r.step(T0, site, sats);
    const t = res.satellites.find((s) => s.state === 'tracking')!;

    r.reset();

    return { ...sats.find((s) => s.id === t.id)!, powerOffsetDb: 0 };
  };

  // Offset so that C/N0 is 30 dB-Hz: between the 28 tracking and 32 acquisition thresholds.
  const offsetTo = (r: GnssReceiver, sat: GnssSatellite, target: number): number => {
    const cn0 = r.step(T0, site, [sat]).satellites[0].cn0DbHz!;

    r.reset();

    return target - cn0;
  };

  it('keeps a tracked satellite when C/N0 falls between the thresholds', () => {
    const rx = makeReceiver();
    const sat = first(rx);
    const off = offsetTo(rx, sat, 30);

    expect(rx.step(T0, site, [sat]).satellites[0].state).toBe('tracking');
    // Same epoch as the offset calibration, so C/N0 is exactly 30.
    const weak = rx.step(T0, site, [{ ...sat, powerOffsetDb: off }]).satellites[0];

    expect(weak.cn0DbHz!).toBeCloseTo(30, 9);
    expect(weak.state).toBe('tracking');
  });

  it('does not acquire a lost satellite at the same in-between C/N0', () => {
    const rx = makeReceiver();
    const sat = first(rx);
    const off = offsetTo(rx, sat, 30);
    const weak = { ...sat, powerOffsetDb: off };

    expect(rx.step(T0, site, [weak]).satellites[0].state).toBe('lost');
  });

  it('loses a tracked satellite below the tracking threshold, then needs acquisition-level C/N0 to return', () => {
    const rx = makeReceiver();
    const sat = first(rx);
    const o27 = offsetTo(rx, sat, 27.9);
    const o30 = offsetTo(rx, sat, 30);
    const o33 = offsetTo(rx, sat, 33);

    expect(rx.step(T0, site, [sat]).satellites[0].state).toBe('tracking');
    expect(rx.step(at(1), site, [{ ...sat, powerOffsetDb: o27 }]).satellites[0].state).toBe('lost');
    expect(rx.step(at(2), site, [{ ...sat, powerOffsetDb: o30 }]).satellites[0].state).toBe('lost');
    expect(rx.step(at(3), site, [{ ...sat, powerOffsetDb: o33 }]).satellites[0].state).toBe('tracking');
  });

  it('requires C/N0 above acquisition for reacquisitionTimeSec before locking', () => {
    const rx = makeReceiver({ reacquisitionTimeSec: 10 });
    const sat = first(rx);

    expect(rx.step(T0, site, [sat]).satellites[0].state).toBe('lost');
    expect(rx.step(at(5), site, [sat]).satellites[0].state).toBe('lost');
    expect(rx.step(at(10), site, [sat]).satellites[0].state).toBe('tracking');
  });

  it('resets the acquisition timer if C/N0 dips below acquisition mid-wait', () => {
    const rx = makeReceiver({ reacquisitionTimeSec: 10 });
    const sat = first(rx);
    const o30 = offsetTo(rx, sat, 30);

    rx.step(T0, site, [sat]);
    rx.step(at(6), site, [{ ...sat, powerOffsetDb: o30 }]);
    expect(rx.step(at(12), site, [sat]).satellites[0].state).toBe('lost');
    expect(rx.step(at(22), site, [sat]).satellites[0].state).toBe('tracking');
  });

  it('reports a satellite below a raised elevation mask as unseen', () => {
    const rx = makeReceiver({ elevationMaskDeg: 5 });
    const sat = first(rx);

    expect(rx.step(T0, site, [sat]).satellites[0].state).toBe('tracking');
    const high = makeReceiver({ elevationMaskDeg: 89.9 });

    expect(high.step(T0, site, [sat]).satellites[0].state).toBe('unseen');
  });

  it('maxPdop can veto a fix even with enough satellites', () => {
    const r = makeReceiver({ maxPdop: 1.2 }).step(T0, site, sats);

    expect(r.trackedCount).toBeGreaterThanOrEqual(4);
    expect(r.hasFix).toBe(false); // no geometry has PDOP below the 1.5 tetrahedron minimum
  });

  it('reset forgets state; going back in time throws', () => {
    const rx = makeReceiver();

    rx.step(at(10), site, sats);
    expect(() => rx.step(at(5), site, sats)).toThrow(ValidationError);
    rx.reset();
    expect(rx.step(at(5), site, sats).trackedCount).toBeGreaterThan(0);
  });
});

describe('GnssReceiver configuration', () => {
  it('uses sourced defaults', () => {
    const rx = makeReceiver();

    expect(rx.trackingThresholdDbHz).toBe(28);
    expect(rx.elevationMaskDeg).toBe(5);
    expect(rx.receiverBandwidthHz).toBe(GPS_L1_CA.defaultReceiverBandwidthHz);
    expect(rx.minSatellitesForFix).toBe(4);
  });

  it('validates parameters', () => {
    expect(() => makeReceiver({ acquisitionThresholdDbHz: 20 })).toThrow(ValidationError);
    expect(() => makeReceiver({ acquisitionThresholdDbHz: NaN })).toThrow(ValidationError);
    expect(() => makeReceiver({ receiverBandwidthHz: 0 })).toThrow(ValidationError);
    expect(() => makeReceiver({ reacquisitionTimeSec: -1 })).toThrow(ValidationError);
    expect(() => makeReceiver({ minSatellitesForFix: 3 })).toThrow(ValidationError);
    expect(() => makeReceiver({ maxPdop: 0 })).toThrow(ValidationError);
    expect(() => makeReceiver({ noise: { systemTemperatureK: -5 } })).toThrow(ValidationError);
  });

  it('round-trips configuration through serialize/deserialize', () => {
    const rx = makeReceiver({ maxPdop: 6, reacquisitionTimeSec: 3, elevationMaskDeg: 10 });
    const copy = GnssReceiver.deserialize(rx.serialize());

    expect(copy.serialize()).toEqual(rx.serialize());
    expect(() => GnssReceiver.deserialize({ ...rx.serialize(), signalId: 'nope' })).toThrow(ValidationError);
    expect(makeReceiver().serialize().maxPdop).toBeNull();
  });
});
