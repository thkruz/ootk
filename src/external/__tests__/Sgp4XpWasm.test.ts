import { Sgp4Wasm } from '../Sgp4Wasm';
import { Sgp4XpWasm } from '../Sgp4XpWasm';
import { ISS_TLE_2024, SGP4_ARTIFACTS_PRESENT, SGP4XP_ARTIFACTS_PRESENT } from './wasmTestUtils';

const describeWithXpArtifacts = SGP4XP_ARTIFACTS_PRESENT ? describe : describe.skip;
const describeWithBothArtifacts = SGP4_ARTIFACTS_PRESENT ? describe : describe.skip;

describeWithXpArtifacts('Sgp4XpWasm', () => {
  let xp: Sgp4XpWasm;

  beforeAll(async () => {
    xp = await new Sgp4XpWasm().load();
  });

  afterAll(() => {
    xp.dispose();
  });

  it('should load the .xp artifacts and propagate a type-0 TLE', () => {
    const satKey = xp.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

    xp.initSats([satKey]);

    const state = xp.propagateOne(satKey, 60);

    expect(state.err).toBe(0);
    expect(state.position.magnitude()).toBeGreaterThan(6500);
    expect(state.position.magnitude()).toBeLessThan(7100);

    xp.uninitSats([satKey]);
    xp.removeSats([satKey]);
  });

  describeWithBothArtifacts('vs classic Sgp4Wasm', () => {
    it('should run concurrently with an isolated classic instance and agree for type-0 TLEs', async () => {
      const classic = await new Sgp4Wasm().load();

      try {
        const classicKey = classic.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);
        const xpKey = xp.addSat(ISS_TLE_2024.line1, ISS_TLE_2024.line2);

        // Same TLE, independent registries produce the same key value
        expect(xpKey).toBe(classicKey);

        classic.initSats([classicKey]);
        xp.initSats([xpKey]);

        const classicState = classic.propagateOne(classicKey, 60);
        const xpState = xp.propagateOne(xpKey, 60);

        expect(classicState.err).toBe(0);
        expect(xpState.err).toBe(0);
        expect(Math.abs(xpState.position.x - classicState.position.x)).toBeLessThan(1e-6);
        expect(Math.abs(xpState.position.y - classicState.position.y)).toBeLessThan(1e-6);
        expect(Math.abs(xpState.position.z - classicState.position.z)).toBeLessThan(1e-6);

        xp.uninitSats([xpKey]);
        xp.removeSats([xpKey]);
      } finally {
        classic.dispose();
      }
    });
  });
});
