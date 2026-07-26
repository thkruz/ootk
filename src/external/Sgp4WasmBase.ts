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

import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Degrees, Kilometers, KilometersPerSecond } from '../types/types';
import {
  SatKey,
  SGP4_WASM_ADD_SAT_ERRORS,
  SGP4_WASM_DYN_ARR_ERRORS,
  Sgp4PropEmscriptenModule,
  Sgp4PropFS,
  Sgp4WasmError,
  Sgp4WasmFastPosVel,
  Sgp4WasmLoadOptions,
  Sgp4WasmLogLevel,
  Sgp4WasmPosVel,
  Sgp4WasmState,
} from './Sgp4WasmTypes';

/**
 * The 19 wasm exports bound once at load time via `cwrap`.
 */
interface Sgp4WasmBindings {
  tleAddSatFrLines: (line1: string, line2: string) => bigint;
  /*
   * Takes a heap pointer, not a cwrap 'string': cwrap copies string arguments
   * onto the wasm stack, which overflows for large TLE batches.
   */
  tleAddSatsFrLines: (satsPtr: number, satKeysPtr: number, errSatPtr: number) => number;
  tleLoadFileVfs: (fileName: string) => number;
  tleRemoveSats: (keysPtr: number, numKeys: number, errSatPtr: number) => number;
  sgp4InitSats: (keysPtr: number, numKeys: number, errSatPtr: number) => number;
  sgp4RemoveSats: (keysPtr: number, numKeys: number, errSatPtr: number) => number;
  sgp4Prop: (keysPtr: number, numKeys: number, startMse: number, propsPerSat: number, stepMin: number, resultPtr: number) => number;
  sgp4PropPosVel: (keysPtr: number, numKeys: number, startMse: number, propsPerSat: number, stepMin: number, resultPtr: number) => number;
  sgp4PropDs50Utc: (keysPtr: number, numKeys: number, startDs50Utc: number, propsPerSat: number, stepMin: number, resultPtr: number) => number;
  sgp4PropDs50UtcPosVel: (keysPtr: number, numKeys: number, startDs50Utc: number, propsPerSat: number, stepMin: number, resultPtr: number) => number;
  initDynArr: (initialSize: number) => number;
  reallocDynArr: (newSize: number) => number;
  freeDynArr: () => void;
  getDynArrSize: () => number;
  addSatToDynArr: (line1: string, line2: string) => number;
  sgp4PropDynArrPosVel: (idxPtr: number, numKeys: number, startMse: number, propsPerSat: number, stepMin: number, resultPtr: number) => void;
  sgp4PropDs50UtcDynArr: (idxPtr: number, numKeys: number, startDs50Utc: number, propsPerSat: number, stepMin: number, resultPtr: number) => void;
  sgp4PropDs50UtcDynArrPosVel: (idxPtr: number, numKeys: number, startDs50Utc: number, propsPerSat: number, stepMin: number, resultPtr: number) => void;
  setLogLevel: (level: number) => number;
}

/**
 * Julian date of 1949 December 31, 00:00:00 UTC — the epoch of the Astro
 * Standards ds50UTC time system (1950 January 1, 00:00 UTC = 1.0).
 */
const DS50_UTC_JD_EPOCH = 2433281.5;

/**
 * Byte size of an errSat character buffer for `TleAddSatsFrLines_wasm`
 * (holds the line 1 of the TLE that failed to parse).
 */
const ERR_SAT_TEXT_BYTES = 512;

/**
 * Base class wrapping the USSF Astro Standards "C Sgp4Prop WebAssembly"
 * builds (v9.1.1.0). Concrete subclasses ({@link Sgp4Wasm} for classic SGP4,
 * {@link Sgp4XpWasm} for SGP4-XP) only pick the artifact filenames.
 *
 * The Emscripten artifacts (`Sgp4Prop.js`/`.wasm` and the `.xp` pair) are
 * license-restricted and distributed via space-track.org. They are NOT
 * shipped with ootk; they must be placed in `src/external/` (Node default)
 * or supplied explicitly through {@link Sgp4WasmLoadOptions}.
 *
 * The glue script is a classic non-modularized Emscripten build, which
 * cannot be imported from an ES-module package (the internal `Module`
 * object is unreachable). It is therefore fetched as text and evaluated in
 * a controlled function scope with a pre-seeded `Module` (including
 * `wasmBinary`, so Emscripten's file-location logic is never exercised).
 * Note this requires `unsafe-eval` if a Content-Security-Policy is present.
 *
 * All propagation output is in the TEME frame, matching the pure-TypeScript
 * {@link Sgp4} class.
 */
export abstract class Sgp4WasmBase {
  /** Glue script filename used for Node default resolution. */
  protected abstract readonly defaultGlueFile_: string;
  /** Wasm binary filename used for Node default resolution. */
  protected abstract readonly defaultWasmFile_: string;

  private module_: Sgp4PropEmscriptenModule | null = null;
  private fs_: Sgp4PropFS | null = null;
  private bindings_: Sgp4WasmBindings | null = null;
  private loadPromise_: Promise<this> | null = null;
  private isDynArrInitialized_ = false;
  private scratchKeyPtr_ = 0;
  private scratchResultPtr_ = 0;

  /**
   * Converts a UTC epoch to the Astro Standards ds50UTC time system
   * (days since 1949 December 31, 00:00 UTC).
   * @param epoch The epoch to convert.
   * @returns Days since 1950 UTC.
   */
  static toDs50Utc(epoch: EpochUTC): number {
    return epoch.toJulianDate() - DS50_UTC_JD_EPOCH;
  }

  /**
   * Whether the wasm runtime has been loaded and initialized.
   */
  get isLoaded(): boolean {
    return this.module_ !== null;
  }

  /**
   * Raw Emscripten Module escape hatch (`_malloc`, `ccall`, heap views, ...).
   * @throws {Sgp4WasmError} If the module is not loaded yet.
   */
  get module(): Sgp4PropEmscriptenModule {
    if (!this.module_) {
      throw new Sgp4WasmError(`${this.constructor.name} is not loaded. Call load() first.`);
    }

    return this.module_;
  }

  /**
   * Raw Emscripten virtual filesystem escape hatch.
   * @throws {Sgp4WasmError} If the module is not loaded yet.
   */
  get fs(): Sgp4PropFS {
    if (!this.fs_) {
      throw new Sgp4WasmError(`${this.constructor.name} is not loaded. Call load() first.`);
    }

    return this.fs_;
  }

  /**
   * Loads and initializes the wasm runtime. Idempotent — repeat calls return
   * the same in-flight or completed load.
   * @param options Artifact sources and stdout/stderr hooks. In Node both
   * artifacts default to files next to this module; in the browser both must
   * be provided (typically URLs to statically served copies).
   * @returns This instance, once the runtime is initialized.
   */
  load(options: Sgp4WasmLoadOptions = {}): Promise<this> {
    this.loadPromise_ ??= this.loadInternal_(options).catch((err: Error) => {
      // Allow a retry (e.g. with corrected LoadOptions) after a failed load
      this.loadPromise_ = null;
      throw err;
    });

    return this.loadPromise_;
  }

  /**
   * Frees the dynamic array (if initialized) and drops all references to the
   * wasm runtime so it can be garbage collected. Note Emscripten linear
   * memory cannot be truly freed; a subsequent load() evaluates a fresh,
   * isolated runtime.
   */
  dispose(): void {
    if (this.isDynArrInitialized_ && this.bindings_) {
      this.bindings_.freeDynArr();
    }
    if (this.module_ && this.scratchKeyPtr_) {
      this.module_._free(this.scratchKeyPtr_);
      this.module_._free(this.scratchResultPtr_);
    }
    this.scratchKeyPtr_ = 0;
    this.scratchResultPtr_ = 0;
    this.isDynArrInitialized_ = false;
    this.module_ = null;
    this.fs_ = null;
    this.bindings_ = null;
    this.loadPromise_ = null;
  }

  // TLE tree management

  /**
   * Adds a single TLE to the TLE tree (`TleAddSatFrLines_wasm`).
   * @param line1 Line 1 of the TLE.
   * @param line2 Line 2 of the TLE.
   * @returns The satKey of the added TLE.
   */
  addSat(line1: string, line2: string): SatKey {
    const satKey = this.fn_().tleAddSatFrLines(line1, line2);

    if (satKey <= 0n) {
      throw new Sgp4WasmError(`TleAddSatFrLines_wasm failed for line1 "${line1}" (code ${satKey})`, Number(satKey));
    }

    return satKey;
  }

  /**
   * Adds any number of TLEs from newline-separated text
   * (`TleAddSatsFrLines_wasm`).
   *
   * The library adds TLEs individually: entries it fails to parse come back
   * as `0n` in the returned array (positions match the input order), while
   * the rest are added normally.
   * @param tleText Newline-separated TLE lines.
   * @returns One satKey per input TLE; `0n` marks a failed entry.
   */
  addSats(tleText: string): SatKey[] {
    const m = this.module;
    const numSats = Sgp4WasmBase.countTles_(tleText);

    if (numSats === 0) {
      return [];
    }

    /*
     * The TLE text goes through the heap, not a cwrap 'string' argument —
     * cwrap copies strings onto the (small) wasm stack, which overflows for
     * catalog-sized batches. TLEs are ASCII, so TextEncoder suffices.
     */
    const textBytes = new TextEncoder().encode(tleText);

    return this.withMalloc_(textBytes.length + 1, (textPtr) => this.withMalloc_(numSats * 8, (keysPtr) => this.withMalloc_(ERR_SAT_TEXT_BYTES, (errPtr) => {
      m.HEAPU8.set(textBytes, textPtr);
      m.HEAPU8[textPtr + textBytes.length] = 0;
      m.HEAPU8.fill(0, errPtr, errPtr + ERR_SAT_TEXT_BYTES);
      const ret = this.fn_().tleAddSatsFrLines(textPtr, keysPtr, errPtr);

      if (ret !== 0) {
        const errLine = m.UTF8ToString(errPtr, ERR_SAT_TEXT_BYTES);

        throw new Sgp4WasmError(`TleAddSatsFrLines_wasm failed (code ${ret}); offending TLE line 1: "${errLine}"`, ret);
      }

      return this.readI64Array_(keysPtr, numSats);
    })));
  }

  /**
   * Adds any number of TLEs through the Emscripten virtual filesystem
   * (`TleLoadFileVFS_wasm`). The text is written to the VFS `inFile`, and
   * the satKeys the library writes to `outFile` are read back.
   * @param tleText Newline-separated TLE lines.
   * @returns The satKeys of all added TLEs.
   */
  loadTlesVfs(tleText: string): SatKey[] {
    this.fn_();
    const vfs = this.fs;

    try {
      vfs.writeFile('inFile', tleText);
      const ret = this.fn_().tleLoadFileVfs('inFile');

      if (ret <= 0) {
        throw new Sgp4WasmError(`TleLoadFileVFS_wasm failed (code ${ret})`, ret);
      }

      const outText = vfs.readFile('outFile', { encoding: 'utf8' });

      return outText
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => BigInt(line));
    } finally {
      for (const file of ['inFile', 'outFile']) {
        if (vfs.analyzePath(file).exists) {
          vfs.unlink(file);
        }
      }
    }
  }

  /**
   * Removes TLEs from the TLE tree (`TleRemoveSats_wasm`).
   * @param satKeys The satKeys to remove.
   */
  removeSats(satKeys: readonly SatKey[]): void {
    this.runKeysWithErrSat_((keysPtr, numKeys, errPtr) => this.fn_().tleRemoveSats(keysPtr, numKeys, errPtr), satKeys, 'TleRemoveSats_wasm');
  }

  // SGP4 object lifecycle

  /**
   * Initializes SGP4 objects for previously added TLEs
   * (`Sgp4InitSats_wasm`). Must be called after adding TLEs and before
   * propagating them.
   * @param satKeys The satKeys to initialize.
   */
  initSats(satKeys: readonly SatKey[]): void {
    this.runKeysWithErrSat_((keysPtr, numKeys, errPtr) => this.fn_().sgp4InitSats(keysPtr, numKeys, errPtr), satKeys, 'Sgp4InitSats_wasm');
  }

  /**
   * Removes initialized SGP4 objects (`Sgp4RemoveSats_wasm`).
   * @param satKeys The satKeys to remove.
   */
  uninitSats(satKeys: readonly SatKey[]): void {
    this.runKeysWithErrSat_((keysPtr, numKeys, errPtr) => this.fn_().sgp4RemoveSats(keysPtr, numKeys, errPtr), satKeys, 'Sgp4RemoveSats_wasm');
  }

  // Propagation by satKey

  /**
   * Propagates satKeys with geodetic output (`Sgp4Prop_wasm`).
   * @param satKeys The satKeys to propagate (must be initialized).
   * @param startTimeMse Start time in minutes since each TLE's epoch.
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagate(satKeys: readonly SatKey[], startTimeMse: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmState[][] {
    const buf = this.propagateKeys_(
      (...args) => this.fn_().sgp4Prop(...args), satKeys, startTimeMse, propsPerSat, stepSizeMin, 11, 'Sgp4Prop_wasm',
    );

    return this.parseRecords_(buf, satKeys.length, propsPerSat, 11) as Sgp4WasmState[][];
  }

  /**
   * Propagates satKeys, position/velocity only (`Sgp4PropPosVel_wasm`).
   * @param satKeys The satKeys to propagate (must be initialized).
   * @param startTimeMse Start time in minutes since each TLE's epoch.
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagatePosVel(satKeys: readonly SatKey[], startTimeMse: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmPosVel[][] {
    const buf = this.propagateKeys_(
      (...args) => this.fn_().sgp4PropPosVel(...args), satKeys, startTimeMse, propsPerSat, stepSizeMin, 8, 'Sgp4PropPosVel_wasm',
    );

    return this.parseRecords_(buf, satKeys.length, propsPerSat, 8);
  }

  /**
   * Propagates satKeys from an absolute time with geodetic output
   * (`Sgp4PropDs50Utc_wasm`).
   * @param satKeys The satKeys to propagate (must be initialized).
   * @param startTimeDs50Utc Start time in days since 1950 UTC (see {@link toDs50Utc}).
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagateDs50Utc(satKeys: readonly SatKey[], startTimeDs50Utc: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmState[][] {
    const buf = this.propagateKeys_(
      (...args) => this.fn_().sgp4PropDs50Utc(...args), satKeys, startTimeDs50Utc, propsPerSat, stepSizeMin, 11, 'Sgp4PropDs50Utc_wasm',
    );

    return this.parseRecords_(buf, satKeys.length, propsPerSat, 11) as Sgp4WasmState[][];
  }

  /**
   * Propagates satKeys from an absolute time, position/velocity only
   * (`Sgp4PropDs50UtcPosVel_wasm`).
   * @param satKeys The satKeys to propagate (must be initialized).
   * @param startTimeDs50Utc Start time in days since 1950 UTC (see {@link toDs50Utc}).
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagateDs50UtcPosVel(satKeys: readonly SatKey[], startTimeDs50Utc: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmPosVel[][] {
    const buf = this.propagateKeys_(
      (...args) => this.fn_().sgp4PropDs50UtcPosVel(...args), satKeys, startTimeDs50Utc, propsPerSat, stepSizeMin, 8, 'Sgp4PropDs50UtcPosVel_wasm',
    );

    return this.parseRecords_(buf, satKeys.length, propsPerSat, 8);
  }

  /**
   * Convenience single-satellite, single-step propagation.
   * @param satKey The satKey to propagate (must be initialized).
   * @param minutesSinceEpoch Minutes since the TLE epoch.
   * @returns The propagated state.
   */
  propagateOne(satKey: SatKey, minutesSinceEpoch: number): Sgp4WasmState {
    return this.propagate([satKey], minutesSinceEpoch, 1, 0)[0][0];
  }

  /**
   * Convenience single-satellite propagation to an absolute UTC epoch.
   * @param satKey The satKey to propagate (must be initialized).
   * @param epoch The UTC epoch to propagate to.
   * @returns The propagated state.
   */
  propagateEpoch(satKey: SatKey, epoch: EpochUTC): Sgp4WasmState {
    return this.propagateDs50Utc([satKey], Sgp4WasmBase.toDs50Utc(epoch), 1, 0)[0][0];
  }

  /**
   * Hot-path single-satellite propagation (`Sgp4PropPosVel_wasm`) that reuses
   * persistent scratch buffers instead of allocating per call, and returns
   * plain numbers instead of Vector3D instances. Intended for per-frame use
   * (e.g. as a drop-in backend for `Sgp4.propagate`).
   * @param satKey The satKey to propagate (must be initialized).
   * @param minutesSinceEpoch Minutes since the TLE epoch.
   * @returns Plain TEME position/velocity plus the per-record error code; a
   * nonzero function-level failure is reported as `err` too.
   */
  propagateOnePosVelFast(satKey: SatKey, minutesSinceEpoch: number): Sgp4WasmFastPosVel {
    this.fn_(); // assert loaded
    const m = this.module;

    if (!this.scratchKeyPtr_) {
      this.scratchKeyPtr_ = m._malloc(8);
      this.scratchResultPtr_ = m._malloc(8 * 8);
    }

    /*
     * Direct heap write + raw export call: skips setValue's string dispatch
     * and cwrap's argument marshalling, which dominate at per-frame call
     * rates. Views are read fresh from the module (growth safety).
     */
    m.HEAP64[this.scratchKeyPtr_ >> 3] = satKey;
    const ret = m._Sgp4PropPosVel_wasm(this.scratchKeyPtr_, 1, minutesSinceEpoch, 1, 0, this.scratchResultPtr_);

    if (ret !== 0) {
      return { err: ret, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    }

    // Re-read the heap view after the call; memory growth invalidates cached views
    const heap = m.HEAPF64;
    const off = this.scratchResultPtr_ / 8;

    return {
      err: heap[off],
      position: { x: heap[off + 2], y: heap[off + 3], z: heap[off + 4] },
      velocity: { x: heap[off + 5], y: heap[off + 6], z: heap[off + 7] },
    };
  }

  // Dynamic array batch path

  /**
   * Initializes the module-global dynamic array of SGP4 objects
   * (`InitDynArr_wasm`).
   * @param initialSize Initial capacity of the array.
   */
  initDynArr(initialSize: number): void {
    const ret = this.fn_().initDynArr(initialSize);

    if (ret !== 0) {
      throw new Sgp4WasmError(`InitDynArr_wasm failed (code ${ret}): ${SGP4_WASM_DYN_ARR_ERRORS[ret] ?? 'unknown error'}`, ret);
    }
    this.isDynArrInitialized_ = true;
  }

  /**
   * Re-allocates the dynamic array to a new capacity
   * (`ReallocateDynArr_wasm`).
   * @param newSize New capacity of the array.
   */
  reallocDynArr(newSize: number): void {
    const ret = this.fn_().reallocDynArr(newSize);

    if (ret !== 0) {
      throw new Sgp4WasmError(`ReallocateDynArr_wasm failed (code ${ret}): ${SGP4_WASM_DYN_ARR_ERRORS[ret] ?? 'unknown error'}`, ret);
    }
  }

  /**
   * Frees the dynamic array (`FreeDynArr_wasm`).
   */
  freeDynArr(): void {
    this.fn_().freeDynArr();
    this.isDynArrInitialized_ = false;
  }

  /**
   * Current size of the dynamic array (`GetDynArrSize_wasm`).
   */
  get dynArrSize(): number {
    return this.fn_().getDynArrSize();
  }

  /**
   * Adds a TLE to the dynamic array (`AddSatToDynArr_wasm`).
   * @param line1 Line 1 of the TLE.
   * @param line2 Line 2 of the TLE.
   * @returns The dynamic array index of the added satellite.
   */
  addSatToDynArr(line1: string, line2: string): number {
    const index = this.fn_().addSatToDynArr(line1, line2);

    if (index < 0) {
      throw new Sgp4WasmError(`AddSatToDynArr_wasm failed (code ${index}): ${SGP4_WASM_ADD_SAT_ERRORS[index] ?? 'unknown error'}`, index);
    }

    return index;
  }

  /**
   * Propagates dynamic array entries, position/velocity only
   * (`Sgp4PropDynArrPosVel_wasm`).
   * @param indexes Dynamic array indices to propagate.
   * @param startTimeMse Start time in minutes since each TLE's epoch.
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagateDynArrPosVel(indexes: readonly number[], startTimeMse: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmPosVel[][] {
    const buf = this.propagateIndexes_(
      (...args) => this.fn_().sgp4PropDynArrPosVel(...args), indexes, startTimeMse, propsPerSat, stepSizeMin, 8,
    );

    return this.parseRecords_(buf, indexes.length, propsPerSat, 8);
  }

  /**
   * Propagates dynamic array entries from an absolute time with geodetic
   * output (`Sgp4PropDs50UtcDynArr_wasm`).
   * @param indexes Dynamic array indices to propagate.
   * @param startTimeDs50Utc Start time in days since 1950 UTC (see {@link toDs50Utc}).
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagateDs50UtcDynArr(indexes: readonly number[], startTimeDs50Utc: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmState[][] {
    const buf = this.propagateIndexes_(
      (...args) => this.fn_().sgp4PropDs50UtcDynArr(...args), indexes, startTimeDs50Utc, propsPerSat, stepSizeMin, 11,
    );

    return this.parseRecords_(buf, indexes.length, propsPerSat, 11) as Sgp4WasmState[][];
  }

  /**
   * Propagates dynamic array entries from an absolute time,
   * position/velocity only (`Sgp4PropDs50UtcDynArrPosVel_wasm`).
   * @param indexes Dynamic array indices to propagate.
   * @param startTimeDs50Utc Start time in days since 1950 UTC (see {@link toDs50Utc}).
   * @param propsPerSat Number of propagations per satellite.
   * @param stepSizeMin Step size in minutes between propagations.
   * @returns Records indexed as `[satIndex][stepIndex]`.
   */
  propagateDs50UtcDynArrPosVel(indexes: readonly number[], startTimeDs50Utc: number, propsPerSat: number, stepSizeMin: number): Sgp4WasmPosVel[][] {
    const buf = this.propagateIndexes_(
      (...args) => this.fn_().sgp4PropDs50UtcDynArrPosVel(...args), indexes, startTimeDs50Utc, propsPerSat, stepSizeMin, 8,
    );

    return this.parseRecords_(buf, indexes.length, propsPerSat, 8);
  }

  // Logging

  /**
   * Sets the wasm library's logging level (`SetLogLevel_wasm`).
   * @param level The new log level.
   */
  setLogLevel(level: Sgp4WasmLogLevel): void {
    const ret = this.fn_().setLogLevel(level);

    if (ret !== 0) {
      throw new Sgp4WasmError(`SetLogLevel_wasm failed (code ${ret})`, ret);
    }
  }

  // Internals

  /**
   * Counts the TLEs in newline-separated text by counting line-1 rows.
   * @param tleText Newline-separated TLE lines.
   * @returns Number of TLEs.
   */
  private static countTles_(tleText: string): number {
    return tleText
      .split(/\r?\n/u)
      .filter((line) => line.trim().startsWith('1 '))
      .length;
  }

  private static isHttpUrl_(source: string | URL): boolean {
    const href = source instanceof URL ? source.href : source;

    return (/^https?:\/\//u).test(href);
  }

  private fn_(): Sgp4WasmBindings {
    if (!this.bindings_) {
      throw new Sgp4WasmError(`${this.constructor.name} is not loaded. Call load() first.`);
    }

    return this.bindings_;
  }

  private async loadInternal_(options: Sgp4WasmLoadOptions): Promise<this> {
    const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
    const glueText = await this.resolveGlueText_(options.glue, isNode);
    const wasmBinary = await this.resolveWasmBinary_(options.wasm, isNode);

    let requireFn: unknown;
    let dirname: string | undefined;

    if (isNode) {
      /*
       * The glue's Node environment branch runs require("fs")/require("path")
       * and reads __dirname unconditionally, even though wasmBinary is
       * pre-seeded. Neither exists in an ES module scope, so both are
       * injected. The specifier is computed to keep bundlers from trying to
       * resolve node builtins in browser builds.
       */
      const nodeModule = await import(/* webpackIgnore: true */ 'node:module');

      requireFn = nodeModule.createRequire(import.meta.url);
      dirname = '.';
    }

    let markReady: () => void = () => undefined;
    let markFailed: (err: Error) => void = () => undefined;
    const runtimeReady = new Promise<void>((resolve, reject) => {
      markReady = resolve;
      markFailed = reject;
    });

    const seed: Partial<Sgp4PropEmscriptenModule> = {
      wasmBinary,
      onRuntimeInitialized: () => markReady(),
      onAbort: (reason: unknown) => markFailed(new Sgp4WasmError(`${this.constructor.name} wasm runtime aborted: ${reason}`)),
    };

    if (options.print) {
      seed.print = options.print;
    }
    if (options.printErr) {
      seed.printErr = options.printErr;
    }

    /*
     * The glue is classic non-modularized Emscripten output; evaluating it in
     * a function scope with a seeded `Module` parameter is the only way to
     * reach its internals from an ES module (see class TSDoc). `FS` is
     * captured because the VFS API is not exported on `Module`.
     */
    // eslint-disable-next-line no-new-func
    const evaluateGlue = new Function('Module', 'require', '__dirname', `${glueText};\nreturn { Module: Module, FS: FS };`) as (
      module: Partial<Sgp4PropEmscriptenModule>,
      requireFn: unknown,
      dirname: string | undefined,
    ) => { Module: Sgp4PropEmscriptenModule; FS: Sgp4PropFS };

    const { Module, FS } = evaluateGlue(seed, requireFn, dirname);

    await runtimeReady;

    this.module_ = Module;
    this.fs_ = FS;
    this.bindings_ = Sgp4WasmBase.buildBindings_(Module);

    return this;
  }

  private static buildBindings_(m: Sgp4PropEmscriptenModule): Sgp4WasmBindings {
    const num = 'number';

    return {
      tleAddSatFrLines: m.cwrap('TleAddSatFrLines_wasm', num, ['string', 'string']),
      tleAddSatsFrLines: m.cwrap('TleAddSatsFrLines_wasm', num, [num, num, num]),
      tleLoadFileVfs: m.cwrap('TleLoadFileVFS_wasm', num, ['string']),
      tleRemoveSats: m.cwrap('TleRemoveSats_wasm', num, [num, num, num]),
      sgp4InitSats: m.cwrap('Sgp4InitSats_wasm', num, [num, num, num]),
      sgp4RemoveSats: m.cwrap('Sgp4RemoveSats_wasm', num, [num, num, num]),
      sgp4Prop: m.cwrap('Sgp4Prop_wasm', num, [num, num, num, num, num, num]),
      sgp4PropPosVel: m.cwrap('Sgp4PropPosVel_wasm', num, [num, num, num, num, num, num]),
      sgp4PropDs50Utc: m.cwrap('Sgp4PropDs50Utc_wasm', num, [num, num, num, num, num, num]),
      sgp4PropDs50UtcPosVel: m.cwrap('Sgp4PropDs50UtcPosVel_wasm', num, [num, num, num, num, num, num]),
      initDynArr: m.cwrap('InitDynArr_wasm', num, [num]),
      reallocDynArr: m.cwrap('ReallocateDynArr_wasm', num, [num]),
      freeDynArr: m.cwrap('FreeDynArr_wasm', null, []),
      getDynArrSize: m.cwrap('GetDynArrSize_wasm', num, []),
      addSatToDynArr: m.cwrap('AddSatToDynArr_wasm', num, ['string', 'string']),
      sgp4PropDynArrPosVel: m.cwrap('Sgp4PropDynArrPosVel_wasm', null, [num, num, num, num, num, num]),
      sgp4PropDs50UtcDynArr: m.cwrap('Sgp4PropDs50UtcDynArr_wasm', null, [num, num, num, num, num, num]),
      sgp4PropDs50UtcDynArrPosVel: m.cwrap('Sgp4PropDs50UtcDynArrPosVel_wasm', null, [num, num, num, num, num, num]),
      setLogLevel: m.cwrap('SetLogLevel_wasm', num, [num]),
    } as unknown as Sgp4WasmBindings;
  }

  private async resolveGlueText_(source: Sgp4WasmLoadOptions['glue'], isNode: boolean): Promise<string> {
    if (source && typeof source === 'object' && 'text' in source) {
      return source.text;
    }

    /*
     * The {text} shape was returned above; the cast keeps the narrowing
     * working under strictNullChecks:false consumers (where `in` guards do
     * not narrow unions).
     */
    const resolved = this.resolveDefaultSource_(source as string | URL | undefined, this.defaultGlueFile_, isNode);

    if (isNode && !Sgp4WasmBase.isHttpUrl_(resolved)) {
      return await this.readNodeFile_(resolved, 'utf8') as string;
    }

    const response = await fetch(resolved);

    if (!response.ok) {
      throw this.missingArtifactError_(resolved.toString(), `HTTP ${response.status}`);
    }

    return response.text();
  }

  private async resolveWasmBinary_(source: Sgp4WasmLoadOptions['wasm'], isNode: boolean): Promise<Uint8Array | ArrayBuffer> {
    if (source instanceof Uint8Array || source instanceof ArrayBuffer) {
      return source;
    }

    const resolved = this.resolveDefaultSource_(source, this.defaultWasmFile_, isNode);

    if (isNode && !Sgp4WasmBase.isHttpUrl_(resolved)) {
      return await this.readNodeFile_(resolved, null) as Uint8Array;
    }

    const response = await fetch(resolved);

    if (!response.ok) {
      throw this.missingArtifactError_(resolved.toString(), `HTTP ${response.status}`);
    }

    return response.arrayBuffer();
  }

  private resolveDefaultSource_(source: string | URL | undefined, defaultFile: string, isNode: boolean): string | URL {
    if (source) {
      return source;
    }

    if (!isNode || typeof import.meta.url !== 'string') {
      throw new Sgp4WasmError(
        `${this.constructor.name}.load() requires explicit glue/wasm sources in this environment. ` +
        `Serve the ${defaultFile} artifact as a static asset and pass its URL via LoadOptions.`,
      );
    }

    /*
     * The non-literal first argument keeps bundlers from treating this as a
     * static asset reference to the (gitignored) artifact.
     */
    return new URL(defaultFile, import.meta.url);
  }

  private async readNodeFile_(source: string | URL, encoding: 'utf8' | null): Promise<string | Uint8Array> {
    const fsPromises = await import(/* webpackIgnore: true */ 'node:fs/promises');

    try {
      return encoding ? await fsPromises.readFile(source, encoding) : await fsPromises.readFile(source);
    } catch (err) {
      throw this.missingArtifactError_(source.toString(), (err as Error).message);
    }
  }

  private missingArtifactError_(location: string, cause: string): Sgp4WasmError {
    return new Sgp4WasmError(
      `Failed to load Sgp4Prop artifact at ${location} (${cause}). ` +
      'The Sgp4Prop WebAssembly artifacts are part of the license-restricted USSF Astro Standards ' +
      '"C Sgp4Prop WebAssembly" distribution available from space-track.org. Download it and place ' +
      `${this.defaultGlueFile_}/${this.defaultWasmFile_} in ootk's src/external/ directory, or pass explicit sources via LoadOptions.`,
    );
  }

  // Memory marshalling

  private withMalloc_<T>(bytes: number, fn: (ptr: number) => T): T {
    const m = this.module;
    const ptr = m._malloc(Math.max(bytes, 1));

    try {
      return fn(ptr);
    } finally {
      m._free(ptr);
    }
  }

  private withI64Array_<T>(values: readonly bigint[], fn: (ptr: number) => T): T {
    return this.withMalloc_(values.length * 8, (ptr) => {
      const m = this.module;

      values.forEach((value, i) => m.setValue(ptr + i * 8, BigInt(value), 'i64'));

      return fn(ptr);
    });
  }

  private withI32Array_<T>(values: readonly number[], fn: (ptr: number) => T): T {
    return this.withMalloc_(values.length * 4, (ptr) => {
      const m = this.module;

      values.forEach((value, i) => m.setValue(ptr + i * 4, value, 'i32'));

      return fn(ptr);
    });
  }

  private readI64Array_(ptr: number, count: number): bigint[] {
    const m = this.module;
    const out: bigint[] = [];

    for (let i = 0; i < count; i++) {
      out.push(m.getValue(ptr + i * 8, 'i64') as bigint);
    }

    return out;
  }

  /**
   * Allocates a result buffer of `count` doubles, runs `fn`, and copies the
   * buffer out. The HEAPF64 view is re-read from the module after the call
   * because wasm memory growth invalidates cached views.
   */
  private withF64Result_(count: number, fn: (ptr: number) => void): Float64Array {
    return this.withMalloc_(count * 8, (ptr) => {
      fn(ptr);

      return this.module.HEAPF64.slice(ptr / 8, ptr / 8 + count);
    });
  }

  private runKeysWithErrSat_(
    op: (keysPtr: number, numKeys: number, errSatPtr: number) => number,
    satKeys: readonly SatKey[],
    opName: string,
  ): void {
    this.withI64Array_(satKeys, (keysPtr) => this.withMalloc_(8, (errPtr) => {
      const m = this.module;

      m.setValue(errPtr, 0n, 'i64');
      const ret = op(keysPtr, satKeys.length, errPtr);

      if (ret !== 0) {
        const errKey = m.getValue(errPtr, 'i64') as bigint;

        throw new Sgp4WasmError(`${opName} failed (code ${ret}); offending satKey: ${errKey}`, ret);
      }
    }));
  }

  private propagateKeys_(
    op: (keysPtr: number, numKeys: number, start: number, propsPerSat: number, stepMin: number, resultPtr: number) => number,
    satKeys: readonly SatKey[],
    start: number,
    propsPerSat: number,
    stepMin: number,
    width: 8 | 11,
    opName: string,
  ): Float64Array {
    return this.withI64Array_(satKeys, (keysPtr) => this.withF64Result_(satKeys.length * propsPerSat * width, (resultPtr) => {
      const ret = op(keysPtr, satKeys.length, start, propsPerSat, stepMin, resultPtr);

      if (ret !== 0) {
        throw new Sgp4WasmError(`${opName} failed (code ${ret})`, ret);
      }
    }));
  }

  private propagateIndexes_(
    op: (idxPtr: number, numKeys: number, start: number, propsPerSat: number, stepMin: number, resultPtr: number) => void,
    indexes: readonly number[],
    start: number,
    propsPerSat: number,
    stepMin: number,
    width: 8 | 11,
  ): Float64Array {
    return this.withI32Array_(indexes, (idxPtr) => this.withF64Result_(indexes.length * propsPerSat * width, (resultPtr) => {
      op(idxPtr, indexes.length, start, propsPerSat, stepMin, resultPtr);
    }));
  }

  /**
   * Parses a copied-out result buffer into per-satellite, per-step records.
   * Records are 8 doubles wide (err, time, pos, vel) or 11 doubles wide
   * (plus lat, lon, height) — the distribution docs' "7 per record"
   * precondition is stale.
   */
  private parseRecords_(buf: Float64Array, numKeys: number, propsPerSat: number, width: 8 | 11): Sgp4WasmPosVel[][] {
    const results: Sgp4WasmPosVel[][] = [];

    for (let satIndex = 0; satIndex < numKeys; satIndex++) {
      const satRecords: Sgp4WasmPosVel[] = [];

      for (let stepIndex = 0; stepIndex < propsPerSat; stepIndex++) {
        const off = (satIndex * propsPerSat + stepIndex) * width;
        const record: Sgp4WasmPosVel = {
          err: buf[off],
          time: buf[off + 1],
          position: new Vector3D<Kilometers>(buf[off + 2] as Kilometers, buf[off + 3] as Kilometers, buf[off + 4] as Kilometers),
          velocity: new Vector3D<KilometersPerSecond>(
            buf[off + 5] as KilometersPerSecond, buf[off + 6] as KilometersPerSecond, buf[off + 7] as KilometersPerSecond,
          ),
        };

        if (width === 11) {
          (record as Sgp4WasmState).llh = {
            lat: buf[off + 8] as Degrees,
            lon: buf[off + 9] as Degrees,
            height: buf[off + 10] as Kilometers,
          };
        }
        satRecords.push(record);
      }
      results.push(satRecords);
    }

    return results;
  }
}
