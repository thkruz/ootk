/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import type { SatKey, Sgp4WasmPosVel } from '../external/Sgp4WasmTypes';
import { ValidationError } from '../errors';
import type { SpaceObject } from '../objects/SpaceObject';
import { Sgp4 } from '../sgp4/sgp4';

/**
 * A batch source of Earth-fixed satellite positions, the input of
 * {@link ServingSatelliteScheduler}. Implementing this interface instead of passing
 * `Sgp4Wasm` directly keeps the scheduler usable without the licensed wasm build.
 */
export interface PositionSource {
  /** Stable satellite ids (for example NORAD numbers), one per satellite, same order as the position output. */
  readonly ids: readonly number[];

  /**
   * Writes the Earth-fixed (ECF/ITRF-like, rotating with the Earth) position of every satellite.
   * @param date - Instant to evaluate (UTC).
   * @param out - Output array of length `3 * ids.length`; satellite `i` occupies `out[3i..3i+2]`
   * as x, y, z in kilometers. Failed propagations are written as NaN.
   */
  positionsEcf(date: Date, out: Float64Array): void;

  /**
   * Optional fast path: positions of the satellites at `indices` only (indices into `ids`).
   * `out[3k..3k+2]` receives the position of satellite `indices[k]`. The scheduler uses this
   * between reassignment ticks (serving satellite only) and for lookahead; when absent it falls
   * back to {@link positionsEcf}, which is correct but slower.
   */
  positionsEcfSubset?(date: Date, indices: ArrayLike<number>, out: Float64Array): void;
}

/**
 * Structural subset of `Sgp4Wasm` used by {@link PositionSource.fromSgp4Wasm}. Declared here so
 * this module never imports the wasm class (the wasm is licensed and optional).
 */
export interface Sgp4WasmPropagator {
  propagateDs50UtcPosVel(
    satKeys: readonly SatKey[],
    startTimeDs50Utc: number,
    propsPerSat: number,
    stepSizeMin: number,
  ): Sgp4WasmPosVel[][];
}

/** Julian date of 1949-12-31 00:00 UTC, the origin of the Astro Standards ds50UTC day count. */
const DS50_UTC_JD_EPOCH = 2433281.5;
const UNIX_EPOCH_JD = 2440587.5;
const MS_PER_DAY = 86400000;

/** Rotates a TEME vector into the Earth-fixed frame by GMST only (same transform as Satellite.ecef()). */
function temeToEcf_(x: number, y: number, z: number, gmst: number, out: Float64Array, o: number): void {
  const c = Math.cos(gmst);
  const s = Math.sin(gmst);

  out[o] = x * c + y * s;
  out[o + 1] = -x * s + y * c;
  out[o + 2] = z;
}

function gmstAt_(date: Date): number {
  return Sgp4.gstime(date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD);
}

/**
 * Adapter over ootk satellites: positions come from `SpaceObject.ecef(date)` (SGP4 in TEME,
 * rotated by GMST only, exactly the frame `AccessCalculator` uses).
 * @param sats - Satellites (or other space objects).
 * @param ids - Optional ids, one per object. Default: the numeric `sccNum` when the object has
 * one, otherwise the object's `id`.
 */
function fromSatellites(sats: readonly SpaceObject[], ids?: readonly number[]): PositionSource {
  if (ids && ids.length !== sats.length) {
    throw new ValidationError('ids must have one entry per satellite', 'ids', ids.length);
  }
  const resolved = ids ?? sats.map((s) => {
    const scc = Number((s as { sccNum?: string }).sccNum);

    return Number.isFinite(scc) ? scc : s.id;
  });

  const write = (date: Date, i: number, out: Float64Array, o: number): void => {
    const p = sats[i].ecef(date);

    if (p) {
      out[o] = p.x;
      out[o + 1] = p.y;
      out[o + 2] = p.z;
    } else {
      out[o] = Number.NaN;
      out[o + 1] = Number.NaN;
      out[o + 2] = Number.NaN;
    }
  };

  return {
    ids: resolved,
    positionsEcf(date, out) {
      for (let i = 0; i < sats.length; i++) {
        write(date, i, out, 3 * i);
      }
    },
    positionsEcfSubset(date, indices, out) {
      for (let k = 0; k < indices.length; k++) {
        write(date, indices[k], out, 3 * k);
      }
    },
  };
}

/**
 * Adapter over an initialized `Sgp4Wasm` instance. The wasm returns TEME position (km) from
 * `propagateDs50UtcPosVel`; each record is rotated into the Earth-fixed frame by GMST with the
 * same transform `Satellite.ecef()` uses (`eci2ecef`). Records with a nonzero SGP4 error code
 * become NaN. One wasm call is made per instant for the whole batch.
 * @param wasm - A loaded `Sgp4Wasm` (any object with `propagateDs50UtcPosVel`).
 * @param satKeys - Initialized satellite keys (`addSat` then `initSats`).
 * @param ids - Optional ids, one per key. Default: the keys converted to Number.
 */
function fromSgp4Wasm(wasm: Sgp4WasmPropagator, satKeys: readonly SatKey[], ids?: readonly number[]): PositionSource {
  if (ids && ids.length !== satKeys.length) {
    throw new ValidationError('ids must have one entry per satKey', 'ids', ids.length);
  }
  const resolved = ids ?? satKeys.map((k) => Number(k));

  const run = (date: Date, keys: readonly SatKey[], out: Float64Array): void => {
    const ds50 = date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD - DS50_UTC_JD_EPOCH;
    const gmst = gmstAt_(date);
    const recs = wasm.propagateDs50UtcPosVel(keys, ds50, 1, 0);

    for (let i = 0; i < keys.length; i++) {
      const r = recs[i]?.[0];

      if (!r || r.err !== 0) {
        out[3 * i] = Number.NaN;
        out[3 * i + 1] = Number.NaN;
        out[3 * i + 2] = Number.NaN;
      } else {
        temeToEcf_(r.position.x, r.position.y, r.position.z, gmst, out, 3 * i);
      }
    }
  };

  return {
    ids: resolved,
    positionsEcf(date, out) {
      run(date, satKeys, out);
    },
    positionsEcfSubset(date, indices, out) {
      const keys: SatKey[] = [];

      for (let k = 0; k < indices.length; k++) {
        keys.push(satKeys[indices[k]]);
      }
      run(date, keys, out);
    },
  };
}

/** Factory helpers for {@link PositionSource}. */
// eslint-disable-next-line no-redeclare
export const PositionSource = { fromSatellites, fromSgp4Wasm };
