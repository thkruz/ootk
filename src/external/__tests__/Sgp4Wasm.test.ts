import { Sgp4, Sgp4GravConstants } from '../../sgp4/sgp4';
import { Sgp4OpsMode } from '../../enums/Sgp4OpsMode';
import { EpochUTC } from '../../time/EpochUTC';
import { Sgp4Wasm } from '../Sgp4Wasm';
import { Sgp4WasmBase } from '../Sgp4WasmBase';
import { Sgp4WasmError, Sgp4WasmLogLevel } from '../Sgp4WasmTypes';
import { ISS_TLE_2020, ISS_TLE_2022, ISS_TLE_2024, SGP4_ARTIFACTS_PRESENT } from './wasmTestUtils';

describe('Sgp4Wasm without artifacts', () => {
  it('should throw a descriptive error before load()', () => {
    const sgp4 = new Sgp4Wasm();

    expect(sgp4.isLoaded).toBe(false);
    expect(() => sgp4.module).toThrow(/load\(\)/u);
    expect(() => sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2)).toThrow(Sgp4WasmError);
  });

  it('should reject load() with guidance when the glue artifact is missing', async () => {
    const sgp4 = new Sgp4Wasm();

    await expect(sgp4.load({ glue: './definitely/not/a/real/Sgp4Prop.js' }))
      .rejects.toThrow(/space-track/u);
  });
});

const describeWithArtifacts = SGP4_ARTIFACTS_PRESENT ? describe : describe.skip;

describeWithArtifacts('Sgp4Wasm', () => {
  let sgp4: Sgp4Wasm;

  beforeAll(async () => {
    sgp4 = await new Sgp4Wasm().load();
    sgp4.setLogLevel(Sgp4WasmLogLevel.None);
  });

  afterAll(() => {
    sgp4.dispose();
  });

  describe('lifecycle', () => {
    it('should be loaded with module and fs escape hatches', () => {
      expect(sgp4.isLoaded).toBe(true);
      expect(typeof sgp4.module._malloc).toBe('function');
      expect(typeof sgp4.fs.writeFile).toBe('function');
    });

    it('should return the same runtime for repeat load() calls', async () => {
      const moduleBefore = sgp4.module;
      const again = await sgp4.load();

      expect(again).toBe(sgp4);
      expect(sgp4.module).toBe(moduleBefore);
    });
  });

  describe('TLE tree and propagation', () => {
    it('should add a TLE and return a bigint satKey', () => {
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      expect(typeof satKey).toBe('bigint');
      expect(satKey > 0n).toBe(true);

      sgp4.removeSats([satKey]);
    });

    it('should match the pure-TypeScript Sgp4 propagator in TEME', () => {
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      sgp4.initSats([satKey]);

      const satrec = Sgp4.createSatrec(ISS_TLE_2024.line1, ISS_TLE_2024.line2, Sgp4GravConstants.wgs72, Sgp4OpsMode.AFSPC);

      for (const tsince of [-720, 0, 60, 720, 1440]) {
        const wasmState = sgp4.propagateOne(satKey, tsince);
        const tsState = Sgp4.propagate(satrec, tsince);

        expect(wasmState.err).toBe(0);

        if (!tsState.position || !tsState.velocity) {
          throw new Error(`TS Sgp4 failed at tsince=${tsince}`);
        }

        expect(Math.abs(wasmState.position.x - tsState.position.x)).toBeLessThan(0.1);
        expect(Math.abs(wasmState.position.y - tsState.position.y)).toBeLessThan(0.1);
        expect(Math.abs(wasmState.position.z - tsState.position.z)).toBeLessThan(0.1);
        expect(Math.abs(wasmState.velocity.x - tsState.velocity.x)).toBeLessThan(1e-4);
        expect(Math.abs(wasmState.velocity.y - tsState.velocity.y)).toBeLessThan(1e-4);
        expect(Math.abs(wasmState.velocity.z - tsState.velocity.z)).toBeLessThan(1e-4);

        expect(wasmState.llh.lat).toBeGreaterThanOrEqual(-90);
        expect(wasmState.llh.lat).toBeLessThanOrEqual(90);
        expect(wasmState.llh.lon).toBeGreaterThanOrEqual(-360);
        expect(wasmState.llh.lon).toBeLessThanOrEqual(360);
        expect(wasmState.llh.height).toBeGreaterThan(100);
      }

      sgp4.uninitSats([satKey]);
      sgp4.removeSats([satKey]);
    });

    it('should agree between mse and ds50UTC time systems', () => {
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      sgp4.initSats([satKey]);

      const epoch = EpochUTC.fromDateTime(ISS_TLE_2024.epochDate);
      const ds50 = Sgp4WasmBase.toDs50Utc(epoch);

      const fromMse = sgp4.propagate([satKey], 0, 1, 0)[0][0];
      const fromDs50 = sgp4.propagateDs50Utc([satKey], ds50, 1, 0)[0][0];

      expect(fromDs50.err).toBe(0);
      expect(Math.abs(fromMse.position.x - fromDs50.position.x)).toBeLessThan(1e-6);
      expect(Math.abs(fromMse.position.y - fromDs50.position.y)).toBeLessThan(1e-6);
      expect(Math.abs(fromMse.position.z - fromDs50.position.z)).toBeLessThan(1e-6);

      // propagateEpoch is the same call via EpochUTC
      const fromEpoch = sgp4.propagateEpoch(satKey, epoch);

      expect(fromEpoch.position.x).toBe(fromDs50.position.x);

      sgp4.uninitSats([satKey]);
      sgp4.removeSats([satKey]);
    });

    it('should match propagatePosVel from the fast scratch-buffer path', () => {
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      sgp4.initSats([satKey]);

      const reference = sgp4.propagatePosVel([satKey], 45, 1, 0)[0][0];
      const fast = sgp4.propagateOnePosVelFast(satKey, 45);

      expect(fast.err).toBe(0);
      expect(fast.position.x).toBe(reference.position.x);
      expect(fast.position.y).toBe(reference.position.y);
      expect(fast.position.z).toBe(reference.position.z);
      expect(fast.velocity.x).toBe(reference.velocity.x);

      // Scratch buffers are reused across calls without corrupting results
      const fastAgain = sgp4.propagateOnePosVelFast(satKey, 45);

      expect(fastAgain.position.x).toBe(fast.position.x);

      sgp4.uninitSats([satKey]);
      sgp4.removeSats([satKey]);
    });

    it('should return identical pos/vel from full and PosVel variants', () => {
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      sgp4.initSats([satKey]);

      const full = sgp4.propagate([satKey], 30, 1, 0)[0][0];
      const posVel = sgp4.propagatePosVel([satKey], 30, 1, 0)[0][0];

      expect(posVel.position.x).toBe(full.position.x);
      expect(posVel.position.y).toBe(full.position.y);
      expect(posVel.position.z).toBe(full.position.z);
      expect(posVel.velocity.x).toBe(full.velocity.x);

      sgp4.uninitSats([satKey]);
      sgp4.removeSats([satKey]);
    });

    it('should batch propagate 3 sats x 4 steps with correct record layout', () => {
      const tleText = [
        ISS_TLE_2024.line1, ISS_TLE_2024.line2,
        ISS_TLE_2020.line1, ISS_TLE_2020.line2,
        ISS_TLE_2022.line1, ISS_TLE_2022.line2,
      ].join('\n');
      const satKeys = sgp4.addSats(tleText);

      expect(satKeys).toHaveLength(3);
      satKeys.forEach((key) => expect(typeof key).toBe('bigint'));

      sgp4.initSats(satKeys);

      const results = sgp4.propagate(satKeys, 0, 4, 10);

      expect(results).toHaveLength(3);
      for (const satRecords of results) {
        expect(satRecords).toHaveLength(4);
        for (let step = 0; step < 4; step++) {
          expect(satRecords[step].err).toBe(0);
          // time echoes mse; guards against a wrong (7-wide) record layout
          expect(satRecords[step].time).toBeCloseTo(step * 10, 6);
        }
      }

      sgp4.uninitSats(satKeys);
      sgp4.removeSats(satKeys);
    });

    it('should load TLEs through the VFS and return the same satKeys', () => {
      const tleText = [
        ISS_TLE_2024.line1, ISS_TLE_2024.line2,
        ISS_TLE_2020.line1, ISS_TLE_2020.line2,
      ].join('\n');
      const direct = sgp4.addSats(tleText);

      sgp4.removeSats(direct);

      const viaVfs = sgp4.loadTlesVfs(tleText);

      expect(viaVfs).toHaveLength(direct.length);
      expect(viaVfs).toEqual(direct);

      sgp4.removeSats(viaVfs);
    });
  });

  describe('dynamic array path', () => {
    it('should manage the dynamic array and match satKey propagation', () => {
      sgp4.initDynArr(8);

      expect(() => sgp4.initDynArr(8)).toThrow(/already initialized/u);

      const index0 = sgp4.addSatToDynArr(ISS_TLE_2024.line1, ISS_TLE_2024.line2);
      const index1 = sgp4.addSatToDynArr(ISS_TLE_2020.line1, ISS_TLE_2020.line2);

      expect(index0).toBe(0);
      expect(index1).toBe(1);

      const dynResults = sgp4.propagateDynArrPosVel([index0], 30, 1, 0);

      // Reference via the satKey path
      const satKey = sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

      sgp4.initSats([satKey]);
      const keyResult = sgp4.propagatePosVel([satKey], 30, 1, 0)[0][0];

      expect(dynResults[0][0].err).toBe(0);
      expect(dynResults[0][0].position.x).toBeCloseTo(keyResult.position.x, 6);
      expect(dynResults[0][0].position.y).toBeCloseTo(keyResult.position.y, 6);
      expect(dynResults[0][0].position.z).toBeCloseTo(keyResult.position.z, 6);

      sgp4.reallocDynArr(16);
      expect(typeof sgp4.dynArrSize).toBe('number');

      sgp4.freeDynArr();
      sgp4.uninitSats([satKey]);
      sgp4.removeSats([satKey]);
    });

    it('should propagate the dyn array via ds50UTC variants', () => {
      sgp4.initDynArr(4);
      const index = sgp4.addSatToDynArr(ISS_TLE_2024.line1, ISS_TLE_2024.line2);
      const ds50 = Sgp4WasmBase.toDs50Utc(EpochUTC.fromDateTime(ISS_TLE_2024.epochDate));

      const withLlh = sgp4.propagateDs50UtcDynArr([index], ds50, 2, 5);
      const posVelOnly = sgp4.propagateDs50UtcDynArrPosVel([index], ds50, 2, 5);

      expect(withLlh[0]).toHaveLength(2);
      expect(posVelOnly[0]).toHaveLength(2);
      expect(withLlh[0][0].err).toBe(0);
      expect(withLlh[0][0].position.x).toBeCloseTo(posVelOnly[0][0].position.x, 6);
      expect(withLlh[0][0].llh.height).toBeGreaterThan(100);

      sgp4.freeDynArr();
    });
  });

  describe('error paths', () => {
    it('should throw when adding a garbage TLE', () => {
      expect(() => sgp4.addSat('garbage', 'lines')).toThrow(Sgp4WasmError);
    });

    it('should mark rejected entries with a 0n satKey in a batch add', () => {
      // A duplicate TLE in the same batch is rejected by the TLE tree
      const tleText = [
        ISS_TLE_2024.line1, ISS_TLE_2024.line2,
        ISS_TLE_2024.line1, ISS_TLE_2024.line2,
      ].join('\n');

      const satKeys = sgp4.addSats(tleText);

      expect(satKeys).toHaveLength(2);
      expect(satKeys[0] > 0n).toBe(true);
      expect(satKeys[1]).toBe(0n);

      // Adding the same TLE again via the single-sat path throws
      expect(() => sgp4.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2)).toThrow(Sgp4WasmError);

      sgp4.removeSats([satKeys[0]]);
    });

    it('should throw with the offending satKey when removing an unknown key', () => {
      expect(() => sgp4.removeSats([999n])).toThrow(/999/u);
    });

    it('should accept all log levels', () => {
      [Sgp4WasmLogLevel.Info, Sgp4WasmLogLevel.Warn, Sgp4WasmLogLevel.Error, Sgp4WasmLogLevel.None].forEach((level) => {
        expect(() => sgp4.setLogLevel(level)).not.toThrow();
      });
    });
  });
});
