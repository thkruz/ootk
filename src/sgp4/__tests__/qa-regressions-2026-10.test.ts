/**
 * QA 2026-10-13 regression tests: SGP4 core and the SGP4 wasm backend.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.3.
 * Permanent regression tests for the v8 fixes. Moved from test/qa/sgp4-propagator-force.qa.test.ts.
 */
import { Sgp4, Sgp4ErrorCode, Tle } from '@src/main';
import { Sgp4Wasm } from '@src/external/Sgp4Wasm';
import { Sgp4WasmPropagator } from '@src/propagator/Sgp4WasmPropagator';
import type { Sgp4WasmBackendLike, WasmTaggedSatrec } from '@src/sgp4/sgp4-wasm-backend';
import type { TleLine1, TleLine2 } from '@src/types/types';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ISS_LINE1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;
const ISS_LINE2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2;

describe('Sgp4 core (QA 2026-10 regressions)', () => {
  /*
   * Report 2.3, sgp4.ts:1225-1227. Eccentricity out of range after drag sets error 2 (MEAN_MOTION_NEGATIVE);
   * Vallado sets error 1. Near-earth TLE with bstar 9.9999 and e = 0.1 hits this branch at t = 174 min.
   * Expected: error 1 (MEAN_ELEMENTS_INVALID). Actual: 2.
   */
  it('out-of-range eccentricity after drag reports MEAN_ELEMENTS_INVALID (1)', () => {
    const satrec = Sgp4.createSatrec(
      '1 25544U 98067A   24001.00000000  .00000000  00000-0  99999+0 0  9990',
      '2 25544  51.6400 100.0000 1000000 100.0000 260.0000 14.00000000000000',
    );

    expect(satrec.error).toBe(Sgp4ErrorCode.NO_ERROR);
    let t = 1;

    for (; t < 2000; t++) {
      Sgp4.propagate(satrec, t);
      if (satrec.error !== Sgp4ErrorCode.NO_ERROR) {
        break;
      }
    }

    expect(t).toBeLessThan(2000);
    expect(satrec.error).toBe(Sgp4ErrorCode.MEAN_ELEMENTS_INVALID);
  });

  /*
   * Report 2.3, sgp4.ts:2953. `dspace_` destructures atime/xli/xni from satrec but never writes them back,
   * so every call re-integrates the resonance terms from epoch. Vallado stores them on the satrec.
   * Expected: satrec.atime is nonzero after propagating a GEO (resonant) satrec 1440 min. Actual: 0.
   */
  it('deep-space resonance integrator state (atime) is cached on the satrec between calls', () => {
    const satrec = Sgp4.createSatrec(
      '1 28626U 05008A   06176.46683397 -.00000205  00000-0  10000-3 0  2190',
      '2 28626   0.0019 286.9433 0000335  13.7918  55.6504  1.00270176  4891',
    );

    expect(satrec.irez).toBeGreaterThan(0);
    Sgp4.propagate(satrec, 1440);
    expect(Math.abs(satrec.atime)).toBeGreaterThan(0);
  });

  /*
   * Report 2.3, sgp4.ts:386-416. `createSatrec` leaves ndot in TLE units (rev/day^2 / 2) because the
   * conversion is commented out; Vallado and python-sgp4 store rad/min^2.
   * Expected: ndot = 0.00016717 / (xpdotp * 1440) = 5.065e-10. Actual: 0.00016717.
   */
  it('createSatrec stores ndot in rad/min^2 like the reference', () => {
    const satrec = Sgp4.createSatrec(ISS_LINE1, ISS_LINE2);
    const xpdotp = 1440 / (2 * Math.PI);

    expect(satrec.ndot).toBeCloseTo(0.00016717 / (xpdotp * 1440), 15);
  });
});

describe('Sgp4 wasm backend (QA 2026-10 regressions)', () => {
  const makeStub = (keyBase: bigint, err = 0): Sgp4WasmBackendLike & { added: bigint[] } => {
    const added: bigint[] = [];
    let next = keyBase;

    return {
      added,
      isLoaded: true,
      addSat: () => {
        const k = next++;

        added.push(k);

        return k;
      },
      initSats: () => {
        // no-op
      },
      propagateOnePosVelFast: (key: bigint) => ({
        err: added.includes(key) ? err : 1,
        position: { x: 7000, y: 0, z: 0 },
        velocity: { x: 0, y: 7.5, z: 0 },
      }),
    };
  };

  afterEach(() => {
    Sgp4.clearWasmBackend();
  });

  /*
   * Report 2.3, sgp4-wasm-backend.ts:236-252. When the wasm call reports an error the backend returns
   * {position:false} but never sets satrec.error. Expected: satrec.error != 0. Actual: 0 (NO_ERROR).
   */
  it('a wasm propagation failure sets satrec.error', () => {
    Sgp4.useWasmBackend(makeStub(100n, 6));
    const satrec = Sgp4.createSatrec(ISS_LINE1, ISS_LINE2);
    const pv = Sgp4.propagate(satrec, 60);

    expect(pv.position).toBe(false);
    expect(satrec.error).not.toBe(Sgp4ErrorCode.NO_ERROR);
  });

  /*
   * Report 2.3, sgp4-wasm-backend.ts:150-157. `clearSgp4WasmBackend()` clears the key cache, but a satrec
   * keeps its stale wasmSatKey, so under a new backend it propagates with a key that backend never issued.
   * Expected: the satrec re-attaches (addSat called on the new backend) and propagates. Actual: no re-attach,
   * position false.
   */
  it('a satrec re-attaches to a new wasm backend after clear', () => {
    Sgp4.useWasmBackend(makeStub(100n));
    const satrec = Sgp4.createSatrec(ISS_LINE1, ISS_LINE2) as WasmTaggedSatrec;

    Sgp4.propagate(satrec, 60);
    expect(satrec.wasmSatKey).toBe(100n);

    Sgp4.clearWasmBackend();
    const second = makeStub(500n);

    Sgp4.useWasmBackend(second);
    const pv = Sgp4.propagate(satrec, 60);

    expect(second.added.length).toBe(1);
    expect(pv.position).not.toBe(false);
  });

  // Path re-rooted for the move from test/qa to src/sgp4/__tests__; both resolve to src/external.
  const artifacts = ['Sgp4Prop.js', 'Sgp4Prop.wasm']
    .every((f) => existsSync(path.resolve(__dirname, '../../external', f)));
  const itWasm = artifacts ? it : it.skip;

  /*
   * Report 2.3, sgp4-wasm-backend.ts / Sgp4WasmPropagator.ts:52. The propagator and the global backend share
   * one wasm registry; once the backend has attached a TLE, constructing an Sgp4WasmPropagator for the same
   * TLE on that instance throws on the duplicate addSat. Expected: no throw.
   */
  itWasm('Sgp4WasmPropagator can be built for a TLE the global wasm backend already attached', async () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const wasm = await new Sgp4Wasm().load();

    try {
      Sgp4.useWasmBackend(wasm);
      const satrec = Sgp4.createSatrec(ISS_LINE1, ISS_LINE2) as WasmTaggedSatrec;

      Sgp4.propagate(satrec, 60);
      expect(satrec.wasmSatKey !== undefined && satrec.wasmSatKey > 0n).toBe(true);

      let prop: Sgp4WasmPropagator | null = null;

      expect(() => {
        prop = new Sgp4WasmPropagator(wasm, tle);
      }).not.toThrow();
      (prop as Sgp4WasmPropagator | null)?.dispose();
    } finally {
      Sgp4.clearWasmBackend();
      wasm.dispose();
    }
  });
});
