/**
 * QA 2026-10 regression tests for the SGP4 port and its wasm backend (report section 2.3).
 * Independent references are cited per test; the SGP4 math itself is covered by the Vallado
 * verification set in test/sgp4.
 */
import { Sgp4, Sgp4ErrorCode } from '../index';
import {
  acquireWasmSatKey,
  releaseWasmSatKey,
  Sgp4WasmBackendLike,
  WasmTaggedSatrec,
} from '../sgp4-wasm-backend';
import { ISS_TLE_2024 } from '../../external/__tests__/wasmTestUtils';

/** xpdotp = 1440 / 2pi converts rev/day to rad/min (Vallado twoline2rv). */
const XPDOTP = 1440 / (2 * Math.PI);

describe('Sgp4.createSatrec ndot / nddot units (QA 2026-10, sgp4.ts:386-416)', () => {
  it('stores ndot in rad/min^2 for the Vallado 00005 catalogue case', () => {
    /*
     * Vallado SGP4-VER.TLE case 00005 (also in test/sgp4). TLE field ndot/2 = .00000023 rev/day^2.
     * python-sgp4 io.twoline2rv stores ndot = field / (xpdotp * 1440)
     * = 2.3e-7 * 2pi / 1440^2 = 6.96919666...e-13 rad/min^2.
     */
    const satrec = Sgp4.createSatrec(
      '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
      '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
    );

    expect(satrec.ndot).toBeCloseTo(6.969196665949579e-13, 24);
    expect(satrec.nddot).toBe(0);
  });

  it('stores nddot in rad/min^3 and round-trips both fields back to TLE units', () => {
    // nddot/6 field " 12345-5" = 1.2345e-6 rev/day^3; python-sgp4 stores field / (xpdotp * 1440^2).
    const satrec = Sgp4.createSatrec(
      '1 00005U 58002B   00179.78495062 -.00012345  12345-5  28098-4 0  4753',
      '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
    );

    expect(satrec.nddot).toBeCloseTo(1.2345e-6 / (XPDOTP * 1440 * 1440), 25);
    expect(satrec.ndot * XPDOTP * 1440).toBeCloseTo(-0.00012345, 15);
    expect(satrec.nddot * XPDOTP * 1440 * 1440).toBeCloseTo(1.2345e-6, 15);
  });
});

describe('Sgp4.createSatrec alpha-5 satnum decoding (Space-Track alpha-5 definition)', () => {
  /*
   * Space-Track alpha-5: the leading letter replaces the first two digits of a 6-digit catalog
   * number, skipping I and O: A=10 ... H=17, J=18 ... N=22, P=23 ... Z=33.
   * The 6-digit to alpha-5 ENCODER lives in src/coordinate/alpha5.ts (package D); this table
   * pins the decoder that sgp4init_ uses for satrec.satnum.
   */
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const satrecFor = (satnum: string): ReturnType<typeof Sgp4.createSatrec> => Sgp4.createSatrec(
    `1 ${satnum}U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002`,
    `2 ${satnum}  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010`,
  );

  it.each(letters.split('').map((letter, i) => [letter, 10 + i]))(
    'letter %s maps to leading digits %i',
    (letter, prefix) => {
      expect(satrecFor(`${letter}0000`).satnum).toBe(`${prefix}0000`);
      expect(satrecFor(`${letter}9999`).satnum).toBe(`${prefix}9999`);
    },
  );

  it.each([
    ['A0000', '100000'],
    ['E8493', '148493'],
    ['J2931', '182931'],
    ['P4018', '234018'],
    ['W1929', '301929'], // W = 30 (V=29, W=30, X=31, Y=32); 321929 would be Y1929
    ['Z9999', '339999'],
  ])('Space-Track example %s decodes to %s', (alpha5, sixDigit) => {
    expect(satrecFor(alpha5).satnum).toBe(sixDigit);
  });

  it('H9999 and J0000 are consecutive (I skipped); N9999 and P0000 are consecutive (O skipped)', () => {
    expect(Number(satrecFor('J0000').satnum) - Number(satrecFor('H9999').satnum)).toBe(1);
    expect(Number(satrecFor('P0000').satnum) - Number(satrecFor('N9999').satnum)).toBe(1);
  });
});

describe('Sgp4 deep-space resonance cache (QA 2026-10, sgp4.ts:2953)', () => {
  // 1-day resonant GEO from the Vallado verification set (catalogue 28626).
  const line1 = '1 28626U 05008A   06176.46683397 -.00000205  00000-0  10000-3 0  2190';
  const line2 = '2 28626   0.0019 286.9433 0000335  13.7918  55.6504  1.00270176  4891';

  it('caching atime/xli/xni does not change results: sequential calls equal fresh satrecs', () => {
    const sequential = Sgp4.createSatrec(line1, line2);

    // Forward, then backward across epoch (the restart branch in dspace_ must reset the cache).
    for (const t of [720, 1440, 2880, 4320, 1000, -720, -2000, 500]) {
      const pvSeq = Sgp4.propagate(sequential, t);
      const pvFresh = Sgp4.propagate(Sgp4.createSatrec(line1, line2), t);

      if (!pvSeq.position || !pvFresh.position) {
        throw new Error(`propagation failed at t = ${t}`);
      }
      expect(pvSeq.position.x).toBeCloseTo(pvFresh.position.x, 8);
      expect(pvSeq.position.y).toBeCloseTo(pvFresh.position.y, 8);
      expect(pvSeq.position.z).toBeCloseTo(pvFresh.position.z, 8);
    }
  });
});

describe('Sgp4 wasm backend registry and error reporting (QA 2026-10)', () => {
  const makeStub = (err = 0): Sgp4WasmBackendLike & { adds: number } => {
    let next = 1000n;
    const stub = {
      adds: 0,
      isLoaded: true,
      addSat: (): bigint => {
        stub.adds++;

        return next++;
      },
      initSats: (): void => {
        // no-op
      },
      propagateOnePosVelFast: () => ({
        err,
        position: { x: 7000, y: 0, z: 0 },
        velocity: { x: 0, y: 7.5, z: 0 },
      }),
    };

    return stub;
  };

  afterEach(() => {
    Sgp4.clearWasmBackend();
  });

  it('reference-counts explicit holders and removes only when the last one releases', () => {
    const stub = makeStub();
    const k1 = acquireWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2);
    const k2 = acquireWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2);

    expect(k2).toBe(k1);
    expect(stub.adds).toBe(1);
    expect(releaseWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2)).toBe(false);
    expect(releaseWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2)).toBe(true);
  });

  it('never removes a key the global backend attached, and shares it with explicit holders', () => {
    const stub = makeStub();

    Sgp4.useWasmBackend(stub);
    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    Sgp4.propagate(satrec, 60);
    const key = acquireWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2);

    expect(key).toBe(satrec.wasmSatKey);
    expect(stub.adds).toBe(1);
    expect(releaseWasmSatKey(stub, ISS_TLE_2024.line1, ISS_TLE_2024.line2)).toBe(false);
  });

  it('re-activating the same instance after clear reuses its registered TLEs (no duplicate add)', () => {
    const stub = makeStub();
    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    Sgp4.useWasmBackend(stub);
    Sgp4.propagate(satrec, 60);
    const firstKey = satrec.wasmSatKey;

    Sgp4.clearWasmBackend();
    Sgp4.useWasmBackend(stub);
    const pv = Sgp4.propagate(satrec, 60);

    expect(stub.adds).toBe(1);
    expect(satrec.wasmSatKey).toBe(firstKey);
    expect(pv.position).not.toBe(false);
  });

  it('resets satrec.error to NO_ERROR after a later successful wasm propagation', () => {
    const failing = makeStub(3);
    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    Sgp4.useWasmBackend(failing);
    Sgp4.propagate(satrec, 60);
    expect(satrec.error).toBe(Sgp4ErrorCode.WASM_PROPAGATION_FAILED);
    expect(satrec.wasmErrCode).toBe(3);

    Sgp4.clearWasmBackend();
    Sgp4.useWasmBackend(makeStub());
    Sgp4.propagate(satrec, 60);
    expect(satrec.error).toBe(Sgp4ErrorCode.NO_ERROR);
  });
});
