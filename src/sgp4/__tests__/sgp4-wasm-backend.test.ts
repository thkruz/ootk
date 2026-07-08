import { Sgp4, Sgp4GravConstants } from '../sgp4';
import { Sgp4OpsMode } from '../../enums/Sgp4OpsMode';
import { Sgp4Wasm } from '../../external/Sgp4Wasm';
import { Sgp4WasmBackendLike, WasmTaggedSatrec } from '../sgp4-wasm-backend';
import { ISS_TLE_2020, ISS_TLE_2024, SGP4_ARTIFACTS_PRESENT } from '../../external/__tests__/wasmTestUtils';

const FAKE_POSITION = { x: 1000, y: 2000, z: 3000 };
const FAKE_VELOCITY = { x: 1, y: 2, z: 3 };

/** Real JSC Vimpel TLE: blank satnum field, 'V' classification. */
const VIMPEL_TLE = {
  line1: '1      V 12104    25007.20347222 +.00000000 +00000+0 +00000-0 0 49990',
  line2: '2       064.8350 009.7330 1627170 165.9900 359.1946 12.12185514 00010',
};

/** The same TLE after KeepTrack's Satellite constructor zeroes the SCC field. */
const VIMPEL_TLE_ZEROED = {
  line1: '1 00000V 12104    25007.20347222 +.00000000 +00000+0 +00000-0 0 49990',
  line2: '2 00000 064.8350 009.7330 1627170 165.9900 359.1946 12.12185514 00010',
};

interface StubBackend extends Sgp4WasmBackendLike {
  calls: { addSat: number; initSats: number; propagate: number };
}

const makeStubBackend = (overrides: Partial<Sgp4WasmBackendLike> = {}): StubBackend => {
  const calls = { addSat: 0, initSats: 0, propagate: 0 };
  let nextKey = 100n;

  return {
    calls,
    isLoaded: true,
    addSat: () => {
      calls.addSat++;

      return nextKey++;
    },
    initSats: () => {
      calls.initSats++;
    },
    propagateOnePosVelFast: () => {
      calls.propagate++;

      return { err: 0, position: FAKE_POSITION, velocity: FAKE_VELOCITY };
    },
    ...overrides,
  };
};

describe('Sgp4 wasm backend hook', () => {
  afterEach(() => {
    Sgp4.clearWasmBackend();
  });

  it('is inactive by default and rejects unloaded backends', () => {
    expect(Sgp4.isWasmBackendActive).toBe(false);
    expect(() => Sgp4.useWasmBackend(makeStubBackend({ isLoaded: false } as Partial<Sgp4WasmBackendLike>))).toThrow(/load\(\)/u);
  });

  it('routes propagate through the backend and attaches a satKey lazily', () => {
    const stub = makeStubBackend();

    Sgp4.useWasmBackend(stub);
    expect(Sgp4.isWasmBackendActive).toBe(true);

    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    // Key attaches on first propagate, not at creation
    expect(satrec.wasmSatKey).toBeUndefined();

    const pv = Sgp4.propagate(satrec, 60);

    expect(satrec.wasmSatKey).toBe(100n);
    expect(stub.calls.addSat).toBe(1);
    expect(stub.calls.initSats).toBe(1);
    expect(stub.calls.propagate).toBe(1);
    expect(pv.position).toEqual(FAKE_POSITION);
    expect(pv.velocity).toEqual(FAKE_VELOCITY);

    // Subsequent propagations reuse the key
    Sgp4.propagate(satrec, 120);
    expect(stub.calls.addSat).toBe(1);
    expect(stub.calls.propagate).toBe(2);
    expect(Sgp4.wasmBackendStats).toEqual({ attached: 1, fallback: 0 });
  });

  it('reuses cached satKeys for satrecs built from the same TLE', () => {
    const stub = makeStubBackend();

    Sgp4.useWasmBackend(stub);

    const satrecA = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;
    const satrecB = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    Sgp4.propagate(satrecA, 0);
    Sgp4.propagate(satrecB, 0);

    expect(satrecB.wasmSatKey).toBe(satrecA.wasmSatKey);
    expect(stub.calls.addSat).toBe(1);
  });

  it('falls back to TS when the backend rejects the TLE, without retrying', () => {
    const stub = makeStubBackend({
      addSat: () => {
        throw new Error('rejected');
      },
    });

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;
    const pv = Sgp4.propagate(satrec, 0);

    // Real TS propagation result, not the stub's canned values
    expect(pv.position).not.toEqual(FAKE_POSITION);
    expect(pv.position).not.toBe(false);
    expect(stub.calls.propagate).toBe(0);

    // Marked failed — no repeated add attempts
    Sgp4.propagate(satrec, 60);
    expect(satrec.wasmSatKey).toBe(-1n);
  });

  it('falls back to TS for satrecs without TLE lines (e.g. OMM)', () => {
    const stub = makeStubBackend();

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    delete satrec.wasmTleLine1;
    delete satrec.wasmTleLine2;

    const pv = Sgp4.propagate(satrec, 0);

    expect(pv.position).not.toEqual(FAKE_POSITION);
    expect(pv.position).not.toBe(false);
    expect(stub.calls.addSat).toBe(0);
  });

  it('returns false position/velocity when the backend reports a propagation error', () => {
    const stub = makeStubBackend({
      propagateOnePosVelFast: () => ({ err: 6, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }),
    });

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2);
    const pv = Sgp4.propagate(satrec, 0);

    expect(pv.position).toBe(false);
    expect(pv.velocity).toBe(false);
  });

  it('retries satnum-less TLEs (JSC Vimpel) with a synthetic satnum and U classification', () => {
    const attempts: string[][] = [];
    const stub = makeStubBackend({
      addSat: (line1: string, line2: string) => {
        attempts.push([line1, line2]);
        // Reject blank satnums like the Astro Standards TLE tree does
        if (line1.substring(2, 7).trim() === '') {
          throw new Error('rejected');
        }

        return 424242n;
      },
    });

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(VIMPEL_TLE.line1, VIMPEL_TLE.line2) as WasmTaggedSatrec;
    const pv = Sgp4.propagate(satrec, 60);

    expect(satrec.wasmSatKey).toBe(424242n);
    expect(pv.position).toEqual(FAKE_POSITION);
    expect(attempts).toHaveLength(2);

    const [retryLine1, retryLine2] = attempts[1];

    expect(retryLine1.substring(2, 7)).toBe('V0000');
    expect(retryLine1.charAt(7)).toBe('U');
    expect(retryLine2.substring(2, 7)).toBe('V0000');
    // Everything after the satnum/classification fields is untouched
    expect(retryLine1.slice(8)).toBe(VIMPEL_TLE.line1.slice(8));
    expect(retryLine2.slice(7)).toBe(VIMPEL_TLE.line2.slice(7));
  });

  it('retries zeroed-satnum Vimpel TLEs (KeepTrack-processed shape)', () => {
    const attempts: string[][] = [];
    const stub = makeStubBackend({
      addSat: (line1: string, line2: string) => {
        attempts.push([line1, line2]);
        // Reject zero satnums and non-standard classifications like the library does
        if (line1.substring(2, 7) === '00000' || line1.charAt(7) === 'V') {
          throw new Error('rejected');
        }

        return 777n;
      },
    });

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(VIMPEL_TLE_ZEROED.line1, VIMPEL_TLE_ZEROED.line2) as WasmTaggedSatrec;

    Sgp4.propagate(satrec, 60);

    expect(satrec.wasmSatKey).toBe(777n);
    expect(attempts).toHaveLength(2);
    expect(attempts[1][0].substring(2, 7)).toBe('V0000');
    expect(attempts[1][0].charAt(7)).toBe('U');
  });

  it('does not retry rejected TLEs that have a real satnum', () => {
    let addSatCalls = 0;
    const stub = makeStubBackend({
      addSat: () => {
        addSatCalls++;
        throw new Error('duplicate');
      },
    });

    Sgp4.useWasmBackend(stub);

    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2) as WasmTaggedSatrec;

    Sgp4.propagate(satrec, 0);
    expect(satrec.wasmSatKey).toBe(-1n);
    expect(addSatCalls).toBe(1);
    expect(Sgp4.wasmBackendStats).toEqual({ attached: 0, fallback: 1 });
  });

  it('restores TS behavior after clearWasmBackend', () => {
    const stub = makeStubBackend();

    Sgp4.useWasmBackend(stub);
    const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

    Sgp4.propagate(satrec, 0);
    expect(stub.calls.propagate).toBe(1);

    Sgp4.clearWasmBackend();
    expect(Sgp4.isWasmBackendActive).toBe(false);

    const pv = Sgp4.propagate(satrec, 0);

    expect(stub.calls.propagate).toBe(1);
    expect(pv.position).not.toEqual(FAKE_POSITION);
  });
});

const describeWithArtifacts = SGP4_ARTIFACTS_PRESENT ? describe : describe.skip;

describeWithArtifacts('Sgp4 wasm backend with real Sgp4Wasm', () => {
  let wasm: Sgp4Wasm;

  beforeAll(async () => {
    wasm = await new Sgp4Wasm().load();
  });

  afterAll(() => {
    Sgp4.clearWasmBackend();
    wasm.dispose();
  });

  it('matches the TS implementation through the Sgp4.propagate seam', () => {
    const satrecTs = Sgp4.createSatrec(ISS_TLE_2020.line1, ISS_TLE_2020.line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.AFSPC);
    const reference = Sgp4.propagate(satrecTs, 90);

    Sgp4.useWasmBackend(wasm);

    const satrecWasm = Sgp4.createSatrec(ISS_TLE_2020.line1, ISS_TLE_2020.line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.AFSPC) as WasmTaggedSatrec;
    const viaWasm = Sgp4.propagate(satrecWasm, 90);

    // Proof the wasm path actually ran
    expect(typeof satrecWasm.wasmSatKey).toBe('bigint');
    expect(satrecWasm.wasmSatKey! > 0n).toBe(true);

    if (!reference.position || !reference.velocity || !viaWasm.position || !viaWasm.velocity) {
      throw new Error('Propagation failed');
    }

    expect(Math.abs(viaWasm.position.x - reference.position.x)).toBeLessThan(0.1);
    expect(Math.abs(viaWasm.position.y - reference.position.y)).toBeLessThan(0.1);
    expect(Math.abs(viaWasm.position.z - reference.position.z)).toBeLessThan(0.1);
    expect(Math.abs(viaWasm.velocity.x - reference.velocity.x)).toBeLessThan(1e-4);
  });

  it('attaches satnum-less JSC Vimpel TLEs via the synthetic-satnum retry and matches TS', () => {
    const satrecTs = Sgp4.createSatrec(VIMPEL_TLE.line1, VIMPEL_TLE.line2);
    const reference = Sgp4.propagate(satrecTs, 60);

    Sgp4.useWasmBackend(wasm);

    const satrecWasm = Sgp4.createSatrec(VIMPEL_TLE.line1, VIMPEL_TLE.line2) as WasmTaggedSatrec;
    const viaWasm = Sgp4.propagate(satrecWasm, 60);

    expect(typeof satrecWasm.wasmSatKey).toBe('bigint');
    expect(satrecWasm.wasmSatKey! > 0n).toBe(true);

    if (!reference.position || !viaWasm.position) {
      throw new Error('Vimpel propagation failed');
    }

    expect(Math.abs(viaWasm.position.x - reference.position.x)).toBeLessThan(0.5);
    expect(Math.abs(viaWasm.position.y - reference.position.y)).toBeLessThan(0.5);
    expect(Math.abs(viaWasm.position.z - reference.position.z)).toBeLessThan(0.5);
  });
});
