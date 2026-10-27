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
import { Sgp4ErrorCode } from './sgp4-error';

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
 * be activated at any time, even after satrecs were built), the lazily
 * attached Astro Standards satKey, and the backend activation that key was
 * issued under (a key from an earlier activation is never reused).
 */
export interface WasmTaggedSatrec extends SatelliteRecord {
  wasmSatKey?: bigint;
  /** Backend activation counter value at the time `wasmSatKey` was attached. */
  wasmBackendGen?: number;
  wasmTleLine1?: string;
  wasmTleLine2?: string;
  /** Raw Astro Standards error code of the last failed wasm propagation. */
  wasmErrCode?: number;
}

/** Sentinel satKey meaning "attach failed: do not retry under this activation, use the TS path". */
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

/** One TLE registered in a wasm instance. */
interface WasmRegistryEntry {
  /** satKey issued by the instance (possibly for a synthetic-satnum copy of the TLE). */
  key: bigint;
  /** Number of explicit holders (for example `Sgp4WasmPropagator`s) using the key. */
  refs: number;
  /** True once the global `Sgp4` backend has attached the key; it is then never removed. */
  global: boolean;
}

/**
 * Per-wasm-instance bookkeeping. It lives as long as the instance (WeakMap), so it survives
 * `clearSgp4WasmBackend()`: the TLEs stay registered in the instance, and re-activating the
 * same instance must find them instead of re-adding them (the Astro Standards TLE tree
 * rejects duplicate adds). The global backend and every `Sgp4WasmPropagator` built on the
 * same instance share it.
 */
interface WasmRegistry {
  entries: Map<string, WasmRegistryEntry>;
  /** Counter for synthetic alpha-5 satnums, per instance so they never collide in it. */
  syntheticSatnumCounter: number;
}

const registries_ = new WeakMap<object, WasmRegistry>();

const registryFor_ = (wasm: object): WasmRegistry => {
  let registry = registries_.get(wasm);

  if (!registry) {
    registry = { entries: new Map(), syntheticSatnumCounter: 0 };
    registries_.set(wasm, registry);
  }

  return registry;
};

const tleCacheKey_ = (line1: string, line2: string): string => `${line1}\n${line2}`;

let backend: Sgp4WasmBackendLike | null = null;

/**
 * Incremented on every backend change (set to a different instance, or clear). A satrec's
 * satKey is valid only for the activation it was attached under; any other value forces a
 * re-attach on the next propagation.
 */
let backendGeneration = 0;

/** Distinct TLEs attached under the current activation. */
const satKeyCache = new Map<string, bigint>();

let wasmAttachedCount = 0;
let wasmFallbackCount = 0;

/**
 * The Astro Standards TLE tree rejects TLEs with a blank satellite-number
 * field (e.g. the JSC Vimpel catalog) because the satnum is part of its
 * satKey. The satnum is only a registry label (it does not affect the
 * propagation), so those TLEs are retried with a synthesized unique alpha-5
 * satnum and a 'U' classification (the library also rejects Vimpel's 'V').
 */
const SYNTHETIC_SATNUM_LETTERS = 'VWXYZ';

const synthesizeSatnum_ = (registry: WasmRegistry): string | null => {
  const n = registry.syntheticSatnumCounter++;
  const letterIdx = Math.floor(n / 10000);

  if (letterIdx >= SYNTHETIC_SATNUM_LETTERS.length) {
    return null; // 50k synthetic ids exhausted
  }

  return `${SYNTHETIC_SATNUM_LETTERS[letterIdx]}${(n % 10000).toString().padStart(4, '0')}`;
};

const tryAddWithSyntheticSatnum_ = (
  wasm: Sgp4WasmBackendLike,
  registry: WasmRegistry,
  line1: string,
  line2: string,
): bigint | null => {
  /*
   * Eligible TLEs are those whose identity fields the library chokes on:
   * a blank or all-zero satnum (raw JSC Vimpel, or Vimpel after KeepTrack
   * zeroes the SCC field; all-zero also collides in the key space) or a
   * non-standard classification like Vimpel's 'V'. Failures with a real
   * satnum and standard classification are duplicates or bad data: no retry.
   */
  const satnumField = line1.substring(2, 7);
  const classification = line1.charAt(7);
  const isSatnumMeaningless = satnumField.trim() === '' || satnumField === '00000';
  const isNonStandardClassification = classification !== 'U' && classification !== 'C' && classification !== 'S';

  if (!isSatnumMeaningless && !isNonStandardClassification) {
    return null;
  }

  const satnum = synthesizeSatnum_(registry);

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
 * Find a TLE in a wasm instance's shared registry, or add and initialize it.
 * @param wasm Loaded wasm instance.
 * @param line1 TLE line 1.
 * @param line2 TLE line 2.
 * @param allowSynthetic Retry satnum-less TLEs with a synthetic satnum instead of throwing.
 * @returns The registry entry, or null when the instance rejects the TLE (allowSynthetic only).
 * @throws Whatever `addSat` throws, when allowSynthetic is false.
 */
const findOrAdd_ = (
  wasm: Sgp4WasmBackendLike,
  line1: string,
  line2: string,
  allowSynthetic: boolean,
): WasmRegistryEntry | null => {
  const registry = registryFor_(wasm);
  const cacheKey = tleCacheKey_(line1, line2);
  const existing = registry.entries.get(cacheKey);

  if (existing) {
    return existing;
  }

  let key: bigint | null;

  try {
    key = wasm.addSat(line1, line2);
    wasm.initSats([key]);
  } catch (e) {
    if (!allowSynthetic) {
      throw e;
    }
    key = tryAddWithSyntheticSatnum_(wasm, registry, line1, line2);
  }

  if (key === null) {
    return null;
  }

  const entry: WasmRegistryEntry = { key, refs: 0, global: false };

  registry.entries.set(cacheKey, entry);

  return entry;
};

/**
 * Acquire a satKey for a TLE on a wasm instance. The key is shared with the global `Sgp4`
 * backend and with other holders on the same instance instead of adding a duplicate (which
 * the Astro Standards TLE tree rejects). Pair every call with {@link releaseWasmSatKey}.
 * @param wasm Loaded wasm instance.
 * @param line1 TLE line 1.
 * @param line2 TLE line 2.
 * @returns The satKey, registered and initialized.
 * @throws Whatever the instance's `addSat` throws when it rejects the TLE.
 */
export const acquireWasmSatKey = (wasm: Sgp4WasmBackendLike, line1: string, line2: string): bigint => {
  const entry = findOrAdd_(wasm, line1, line2, false) as WasmRegistryEntry;

  entry.refs++;

  return entry.key;
};

/**
 * Release a satKey obtained from {@link acquireWasmSatKey}.
 * @param wasm The wasm instance the key was acquired on.
 * @param line1 TLE line 1.
 * @param line2 TLE line 2.
 * @returns True when no holder is left and the global backend never attached the key, so
 * the caller should uninit and remove the satellite from the instance; false otherwise.
 */
export const releaseWasmSatKey = (wasm: Sgp4WasmBackendLike, line1: string, line2: string): boolean => {
  const registry = registryFor_(wasm);
  const cacheKey = tleCacheKey_(line1, line2);
  const entry = registry.entries.get(cacheKey);

  if (!entry) {
    return false;
  }
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs === 0 && !entry.global) {
    registry.entries.delete(cacheKey);

    return true;
  }

  return false;
};

/**
 * Routes all subsequent `Sgp4.createSatrec`/`Sgp4.propagate` calls in this
 * JavaScript context through the given wasm instance. Pass a loaded
 * `Sgp4Wasm` (classic) or `Sgp4XpWasm` (SGP4-XP) instance. Setting the
 * instance that is already active is a no-op; any other instance starts a
 * new activation, and satrecs re-attach to it on their next propagation.
 */
export const setSgp4WasmBackend = (wasm: Sgp4WasmBackendLike): void => {
  if (!wasm.isLoaded) {
    throw new Error('Sgp4 wasm backend must be loaded before use. Call load() first.');
  }
  if (wasm === backend) {
    return;
  }
  backend = wasm;
  backendGeneration++;
  satKeyCache.clear();
  wasmAttachedCount = 0;
  wasmFallbackCount = 0;
};

/**
 * Restores the pure-TypeScript SGP4 implementation. Satrecs attached to the
 * previous backend re-attach (or fall back) under the next backend that is
 * set; their old satKeys are never reused. TLEs stay registered in the wasm
 * instance itself, so re-activating the same instance later reuses them.
 */
export const clearSgp4WasmBackend = (): void => {
  backend = null;
  backendGeneration++;
  satKeyCache.clear();
  wasmAttachedCount = 0;
  wasmFallbackCount = 0;
};

/**
 * Diagnostic counters: how many distinct TLEs attached to the wasm registry
 * vs fell back to the TypeScript implementation under the current
 * activation. A nonzero fallback count with an active backend means part of
 * the catalog is still propagating in TypeScript (visible as `dspace_`/TS
 * SGP4 frames in a profiler).
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

  if (existing !== undefined && satrec.wasmBackendGen === backendGeneration) {
    return existing > 0n ? existing : null;
  }

  defineHidden_(satrec, 'wasmBackendGen', backendGeneration);

  const line1 = satrec.wasmTleLine1;
  const line2 = satrec.wasmTleLine2;

  if (!line1 || !line2) {
    // No TLE lines (e.g. built from an OMM): TS fallback for this activation
    defineHidden_(satrec, 'wasmSatKey', WASM_KEY_FAILED);
    wasmFallbackCount++;

    return null;
  }

  const cacheKey = tleCacheKey_(line1, line2);
  const cached = satKeyCache.get(cacheKey);

  if (cached !== undefined) {
    defineHidden_(satrec, 'wasmSatKey', cached);

    return cached;
  }

  const entry = findOrAdd_(wasm, line1, line2, true);

  if (entry === null) {
    // TLE rejected by the Astro Standards library: TS fallback for this activation
    defineHidden_(satrec, 'wasmSatKey', WASM_KEY_FAILED);
    wasmFallbackCount++;

    return null;
  }

  entry.global = true;
  satKeyCache.set(cacheKey, entry.key);
  defineHidden_(satrec, 'wasmSatKey', entry.key);
  wasmAttachedCount++;

  return entry.key;
};

/**
 * Attempts to propagate via the wasm backend. Returns `null` when the TS
 * implementation should run instead (backend inactive, satrec has no TLE
 * lines, or the TLE was rejected by the wasm library).
 *
 * Like the TypeScript path it records `satrec.t` and sets `satrec.error`:
 * `NO_ERROR` on success and `WASM_PROPAGATION_FAILED` when the Astro
 * Standards call reports a nonzero code. The raw code is kept in the
 * non-enumerable `wasmErrCode` field; it does not follow Vallado's numbering,
 * so it is not mapped onto the other `Sgp4ErrorCode` values.
 * @param satrec Satellite record.
 * @param tsince Minutes since the TLE epoch.
 * @returns TEME state (or false position/velocity on failure), or null to use the TS path.
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

  satrec.t = tsince;
  if (result.err !== 0) {
    satrec.error = Sgp4ErrorCode.WASM_PROPAGATION_FAILED;
    defineHidden_(satrec, 'wasmErrCode', result.err);

    return { position: false, velocity: false };
  }
  satrec.error = Sgp4ErrorCode.NO_ERROR;

  return {
    position: result.position as TemeVec3<Kilometers>,
    velocity: result.velocity as TemeVec3<KilometersPerSecond>,
  };
};
