import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors';
import { Sgp4WasmBase } from '../../external/Sgp4WasmBase';
import type { SatKey, Sgp4WasmPosVel } from '../../external/Sgp4WasmTypes';
import { Satellite } from '../../objects/Satellite';
import { Sgp4 } from '../../sgp4/sgp4';
import { eci2ecef } from '../../transforms/transforms';
import { EpochUTC } from '../../time/EpochUTC';
import type { TleLine1, TleLine2 } from '../../types/types';
import { PositionSource, type Sgp4WasmBatchLike } from '../PositionSource';

const tle1 = '1 25544U 98067A   22203.51722222  .00016717  00000-0  10270-3 0  9002' as TleLine1;
const tle2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550 10001' as TleLine2;
const tleB1 = '1 20580U 90037B   22203.50000000  .00000800  00000-0  38000-4 0  9990' as TleLine1;
const tleB2 = '2 20580  28.4700  45.0000 0002800 120.0000 240.0000 15.09000000 10009' as TleLine2;

const date = new Date('2022-07-22T12:34:56.789Z');

describe('PositionSource', () => {
  describe('fromSatellites', () => {
    const sats = [new Satellite({ tle1, tle2 }), new Satellite({ tle1: tleB1, tle2: tleB2 })];

    it('positions equal Satellite.ecef() at the same time', () => {
      const src = PositionSource.fromSatellites(sats);
      const out = new Float64Array(6);

      src.positionsEcf(date, out);
      sats.forEach((s, i) => {

        const e = s.ecef(date)!;

        expect(out[3 * i]).toBe(e.x);
        expect(out[3 * i + 1]).toBe(e.y);
        expect(out[3 * i + 2]).toBe(e.z);
      });
    });

    it('defaults ids to the NORAD number and accepts overrides', () => {
      expect(PositionSource.fromSatellites(sats).ids).toEqual([25544, 20580]);
      expect(PositionSource.fromSatellites(sats, [5, 6]).ids).toEqual([5, 6]);
      expect(() => PositionSource.fromSatellites(sats, [5])).toThrow(ValidationError);
    });

    it('subset output matches the full output for the requested indices', () => {
      const src = PositionSource.fromSatellites(sats);
      const full = new Float64Array(6);
      const sub = new Float64Array(3);

      src.positionsEcf(date, full);
      src.positionsEcfSubset!(date, [1], sub);
      expect(Array.from(sub)).toEqual(Array.from(full.subarray(3, 6)));
    });

    it('writes NaN when propagation fails', () => {
      const bad = { ecef: () => null, id: 9 } as unknown as Satellite;
      const out = new Float64Array(3);

      PositionSource.fromSatellites([bad]).positionsEcf(date, out);
      expect(Number.isNaN(out[0]) && Number.isNaN(out[1]) && Number.isNaN(out[2])).toBe(true);
    });
  });

  describe('fromSgp4Wasm (structural fake, no real wasm)', () => {
    const sats = [new Satellite({ tle1, tle2 }), new Satellite({ tle1: tleB1, tle2: tleB2 })];
    const keys: SatKey[] = [101n, 102n];
    const calls: { keys: readonly SatKey[]; ds50: number; n: number; step: number }[] = [];

    // The fake returns what the real wasm documents: TEME position in km per record (Sgp4WasmPosVel).
    const fake: Sgp4WasmBatchLike = {
      propagateDs50UtcPosVel(satKeys, ds50, n, step) {
        calls.push({ keys: satKeys, ds50, n, step });

        return satKeys.map((k) => {
          if (k === 103n) {
            return [{ err: 1, time: ds50, position: { x: 1, y: 2, z: 3 }, velocity: { x: 0, y: 0, z: 0 } } as unknown as Sgp4WasmPosVel];
          }
          const eci = sats[Number(k) - 101].eci(new Date(Math.round((ds50 - 7306) * 86400000)))!;

          return [{ err: 0, time: ds50, position: eci.position, velocity: eci.velocity } as unknown as Sgp4WasmPosVel];
        });
      },
    };

    it('passes ds50UTC consistent with Sgp4WasmBase.toDs50Utc, one batched call', () => {
      calls.length = 0;
      PositionSource.fromSgp4Wasm(fake, keys).positionsEcf(date, new Float64Array(6));
      expect(calls).toHaveLength(1);
      expect(calls[0].keys).toEqual(keys);
      expect(calls[0].n).toBe(1);
      expect(calls[0].step).toBe(0);
      expect(calls[0].ds50).toBeCloseTo(Sgp4WasmBase.toDs50Utc(EpochUTC.fromDateTime(date)), 9);
    });

    it('rotates TEME to ECF with ootk eci2ecef at GMST (agrees with Satellite.ecef)', () => {
      const out = new Float64Array(6);

      PositionSource.fromSgp4Wasm(fake, keys).positionsEcf(date, out);
      sats.forEach((s, i) => {
        // Independent route: ootk's own transform applied to the TEME state
        const eci = s.eci(date)!;
        const jd = date.getTime() / 86400000 + 2440587.5;
        const ref = eci2ecef(eci.position, Sgp4.gstime(jd));
        // Tolerance: the fake re-derives the date from ds50 (double rounding of a day count, ~1e-5 s),
        // which moves a LEO satellite by 7.6 km/s * 1e-5 s, well under 1e-3 km.

        expect(Math.abs(out[3 * i] - ref.x)).toBeLessThan(1e-3);
        expect(Math.abs(out[3 * i + 1] - ref.y)).toBeLessThan(1e-3);
        expect(Math.abs(out[3 * i + 2] - ref.z)).toBeLessThan(1e-3);

        const e = s.ecef(date)!;

        expect(Math.abs(out[3 * i] - e.x)).toBeLessThan(1e-3);
      });
    });

    it('maps nonzero error codes to NaN and supports subsets and custom ids', () => {
      const src = PositionSource.fromSgp4Wasm(fake, [101n, 103n], [11, 13]);
      const out = new Float64Array(6);

      src.positionsEcf(date, out);
      expect(Number.isFinite(out[0])).toBe(true);
      expect(Number.isNaN(out[3])).toBe(true);
      expect(src.ids).toEqual([11, 13]);
      calls.length = 0;
      const sub = new Float64Array(3);

      src.positionsEcfSubset!(date, [0], sub);
      expect(calls[0].keys).toEqual([101n]);
      expect(sub[0]).toBe(out[0]);
      expect(() => PositionSource.fromSgp4Wasm(fake, keys, [1])).toThrow(ValidationError);
    });
  });
});
