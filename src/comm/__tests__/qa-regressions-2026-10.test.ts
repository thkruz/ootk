/**
 * QA 2026-10 regression tests: comm.
 * Moved from test/qa/comm-parsers-utils.qa.test.ts (deep dive slice 2.7: comm, parsers, utils).
 *
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Permanent regression tests for the v8 fixes of the defects cited in each
 * comment below. Do not loosen an assertion to make a test pass.
 */

import {
  Antenna,
  Beacon,
  Decibels,
  EpochUTC,
  Hertz,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Receiver,
  Transmitter,
  Transponder,
  Vector3D,
  Watts,
} from '@src/main';
import type { CommPlatform } from '@src/comm/CommTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal space platform with a fixed J2000 position (space-to-space link path). */
const fixedPlatform = (id: number, x: number, y: number, z: number): CommPlatform => {
  const epoch = EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000');
  const state = new J2000(
    epoch,
    new Vector3D(x as Kilometers, y as Kilometers, z as Kilometers),
    new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
  );

  return { id, name: `QA-${id}`, toJ2000: () => state } as unknown as CommPlatform;
};

const DATE = new Date('2025-01-01T00:00:00.000Z');

// ---------------------------------------------------------------------------
// comm (section 2.7)
// ---------------------------------------------------------------------------

describe('comm (QA 2026-10 regressions)', () => {
  const makeTx = (freq: number): Transmitter => {
    const tx = new Transmitter({
      id: 1,
      name: 'QA Tx',
      frequency: freq as Hertz,
      power: 100 as Watts,
      bandwidth: 1e6 as Hertz,
      antenna: new Antenna({ gain: 40 as Decibels }),
    });

    tx.setParent(fixedPlatform(1, 7000, 0, 0));

    return tx;
  };
  const makeRx = (freq: number): Receiver => {
    const rx = new Receiver({
      id: 2,
      name: 'QA Rx',
      frequency: freq as Hertz,
      bandwidth: 1e6 as Hertz,
      noiseFigure: 1 as Decibels,
      minimumSnr: 3 as Decibels,
      antenna: new Antenna({ gain: 40 as Decibels }),
    });

    rx.setParent(fixedPlatform(2, 7000, 100, 0));

    return rx;
  };

  /*
   * Report 2.7 (L). Receiver.ts canReceive never calls isFrequencyCompatible.
   * A 14 GHz transmitter 100 km from a 2 GHz / 1 MHz receiver must not close.
   * Expected false; actual true (SNR is huge at 100 km with 40 dB antennas).
   */
  it('Receiver.canReceive rejects a 14 GHz transmitter on a 2 GHz receiver', () => {
    const tx = makeTx(14e9);
    const rx = makeRx(2e9);

    // Sanity: the same geometry at matching frequency closes, so only frequency differs.
    expect(makeRx(14e9).canReceive(tx, DATE)).toBe(true);
    expect(rx.canReceive(tx, DATE)).toBe(false);
  });

  /*
   * Report 2.7 (L). Transponder.canRelay relies on Receiver.canReceive, which
   * ignores frequency. Uplink at 14 GHz into a 2 GHz transponder must not relay.
   * Expected false; actual true.
   */
  it('Transponder.canRelay rejects a 14 GHz uplink into a 2 GHz transponder', () => {
    const transponder = new Transponder({
      id: 3,
      name: 'QA Xpdr',
      uplinkFrequency: 2e9 as Hertz,
      downlinkFrequency: 12e9 as Hertz,
      power: 100 as Watts,
      bandwidth: 1e6 as Hertz,
      uplinkAntenna: new Antenna({ gain: 40 as Decibels }),
      downlinkAntenna: new Antenna({ gain: 40 as Decibels }),
    });

    transponder.setParent(fixedPlatform(3, 7000, 50, 0));
    const uplink = makeTx(14e9);
    const downlink = makeRx(12e9);

    expect(transponder.canRelay(uplink, downlink, DATE)).toBe(false);
  });

  const makeBeacon = (): Beacon => new Beacon({
    id: 4,
    name: 'QA Beacon',
    frequency: 437e6 as Hertz,
    power: 1 as Watts,
    bandwidth: 25e3 as Hertz,
    antenna: new Antenna({ gain: 0 as Decibels }),
    transmitInterval: 60,
    transmitDuration: 10,
    epoch: new Date('2025-01-01T00:00:00.000Z'),
  });

  /*
   * Report 2.7 (C). Beacon.ts:170-215 getNextTransmission returns the in-progress
   * window when called inside one. Interval 60 s, duration 10 s, epoch T0; asking
   * at T0+5 s should return the window AFTER that time, starting at T0+60 s.
   * Actual start T0+0 s.
   */
  it('getNextTransmission inside a window returns the next window', () => {
    const t0 = Date.UTC(2025, 0, 1);
    const next = makeBeacon().getNextTransmission(new Date(t0 + 5000));

    expect(next.start.getTime()).toBe(t0 + 60000);
  });

  /*
   * Report 2.7 (C). Beacon.ts getTransmissionCount = floor(span / interval) + 1,
   * ignoring epoch phase. The range T0+20 s to T0+50 s contains no transmission
   * (windows are [0,10) and [60,70)). Expected 0; actual 1.
   */
  it('getTransmissionCount is 0 for a range with no transmission', () => {
    const t0 = Date.UTC(2025, 0, 1);

    expect(makeBeacon().getTransmissionCount(new Date(t0 + 20000), new Date(t0 + 50000))).toBe(0);
  });
});
