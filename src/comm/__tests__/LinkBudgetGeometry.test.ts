/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import {
  Antenna,
  Decibels,
  Degrees,
  GroundStation,
  Hertz,
  Kilometers,
  LinkGeometry,
  Receiver,
  Transmitter,
  Watts,
  wattsToDbw,
} from '../../main';
import { ecef2rae, llaRad2ecef } from '../../transforms/transforms';

const DATE = new Date('2024-03-01T12:00:00Z');
const DEG = Math.PI / 180;

type Vec = { x: number; y: number; z: number };

/** Space platform stub: J2000 position sets the range, ECEF sets the ground end's look angles. */
const spaceStub = (j2000: Vec, ecef: Vec) =>
  ({ id: 99, name: 'sat', toJ2000: () => ({ position: j2000 }), ecef: () => ecef }) as never;

const geoEcef = (latDeg: number, lonDeg: number, altKm: number): Vec =>
  llaRad2ecef({ lat: latDeg * DEG, lon: lonDeg * DEG, alt: altKm } as never);

/** Antenna whose gain falls 0.1 dB per degree below 90 deg elevation (test pattern). */
class ElevationAntenna extends Antenna {
  calls: [number, number][] = [];
  getGainToward(az: Degrees, el: Degrees): Decibels {
    this.calls.push([az, el]);

    return (this.gain - (90 - el) * 0.1) as Decibels;
  }
}

const makeTx = (antenna: Antenna, f = 4e9, power = 10, lineLoss = 0): Transmitter => new Transmitter({
  id: 1, name: 'tx', frequency: f as Hertz, power: power as Watts, bandwidth: 36e6 as Hertz,
  antenna, lineLoss: lineLoss as Decibels,
});
const makeRx = (antenna: Antenna, f = 4e9, lineLoss = 0): Receiver => new Receiver({
  id: 2, name: 'rx', frequency: f as Hertz, bandwidth: 36e6 as Hertz,
  noiseFigure: 1.5 as Decibels, minimumSnr: 3 as Decibels, antenna, lineLoss: lineLoss as Decibels,
});
const gs = (lat: number, lon: number, alt = 0) =>
  new GroundStation({ lat: lat as Degrees, lon: lon as Degrees, alt: alt as Kilometers });

/** Space stub exactly `d` km from the ground station in J2000; `ecef` only drives look angles. */
const satAt = (g: GroundStation, d: number, ecef: Vec = geoEcef(0, 0, 35786)) => {
  const p = g.toJ2000(DATE).position;

  return spaceStub({ x: p.x + d, y: p.y, z: p.z }, ecef);
};

describe('Antenna.getGainToward default', () => {
  it('returns peak gain for any direction', () => {
    const a = new Antenna({ gain: 33 as Decibels });

    expect(a.getGainToward(0 as Degrees, 90 as Degrees)).toBe(33);
    expect(a.getGainToward(271 as Degrees, -5 as Degrees)).toBe(33);
  });
});

describe('calculateLinkBudget backward compatibility', () => {
  it.each([['ground to space'], ['space to ground']])('%s equals the pre-change formula', (label) => {
    const ground = gs(38, -77, 0.1);
    const sat = satAt(ground, 36000);
    const gAnt = new Antenna({ gain: 45 as Decibels });
    const sAnt = new Antenna({ gain: 20 as Decibels });
    const up = label === 'ground to space';
    const f = up ? 6e9 : 4e9;
    const tx = up ? makeTx(gAnt, f, 100, 1.5) : makeTx(sAnt, f, 20, 0.5);
    const rx = up ? makeRx(sAnt, f, 0.3) : makeRx(gAnt, f, 0.7);

    tx.setParent(up ? ground : sat);
    rx.setParent(up ? sat : ground);
    const b = tx.calculateLinkBudget(rx, DATE);

    // Pre-change formula: EIRP = Pt + Gt(peak) - Lt; Pr = EIRP - FSPL + Gr(peak) - Lr
    const fspl = 20 * Math.log10(36000) + 20 * Math.log10(f) - 87.55;
    const eirp = 10 * Math.log10(up ? 100 : 20) + (up ? 45 : 20) - (up ? 1.5 : 0.5);
    const rcv = eirp - fspl + (up ? 20 : 45) - (up ? 0.3 : 0.7);

    expect(b.distance).toBeCloseTo(36000, 6);
    expect(b.fspl).toBeCloseTo(fspl, 9);
    expect(b.eirp).toBeCloseTo(eirp, 9);
    expect(b.receivedPower).toBeCloseTo(rcv, 9);
    expect(b.snr).toBeCloseTo(rcv - rx.noiseFloor, 9);
    expect(b.totalAdditionalLoss).toBe(0);
    expect(b.losses).toEqual([]);
  });
});

describe('calculateLinkBudget reference values', () => {
  // GEO sub-satellite range 35,786 km. ITU-R P.525-4 eq. (4), free-space basic transmission loss
  // L = 32.45 + 20log f(MHz) + 20log d(km), gives 4 GHz -> 195.6 dB and 6 GHz -> 199.1 dB.
  // Tolerance: toBeCloseTo(.,1) = 0.05 dB for rounding the expected value to 0.1 dB.
  it.each([[4e9, 195.6], [6e9, 199.1]])('FSPL at 35,786 km and %d Hz is %f dB', (f, expected) => {
    const g = gs(0, 0);
    const tx = makeTx(new Antenna({ gain: 0 as Decibels }), f);
    const rx = makeRx(new Antenna({ gain: 0 as Decibels }), f);

    tx.setParent(g);
    rx.setParent(satAt(g, 35786));
    const b = tx.calculateLinkBudget(rx, DATE);

    expect(b.fspl).toBeCloseTo(expected, 1);
    // 32.45 constant vs the code's 87.55 km constant: they agree within 0.01 dB
    expect(Math.abs(b.fspl - (32.45 + 20 * Math.log10(f / 1e6) + 20 * Math.log10(35786)))).toBeLessThan(0.01);
  });

  // GEO downlink C/N from the link equation C/N = EIRP + G/T - Lp - k - B, with Lp from ITU-R P.525-4
  // and k = 10log10(1.380649e-23 J/K) = -228.6 dBW/K/Hz (CODATA 2018, exact SI value). Tx 10 W + 30 dBi
  // -> 40 dBW; Rx 40 dBi, NF 1.5 dB so T = 290*10^0.15 K; B = 36 MHz. The class uses noise =
  // -204 dBW/Hz + 10logB + NF (kT0 = -203.98 dBW/Hz), so the tolerance is 0.05 dB.
  it('downlink C/N matches the link equation', () => {
    const g = gs(0, 0);
    const tx = makeTx(new Antenna({ gain: 30 as Decibels }));
    const rx = makeRx(new Antenna({ gain: 40 as Decibels }));

    tx.setParent(satAt(g, 35786));
    rx.setParent(g);
    const b = tx.calculateLinkBudget(rx, DATE);
    const gOverT = 40 - 10 * Math.log10(290 * 10 ** 0.15);
    const lp = 32.45 + 20 * Math.log10(4000) + 20 * Math.log10(35786);
    const cn = 40 + gOverT - lp + 228.6 - 10 * Math.log10(36e6);

    expect(b.eirp).toBeCloseTo(wattsToDbw(10 as Watts) + 30, 9);
    expect(Math.abs(b.snr - cn)).toBeLessThan(0.05);
  });
});

describe('calculateLinkBudget geometry', () => {
  it('overhead satellite gives elevation ~90 and the pattern gain is read there', () => {
    const g = gs(40, -100, 0.5);
    const sat = satAt(g, 600, geoEcef(40, -100, 600.5));
    const ant = new ElevationAntenna({ gain: 30 as Decibels });
    const tx = makeTx(ant, 2e9, 10);
    const rx = makeRx(new Antenna({ gain: 0 as Decibels }), 2e9);

    tx.setParent(g);
    rx.setParent(sat);
    const b = tx.calculateLinkBudget(rx, DATE);

    expect(b.geometry?.tx?.lookEl).toBeGreaterThan(89.99);
    expect(b.geometry?.rx).toBeUndefined();
    expect(b.geometry?.tx?.latitude).toBe(40);
    expect(b.geometry?.tx?.altitude).toBeCloseTo(0.5, 9);
    expect(b.txAntennaGain).toBeCloseTo(30, 3);
    expect(b.eirp).toBeCloseTo(10 + 30, 3);
  });

  it('look angles match an independent ecef2rae and gain follows elevation', () => {
    const g = gs(10, 20, 0);
    const satEcef = geoEcef(5, 45, 35786);
    const ant = new ElevationAntenna({ gain: 30 as Decibels });
    const rx = makeRx(ant, 4e9);
    const tx = makeTx(new Antenna({ gain: 10 as Decibels }), 4e9);

    tx.setParent(satAt(g, 38000, satEcef));
    rx.setParent(g);
    const b = tx.calculateLinkBudget(rx, DATE);
    const ref = ecef2rae(g.lla(), satEcef);

    expect(b.geometry?.rx?.lookAz).toBeCloseTo(ref.az, 9);
    expect(b.geometry?.rx?.lookEl).toBeCloseTo(ref.el, 9);
    expect(b.geometry?.tx).toBeUndefined();
    expect(b.rxAntennaGain).toBeCloseTo(30 - (90 - ref.el) * 0.1, 9);
    expect(ant.calls).toHaveLength(1);
    // the satellite end is evaluated at peak gain
    expect(b.txAntennaGain).toBe(10);
  });

  it('ground to ground computes both look angles (reciprocal bearings on the equator)', () => {
    const tx = makeTx(new Antenna({ gain: 0 as Decibels }), 1e9);
    const rx = makeRx(new Antenna({ gain: 0 as Decibels }), 1e9);

    tx.setParent(gs(0, 0));
    rx.setParent(gs(0, 1));
    const geo = tx.calculateLinkBudget(rx, DATE).geometry as LinkGeometry;

    expect(geo.tx?.lookAz).toBeCloseTo(90, 1);
    expect(geo.rx?.lookAz).toBeCloseTo(270, 1);
    // 1 deg of longitude on the equator is ~111.3 km: the chord dips ~0.5 deg below the local horizon
    expect(geo.tx?.lookEl).toBeCloseTo(-0.5, 1);
  });
});

describe('calculateLinkBudget loss terms', () => {
  it('sums fixed and model terms, breaks them out and passes geometry to models', () => {
    const g = gs(30, 10, 0.2);
    const sat = satAt(g, 36000, geoEcef(30, 10, 36000));
    const tx = makeTx(new Antenna({ gain: 40 as Decibels }), 12e9);
    const rx = makeRx(new Antenna({ gain: 20 as Decibels }), 12e9);

    tx.setParent(g);
    rx.setParent(sat);
    const base = tx.calculateLinkBudget(rx, DATE);
    let seenGeo: LinkGeometry | undefined;
    let seenFreq = 0;
    const b = tx.calculateLinkBudget(rx, DATE, {
      losses: [{ name: 'pointing', db: 0.5 as Decibels }],
      lossModels: [
        (geo, f) => {
          seenGeo = geo;
          seenFreq = f;

          return [{ name: 'rain', db: 2.25 as Decibels }, { name: 'gas', db: 0.25 as Decibels }];
        },
      ],
    });

    expect(b.losses?.map((l) => l.name)).toEqual(['pointing', 'rain', 'gas']);
    expect(b.totalAdditionalLoss).toBeCloseTo(3, 12);
    expect(b.receivedPower).toBeCloseTo(base.receivedPower - 3, 9);
    expect(b.snr).toBeCloseTo(base.snr - 3, 9);
    expect(b.eirp).toBe(base.eirp);
    expect(seenFreq).toBe(12e9);
    expect(seenGeo?.distance).toBeCloseTo(36000, 6);
    expect(seenGeo?.tx?.latitude).toBe(30);
    expect(seenGeo?.tx?.altitude).toBeCloseTo(0.2, 9);
    expect(seenGeo?.tx?.lookEl).toBeGreaterThan(89.9);
  });
});
