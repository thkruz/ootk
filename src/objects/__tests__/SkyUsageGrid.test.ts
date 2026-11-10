import { SkyUsageGrid, ValidationError } from '../../main';

describe('SkyUsageGrid', () => {
  it('validates bins', () => {
    expect(() => new SkyUsageGrid({ azBinDeg: 7, elBinDeg: 5 })).toThrow(ValidationError);
    expect(() => new SkyUsageGrid({ azBinDeg: 5, elBinDeg: 40 })).toThrow(ValidationError);
    expect(() => new SkyUsageGrid({ azBinDeg: 0, elBinDeg: 5 })).toThrow(ValidationError);
    expect(() => new SkyUsageGrid({ azBinDeg: 5, elBinDeg: -5 })).toThrow(ValidationError);
    expect(() => new SkyUsageGrid({ azBinDeg: 720, elBinDeg: 5 })).toThrow(ValidationError);
    const g = new SkyUsageGrid({ azBinDeg: 5, elBinDeg: 5 });

    expect(g.azBins).toBe(72);
    expect(g.elBins).toBe(18);
  });

  it('assigns bins at the edges', () => {
    const g = new SkyUsageGrid({ azBinDeg: 5, elBinDeg: 5 });

    g.add(0, 0, true, 1);
    expect(g.cellSeconds(0, 0).served).toBe(1);
    g.add(359.999, 10, true, 2);
    expect(g.cellSeconds(71, 2).served).toBe(2);
    g.add(360, 10, true, 4); // wraps to az 0
    expect(g.cellSeconds(0, 2).served).toBe(4);
    g.add(-0.001, 10, true, 8); // negative wraps to 359.999
    expect(g.cellSeconds(71, 2).served).toBe(10);
    g.add(5, 5, false, 16); // exactly on both boundaries goes to the upper bin
    expect(g.cellSeconds(1, 1).blocked).toBe(16);
    g.add(4.999999, 4.999999, false, 32);
    expect(g.cellSeconds(0, 0).blocked).toBe(32);
    g.add(10, 90, false, 64); // zenith belongs to the top row
    expect(g.cellSeconds(2, 17).blocked).toBe(64);
  });

  it('ignores el < 0 and rejects bad input', () => {
    const g = new SkyUsageGrid({ azBinDeg: 10, elBinDeg: 10 });

    expect(g.add(10, -0.1, true, 5)).toBe(false);
    expect(g.servedSeconds).toBe(0);
    expect(() => g.add(10, 90.1, true, 1)).toThrow(ValidationError);
    expect(() => g.add(NaN, 10, true, 1)).toThrow(ValidationError);
    expect(() => g.add(10, 10, true, -1)).toThrow(ValidationError);
    expect(() => g.cellSeconds(36, 0)).toThrow(ValidationError);
  });

  it('conserves total time and reports fractions', () => {
    const g = new SkyUsageGrid({ azBinDeg: 15, elBinDeg: 10 });
    let total = 0;
    let blocked = 0;

    for (let i = 0; i < 1000; i++) {
      const dur = 0.5 + (i % 7) * 0.25;
      const isBlocked = i % 3 === 0;

      g.add(((i * 37.3) % 400) - 20, (i * 11.7) % 90, !isBlocked, dur);
      total += dur;
      blocked += isBlocked ? dur : 0;
    }
    const sum = g.cells(true).reduce((s, c) => s + c.servedSeconds + c.blockedSeconds, 0);

    expect(sum).toBeCloseTo(total, 9);
    expect(g.servedSeconds + g.blockedSeconds).toBeCloseTo(total, 9);
    expect(g.blockedFraction()).toBeCloseTo(blocked / total, 12);
  });

  it('cell fractions and flat export bounds', () => {
    const g = new SkyUsageGrid({ azBinDeg: 90, elBinDeg: 30 });

    g.add(100, 40, true, 3);
    g.add(100, 40, false, 1);
    expect(g.cellBlockedFraction(1, 1)).toBeCloseTo(0.25, 12);
    expect(g.cellBlockedFraction(0, 0)).toBe(0);
    expect(g.blockedFraction()).toBeCloseTo(0.25, 12);
    expect(g.cells()).toEqual([{ azIdx: 1, elIdx: 1, azMin: 90, azMax: 180, elMin: 30, elMax: 60, servedSeconds: 3, blockedSeconds: 1 }]);
    expect(g.cells(true)).toHaveLength(12);
  });

  it('reset and serialization round-trip', () => {
    const g = new SkyUsageGrid({ azBinDeg: 30, elBinDeg: 15 });

    g.add(45, 20, true, 2);
    g.add(300, 70, false, 5);
    const h = SkyUsageGrid.deserialize(JSON.parse(JSON.stringify(g.serialize())));

    expect(h.cells()).toEqual(g.cells());
    expect(h.blockedFraction()).toBe(g.blockedFraction());
    g.reset();
    expect(g.servedSeconds + g.blockedSeconds).toBe(0);
    expect(g.blockedFraction()).toBe(0);
    expect(() => SkyUsageGrid.deserialize({ azBinDeg: 30, elBinDeg: 15, servedSeconds: [1], blockedSeconds: [1] })).toThrow(
      ValidationError,
    );
  });
});
