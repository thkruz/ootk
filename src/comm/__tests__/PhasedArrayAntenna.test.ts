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
  PhasedArrayAntenna,
  Receiver,
  Transmitter,
  Watts,
  deserializeAntenna,
} from '../../main';
import { llaRad2ecef } from '../../transforms/transforms';

const DEG = Math.PI / 180;
const DATE = new Date('2024-03-01T12:00:00Z');
const dB = (x: number) => x as Decibels;
const d = (x: number) => x as Degrees;

describe('PhasedArrayAntenna.fromAperture', () => {
  // Aperture-antenna relation G = eta * 4 * pi * A / lambda^2 (Balanis, Antenna Theory: Analysis and
  // Design, 4th ed., ch. 2, D0 = 4 pi Ae / lambda^2 with Ae = eta A; cited from memory, the page
  // was not checked). Issue #54 example: 0.5 m x 0.3 m, 11.7 GHz, eta 0.6.
  // Hand calculation: lambda = 299792458 / 11.7e9 = 0.0256233 m; lambda^2 = 6.56555e-4 m^2;
  // 4 pi * 0.15 * 0.6 = 1.130973; ratio = 1722.5; 10 log10 = 32.36 dBi.
  // (The issue text's "~33.6" does not match the relation; 32.36 is the arithmetic result.)
  // Tolerance 0.01 dB covers rounding of the hand arithmetic.
  it('matches the aperture relation for the issue example', () => {
    const p = PhasedArrayAntenna.fromAperture({
      widthMeters: 0.5, heightMeters: 0.3, frequency: 11.7e9, efficiency: 0.6,
    });

    expect(Math.abs(p.gain - 32.36)).toBeLessThan(0.01);
    expect(p.efficiency).toBe(0.6);
  });

  // Dish-equivalent: a square aperture of area pi D^2 / 4 equals a circular D = 1 m dish. Closed
  // form: G = eta (pi D / lambda)^2; D = 1 m, f = 12 GHz (lambda = 0.0249827 m), eta 0.55 gives
  // 0.55 * (125.745)^2 = 8696.6 -> 39.39 dBi. Tolerance 0.01 dB (hand rounding).
  it('equals the circular-dish gain for equal area', () => {
    const side = Math.sqrt(Math.PI / 4);
    const p = PhasedArrayAntenna.fromAperture({
      widthMeters: side, heightMeters: side, frequency: 12e9, efficiency: 0.55,
    });

    expect(Math.abs(p.gain - 39.39)).toBeLessThan(0.01);
    expect(p.gain).toBeCloseTo(Antenna.fromDishDiameter(1, 12e9, 0.55).gain, 2);
  });

  it('defaults efficiency to 0.55 and rejects bad inputs', () => {
    const p = PhasedArrayAntenna.fromAperture({ widthMeters: 1, heightMeters: 1, frequency: 10e9 });

    expect(p.efficiency).toBe(0.55);
    expect(() => PhasedArrayAntenna.fromAperture({ widthMeters: 0, heightMeters: 1, frequency: 1e9 })).toThrow();
    expect(() => PhasedArrayAntenna.fromAperture({ widthMeters: 1, heightMeters: 1, frequency: 0 })).toThrow();
    expect(() => PhasedArrayAntenna.fromAperture({
      widthMeters: 1, heightMeters: 1, frequency: 1e9, efficiency: 1.2,
    })).toThrow();
  });
});

describe('PhasedArrayAntenna construction', () => {
  it('uses documented defaults', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30) });

    expect(p.normalEl).toBe(90);
    expect(p.normalAz).toBe(0);
    expect(p.maxScanAngle).toBe(60);
    expect(p.scanLossExponent).toBe(1.3);
    expect(p.sidelobeFloor).toBe(-10);
    expect(p.pointingError).toBe(0);
    expect(p).toBeInstanceOf(Antenna);
  });

  it.each([0, 90, -5, 120, NaN])('rejects maxScanAngle %f', (m) => {
    expect(() => new PhasedArrayAntenna({ gain: dB(30), maxScanAngle: m })).toThrow();
  });
  it('rejects bad exponent and pointing error', () => {
    expect(() => new PhasedArrayAntenna({ gain: dB(30), scanLossExponent: 0 })).toThrow();
    expect(() => new PhasedArrayAntenna({ gain: dB(30), pointingError: -1 })).toThrow();
  });
});

describe('scan loss', () => {
  // n = 1 is the projected-aperture result: effective area A cos(theta), so
  // loss = 10 log10(cos theta). cos30 = 0.866025 -> -0.6247 dB; cos45 = 0.707107 -> -1.5051 dB;
  // cos60 = 0.5 -> -3.0103 dB (exact logs). Tolerance 0.001 dB is rounding of the quoted values.
  it.each([[30, -0.625], [45, -1.505], [60, -3.010]])('n = 1 loses %d deg -> %f dB', (theta, loss) => {
    const p = new PhasedArrayAntenna({ gain: dB(30), scanLossExponent: 1, maxScanAngle: 75 });

    expect(Math.abs(p.getOffAxisLoss(theta) - loss)).toBeLessThan(0.001);
    expect(Math.abs(p.getEffectiveGain(theta) - (30 + loss))).toBeLessThan(0.001);
  });

  // n = 1.5: 15 log10(cos theta) = 1.5 * (-0.62469, -1.50515, -3.01030) = -0.937, -2.258, -4.515 dB.
  // Tolerance 0.001 dB (rounding of the hand values).
  it.each([[30, -0.937], [45, -2.258], [60, -4.515]])('n = 1.5 loses %d deg -> %f dB', (theta, loss) => {
    const p = new PhasedArrayAntenna({ gain: dB(30), scanLossExponent: 1.5, maxScanAngle: 75 });

    expect(Math.abs(p.getOffAxisLoss(theta) - loss)).toBeLessThan(0.001);
  });

  it('has zero loss at broadside and is symmetric', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30) });

    expect(p.getOffAxisLoss(0)).toBeCloseTo(0, 12);
    expect(p.getOffAxisLoss(-40)).toBeCloseTo(p.getOffAxisLoss(40), 12);
  });

  it('pointing error adds to the scan angle inside the loss term only', () => {
    const base = new PhasedArrayAntenna({ gain: dB(30), scanLossExponent: 1, maxScanAngle: 75 });
    const err = new PhasedArrayAntenna({ gain: dB(30), scanLossExponent: 1, maxScanAngle: 75, pointingError: 5 });

    // 10 log10(cos 35) = -0.8672 dB
    expect(Math.abs(err.getOffAxisLoss(30) - 10 * Math.log10(Math.cos(35 * DEG)))).toBeLessThan(1e-9);
    expect(err.getOffAxisLoss(30)).toBeLessThan(base.getOffAxisLoss(30));
    // pure pointing error at broadside: 10 log10(cos 5) = -0.0166 dB
    expect(Math.abs(err.getOffAxisLoss(0) - 10 * Math.log10(Math.cos(5 * DEG)))).toBeLessThan(1e-9);
    // the geometric scan limit is not shifted
    expect(err.getOffAxisLoss(75.5)).toBe(-10 - 30);
  });
});

describe('scan geometry', () => {
  it('zenith panel and target at el = 30 gives theta = 60', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30) });

    expect(p.scanAngleTo(d(123), d(30))).toBeCloseTo(60, 10);
    expect(p.scanAngleTo(d(0), d(90))).toBeCloseTo(0, 10);
    expect(p.scanAngleTo(d(0), d(0))).toBeCloseTo(90, 10);
  });

  it('tilted panel looking at its own normal has theta = 0', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30), normalAz: d(180), normalEl: d(45) });

    expect(p.scanAngleTo(d(180), d(45))).toBeCloseTo(0, 6);
    expect(p.getGainToward(d(180), d(45))).toBeCloseTo(30, 9);
    // tilted 45 deg from zenith toward south: zenith is 45 deg off the normal
    expect(p.scanAngleTo(d(0), d(90))).toBeCloseTo(45, 10);
  });

  it('treats azimuth 359 and -1 and 0 as neighbours (wraparound)', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30), normalAz: d(0), normalEl: d(45) });

    expect(p.scanAngleTo(d(359), d(45))).toBeCloseTo(p.scanAngleTo(d(1), d(45)), 10);
    expect(p.scanAngleTo(d(-1), d(45))).toBeCloseTo(p.scanAngleTo(d(359), d(45)), 10);
    expect(p.scanAngleTo(d(360), d(45))).toBeCloseTo(p.scanAngleTo(d(0), d(45)), 10);
  });

  it('returns the sidelobe floor behind the panel', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30), sidelobeFloor: dB(-7) });

    expect(p.scanAngleTo(d(0), d(-90))).toBeCloseTo(180, 10);
    expect(p.getGainToward(d(0), d(-90))).toBe(-7);
    expect(p.isWithinScan(d(0), d(-90))).toBe(false);
  });

  it('clamps rounding overshoot of the dot product', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30), normalAz: d(33.3), normalEl: d(61.7) });

    expect(Number.isNaN(p.scanAngleTo(d(33.3), d(61.7)))).toBe(false);
  });

  it('maxScanAngle boundary: just inside vs just outside', () => {
    const p = new PhasedArrayAntenna({ gain: dB(30), maxScanAngle: 60, scanLossExponent: 1 });
    // zenith panel: theta = 90 - el
    const inside = d(30.01); // theta 59.99
    const outside = d(29.99); // theta 60.01

    expect(p.isWithinScan(d(0), inside)).toBe(true);
    expect(p.isWithinScan(d(0), outside)).toBe(false);
    expect(Math.abs(p.getGainToward(d(0), inside) - (30 - 3.01))).toBeLessThan(0.01);
    expect(p.getGainToward(d(0), outside)).toBe(-10);
  });
});

describe('serialization', () => {
  const make = () => new PhasedArrayAntenna({
    gain: dB(31.5), beamwidth: 4, efficiency: 0.6, normalAz: d(200), normalEl: d(70),
    maxScanAngle: 55, scanLossExponent: 1.7, sidelobeFloor: dB(-12), pointingError: 0.5,
  });

  it('serialize carries a phased-array discriminator and round-trips', () => {
    const p = make();
    const s = p.serialize();

    expect(s.type).toBe('phased-array');
    expect(PhasedArrayAntenna.deserialize(s).serialize()).toEqual(s);
    expect(deserializeAntenna(s)).toBeInstanceOf(PhasedArrayAntenna);
    expect(deserializeAntenna(JSON.parse(JSON.stringify(s)))).toEqual(p);
  });

  it('clone is an independent equal copy', () => {
    const p = make();
    const c = p.clone();

    expect(c).not.toBe(p);
    expect(c).toBeInstanceOf(PhasedArrayAntenna);
    expect(c.serialize()).toEqual(p.serialize());
    expect(c.getGainToward(d(10), d(50))).toBe(p.getGainToward(d(10), d(50)));
  });

  it('plain Antenna deserialization is unchanged', () => {
    const a = new Antenna({ gain: dB(20), beamwidth: 5, efficiency: 0.5 });
    const s = a.serialize();

    expect(s).toEqual({ gain: 20, beamwidth: 5, efficiency: 0.5 });
    expect('type' in s).toBe(false);
    const back = deserializeAntenna(s);

    expect(back).toBeInstanceOf(Antenna);
    expect(back).not.toBeInstanceOf(PhasedArrayAntenna);
    expect(Antenna.deserialize(s).serialize()).toEqual(s);
  });

  it('toString mentions the key parameters', () => {
    const str = make().toString();

    expect(str).toContain('PhasedArrayAntenna');
    expect(str).toContain('55.0');
  });

  it('round-trips through Receiver and Transmitter serialization', () => {
    const rx = new Receiver({
      id: 1, name: 'rx', frequency: 11.7e9 as Hertz, bandwidth: 36e6 as Hertz,
      noiseFigure: dB(1.5), minimumSnr: dB(3), antenna: make(),
    });
    const tx = new Transmitter({
      id: 2, name: 'tx', frequency: 11.7e9 as Hertz, power: 10 as Watts, bandwidth: 36e6 as Hertz,
      antenna: make(),
    });
    const rx2 = Receiver.deserialize(JSON.parse(JSON.stringify(rx.serialize())));
    const tx2 = Transmitter.deserialize(JSON.parse(JSON.stringify(tx.serialize())));

    expect(rx2.antenna).toBeInstanceOf(PhasedArrayAntenna);
    expect(tx2.antenna).toBeInstanceOf(PhasedArrayAntenna);
    expect((rx2.antenna as PhasedArrayAntenna).serialize()).toEqual(make().serialize());
    expect((tx2.antenna as PhasedArrayAntenna).maxScanAngle).toBe(55);
  });
});

describe('link budget integration', () => {
  const geoEcef = (latDeg: number, lonDeg: number, altKm: number) =>
    llaRad2ecef({ lat: latDeg * DEG, lon: lonDeg * DEG, alt: altKm } as never);

  const run = (satEcef: { x: number; y: number; z: number }, panel: Antenna) => {
    const ground = new GroundStation({ lat: d(0), lon: d(0), alt: 0 as Kilometers });
    const gp = ground.toJ2000(DATE).position;
    const sat = {
      id: 99, name: 'sat',
      toJ2000: () => ({ position: { x: gp.x + 1000, y: gp.y, z: gp.z } }),
      ecef: () => satEcef,
    } as never;
    const tx = new Transmitter({
      id: 1, name: 'tx', frequency: 11.7e9 as Hertz, power: 10 as Watts, bandwidth: 36e6 as Hertz,
      antenna: new Antenna({ gain: dB(20) }),
    });
    const rx = new Receiver({
      id: 2, name: 'rx', frequency: 11.7e9 as Hertz, bandwidth: 36e6 as Hertz,
      noiseFigure: dB(1.5), minimumSnr: dB(3), antenna: panel,
    });

    tx.setParent(sat);
    rx.setParent(ground);
    let geometry: LinkGeometry | undefined;
    const budget = tx.calculateLinkBudget(rx, DATE, {
      lossModels: [
        (g) => {
          geometry = g;

          return [];
        },
      ],
    });

    return { budget, geometry: geometry as LinkGeometry };
  };

  it('rxAntennaGain equals the panel gain at the budget look angle', () => {
    const panel = new PhasedArrayAntenna({ gain: dB(33), maxScanAngle: 60, scanLossExponent: 1 });
    // satellite 0.5 deg of longitude away at 550 km altitude: high elevation, inside scan
    const { budget, geometry } = run(geoEcef(0, 0.5, 550), panel);
    const rxEnd = geometry.rx as NonNullable<LinkGeometry['rx']>;

    expect(rxEnd.lookEl).toBeGreaterThan(30);
    expect(rxEnd.lookEl).toBeLessThan(89);
    expect(budget.rxAntennaGain).toBe(panel.getGainToward(rxEnd.lookAz, rxEnd.lookEl));
    // zenith panel: theta = 90 - el, n = 1 -> loss = 10 log10(sin el)
    expect(budget.rxAntennaGain as number).toBeCloseTo(33 + 10 * Math.log10(Math.sin(rxEnd.lookEl * DEG)), 9);
    expect(budget.rxAntennaGain as number).toBeLessThan(33);
  });

  it('a low-elevation satellite outside the scan limit gets the sidelobe floor', () => {
    const panel = new PhasedArrayAntenna({ gain: dB(33), maxScanAngle: 60 });
    const { budget, geometry } = run(geoEcef(0, 15, 550), panel);
    const rxEnd = geometry.rx as NonNullable<LinkGeometry['rx']>;

    expect(rxEnd.lookEl).toBeLessThan(30);
    expect(budget.rxAntennaGain).toBe(-10);
  });

  it('a plain Antenna in the same position still gets peak gain', () => {
    const { budget } = run(geoEcef(0, 15, 550), new Antenna({ gain: dB(33) }));

    expect(budget.rxAntennaGain).toBe(33);
  });
});
