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

import { Kilometers, KilometersPerSecond, SatelliteRecord, StateVectorSgp4, TemeVec3 } from '../types/types';

/**
 * The subset of {@link Sgp4WasmBase} the `Sgp4` class needs to route
 * propagation through the USSF Astro Standards wasm build. Structural, so
 * this module never imports `external/` at runtime and any loaded
 * `Sgp4Wasm`/`Sgp4XpWasm` instance satisfies it.
 */
export interface Sgp4WasmBackendLike {
  readonly isLoaded: boolean;
  addSat(line1: string, line2: string): bigint;
  initSats(satKeys: readonly bigint[]): void;
  propagateOnePosVelFast(satKey: bigint, minutesSinceEpoch: number): {
    err: number;
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
  };
}

/**
 * A SatelliteRecord carrying the extra bookkeeping the wasm backend needs:
 * the original TLE lines (stashed by `Sgp4.createSatrec` so the backend can
 * be activated at any time, even after satrecs were built) and the lazily
 * attached Astro Standards satKey.
 */
export interface WasmTaggedSatrec extends SatelliteRecord {
  wasmSatKey?: bigint;
  wasmTleLine1?: string;
  wasmTleLine2?: string;
}

/** Sentinel satKey meaning "attach failed — do not retry, use the TS path". */
const WASM_KEY_FAILED = -1n;

/**
 * The wasm bookkeeping fields are non-enumerable so they never leak into
 * satrec snapshots, spreads, or JSON.stringify (which throws on the bigint
 * satKey).
 */
const defineHidden_ = (obj: object, key: string, value: unknown): void => {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: false,
  });
};

let backend: Sgp4WasmBackendLike | null = null;

/**
 * Reuses satKeys across satrecs built from the same TLE (the Astro Standards
 * TLE tree rejects duplicate adds).
 */
const satKeyCache = new Map<string, bigint>();

/**
 * The Astro Standards TLE tree rejects TLEs with a blank satellite-number
 * field (e.g. the JSC Vimpel catalog) because the satnum is part of its
 * satKey. The satnum is only a registry label — it does not affect the
 * propagation — so those TLEs are retried with a synthesized unique alpha-5
 * satnum and a 'U' classification (the library also rejects Vimpel's 'V').
 */
let syntheticSatnumCounter = 0;
let wasmAttachedCount = 0;
let wasmFallbackCount = 0;

const SYNTHETIC_SATNUM_LETTERS = 'VWXYZ';

const synthesizeSatnum_ = (): string | null => {
  const n = syntheticSatnumCounter++;
  const letterIdx = Math.floor(n / 10000);

  if (letterIdx >= SYNTHETIC_SATNUM_LETTERS.length) {
    return null; // 50k synthetic ids exhausted
  }

  return `${SYNTHETIC_SATNUM_LETTERS[letterIdx]}${(n % 10000).toString().padStart(4, '0')}`;
};

const tryAddWithSyntheticSatnum_ = (wasm: Sgp4WasmBackendLike, line1: string, line2: string): bigint | null => {
  /*
   * Eligible TLEs are those whose identity fields the library chokes on:
   * a blank or all-zero satnum (raw JSC Vimpel, or Vimpel after KeepTrack
   * zeroes the SCC field — all-zero also collides in the key space) or a
   * non-standard classification like Vimpel's 'V'. Failures with a real
   * satnum and standard classification are duplicates or bad data — no retry.
   */
  const satnumField = line1.substring(2, 7);
  const classification = line1.charAt(7);
  const isSatnumMeaningless = satnumField.trim() === '' || satnumField === '00000';
  const isNonStandardClassification = classification !== 'U' && classification !== 'C' && classification !== 'S';

  if (!isSatnumMeaningless && !isNonStandardClassification) {
    return null;
  }

  const satnum = synthesizeSatnum_();

  if (satnum === null) {
    return null;
  }

  const syntheticLine1 = `${line1.slice(0, 2)}${satnum}U${line1.slice(8)}`;
  const syntheticLine2 = `${line2.slice(0, 2)}${satnum}${line2.slice(7)}`;

  try {
    const satKey = wasm.addSat(syntheticLine1, syntheticLine2);

    wasm.initSats([satKey]);

    return satKey;
  } catch {
    return null;
  }
};

/**
 * Routes all subsequent `Sgp4.createSatrec`/`Sgp4.propagate` calls in this
 * JavaScript context through the given wasm instance. Pass a loaded
 * `Sgp4Wasm` (classic) or `Sgp4XpWasm` (SGP4-XP) instance.
 */
export const setSgp4WasmBackend = (wasm: Sgp4WasmBackendLike): void => {
  if (!wasm.isLoaded) {
    throw new Error('Sgp4 wasm backend must be loaded before use. Call load() first.');
  }
  backend = wasm;
};

/**
 * Restores the pure-TypeScript SGP4 implementation.
 */
export const clearSgp4WasmBackend = (): void => {
  backend = null;
  satKeyCache.clear();
  syntheticSatnumCounter = 0;
  wasmAttachedCount = 0;
  wasmFallbackCount = 0;
};

/**
 * Diagnostic counters: how many distinct TLEs attached to the wasm registry
 * vs permanently fell back to the TypeScript implementation. A nonzero
 * fallback count with an active backend means part of the catalog is still
 * propagating in TypeScript (visible as `dspace_`/TS SGP4 frames in a
 * profiler).
 */
export const getSgp4WasmBackendStats = (): { attached: number; fallback: number } => ({
  attached: wasmAttachedCount,
  fallback: wasmFallbackCount,
});

/**
 * Whether propagation is currently routed through the wasm backend.
 */
export const isSgp4WasmBackendActive = (): boolean => backend !== null;

/**
 * Stashes the TLE lines on a fresh satrec so the wasm backend can attach a
 * satKey lazily on first propagation, regardless of when it was activated.
 */
export const stashTleLines = (satrec: SatelliteRecord, line1: string, line2: string): void => {
  defineHidden_(satrec, 'wasmTleLine1', line1);
  defineHidden_(satrec, 'wasmTleLine2', line2);
};

const ensureSatKey_ = (wasm: Sgp4WasmBackendLike, satrec: WasmTaggedSatrec): bigint | null => {
  const existing = satrec.wasmSatKey;

  if (existing !== undefined) {
    return existing > 0n ? existing : null;
  }

  const line1 = satrec.wasmTleLine1;
  const line2 = satrec.wasmTleLine2;

  if (!line1 || !line2) {
    // No TLE lines (e.g. built from an OMM) — permanent TS fallback
    defineHidden_(satrec, 'wasmSatKey', WASM_KEY_FAILED);
    wasmFallbackCount++;

    return null;
  }

  const cacheKey = `${line1}\n${line2}`;
  const cached = satKeyCache.get(cacheKey);

  if (cached !== undefined) {
    defineHidden_(satrec, 'wasmSatKey', cached);

    return cached;
  }

  try {
    const satKey = wasm.addSat(line1, line2);

    wasm.initSats([satKey]);
    satKeyCache.set(cacheKey, satKey);
    defineHidden_(satrec, 'wasmSatKey', satKey);
    wasmAttachedCount++;

    return satKey;
  } catch {
    // Satnum-less TLEs (e.g. JSC Vimpel) get a second chance with a synthetic satnum
    const syntheticKey = tryAddWithSyntheticSatnum_(wasm, line1, line2);

    if (syntheticKey !== null) {
      satKeyCache.set(cacheKey, syntheticKey);
      defineHidden_(satrec, 'wasmSatKey', syntheticKey);
      wasmAttachedCount++;

      return syntheticKey;
    }

    // TLE rejected by the Astro Standards library — permanent TS fallback
    defineHidden_(satrec, 'wasmSatKey', WASM_KEY_FAILED);
    wasmFallbackCount++;

    return null;
  }
};

/**
 * Attempts to propagate via the wasm backend. Returns `null` when the TS
 * implementation should run instead (backend inactive, satrec has no TLE
 * lines, or the TLE was rejected by the wasm library).
 */
export const tryPropagateWasm = (satrec: SatelliteRecord, tsince: number): StateVectorSgp4 | null => {
  /*
   * satrec.init is true during sgp4init_'s internal zero-epoch propagation,
   * which initializes the TS satrec state and must never route to wasm.
   */
  if (!backend || satrec.init) {
    return null;
  }

  const satKey = ensureSatKey_(backend, satrec as WasmTaggedSatrec);

  if (satKey === null) {
    return null;
  }

  const result = backend.propagateOnePosVelFast(satKey, tsince);

  if (result.err !== 0) {
    return { position: false, velocity: false };
  }

  return {
    position: result.position as TemeVec3<Kilometers>,
    velocity: result.velocity as TemeVec3<KilometersPerSecond>,
  };
};
