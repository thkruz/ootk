import { Tle } from '../../coordinate/Tle';
import { Sgp4Wasm } from '../../external/Sgp4Wasm';
import { Sgp4WasmError } from '../../external/Sgp4WasmTypes';
import { EpochUTC } from '../../time/EpochUTC';
import { ISS_TLE_2024, SGP4_ARTIFACTS_PRESENT } from '../../external/__tests__/wasmTestUtils';
import { Sgp4Propagator } from '../Sgp4Propagator';
import { Sgp4WasmPropagator } from '../Sgp4WasmPropagator';

describe('Sgp4WasmPropagator without a loaded instance', () => {
  it('should require a loaded Sgp4Wasm', () => {
    const tle = new Tle(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

    expect(() => new Sgp4WasmPropagator(new Sgp4Wasm(), tle)).toThrow(Sgp4WasmError);
  });
});

const describeWithArtifacts = SGP4_ARTIFACTS_PRESENT ? describe : describe.skip;

describeWithArtifacts('Sgp4WasmPropagator', () => {
  let wasm: Sgp4Wasm;
  let tle: Tle;

  beforeAll(async () => {
    wasm = await new Sgp4Wasm().load();
    tle = new Tle(ISS_TLE_2024.line1, ISS_TLE_2024.line2);
  });

  afterAll(() => {
    wasm.dispose();
  });

  it('should be swappable with Sgp4Propagator (J2000 agreement)', () => {
    const wasmPropagator = new Sgp4WasmPropagator(wasm, tle);
    const tsPropagator = new Sgp4Propagator(tle);

    try {
      const epoch = EpochUTC.fromDateTime(new Date(ISS_TLE_2024.epochDate.getTime() + 60 * 60 * 1000));

      const wasmState = wasmPropagator.propagate(epoch);
      const tsState = tsPropagator.propagate(epoch);

      expect(Math.abs(wasmState.position.x - tsState.position.x)).toBeLessThan(0.1);
      expect(Math.abs(wasmState.position.y - tsState.position.y)).toBeLessThan(0.1);
      expect(Math.abs(wasmState.position.z - tsState.position.z)).toBeLessThan(0.1);
      expect(Math.abs(wasmState.velocity.x - tsState.velocity.x)).toBeLessThan(1e-4);
    } finally {
      wasmPropagator.dispose();
    }
  });

  it('should support checkpoint/restore/reset like other propagators', () => {
    const propagator = new Sgp4WasmPropagator(wasm, tle);

    try {
      const epochState = propagator.state;
      const index = propagator.checkpoint();

      propagator.propagate(EpochUTC.fromDateTime(new Date(ISS_TLE_2024.epochDate.getTime() + 30 * 60 * 1000)));
      expect(propagator.state.position.x).not.toBe(epochState.position.x);

      propagator.restore(index);
      expect(propagator.state.position.x).toBe(epochState.position.x);

      propagator.reset();
      expect(Math.abs(propagator.state.position.x - epochState.position.x)).toBeLessThan(1e-9);

      propagator.clearCheckpoints();
    } finally {
      propagator.dispose();
    }
  });
});
