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
import { Degrees, Kilometers, KilometersPerSecond } from '../types/types';

/**
 * An Astro Standards satellite key returned by the TLE tree.
 *
 * Format: `JJJddddddYYSSSSSSSE` (Julian day, fraction of day, epoch year,
 * 7-digit satellite number, element type). The value is 19 digits and exceeds
 * `Number.MAX_SAFE_INTEGER`, so it must remain a `bigint` end-to-end.
 */
export type SatKey = bigint;

/**
 * Logging levels accepted by `SetLogLevel_wasm`.
 */
export enum Sgp4WasmLogLevel {
  None = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

/**
 * Sources for the Emscripten glue script and wasm binary.
 *
 * In Node both default to files that sit next to this module
 * (`src/external/Sgp4Prop.js` / `.wasm`). In the browser there is no default;
 * both must be provided (typically URLs served as static assets).
 */
export interface Sgp4WasmLoadOptions {
  /** Glue JS source: filesystem path, URL, or preloaded text (`{ text }`). */
  glue?: string | URL | { text: string };
  /** Wasm binary source: filesystem path, URL, or raw bytes. */
  wasm?: string | URL | Uint8Array | ArrayBuffer;
  /** Forwarded to the Emscripten Module as its stdout hook. */
  print?: (msg: string) => void;
  /** Forwarded to the Emscripten Module as its stderr hook. */
  printErr?: (msg: string) => void;
}

/**
 * A single propagation record without geodetic coordinates
 * (8 doubles per record in wasm memory).
 *
 * Position and velocity are in the TEME (true equator, mean equinox) frame,
 * matching the output of the pure-TypeScript {@link Sgp4} class.
 */
export interface Sgp4WasmPosVel {
  /** SGP4 propagation error code for this record; 0 = success. */
  err: number;
  /**
   * Echo of the propagation time: minutes since TLE epoch for the mse
   * variants, or days since 1950 UTC for the ds50UTC variants.
   */
  time: number;
  /** TEME position in kilometers. */
  position: Vector3D<Kilometers>;
  /** TEME velocity in kilometers per second. */
  velocity: Vector3D<KilometersPerSecond>;
}

/**
 * A full propagation record including geodetic coordinates
 * (11 doubles per record in wasm memory).
 */
export interface Sgp4WasmState extends Sgp4WasmPosVel {
  /** Geodetic latitude/longitude/height. */
  llh: {
    lat: Degrees;
    lon: Degrees;
    height: Kilometers;
  };
}

/**
 * Result of the scratch-buffer fast path
 * ({@link Sgp4WasmBase.propagateOnePosVelFast}). Plain numbers in the TEME
 * frame (km, km/s) to avoid per-call allocations on hot paths.
 */
export interface Sgp4WasmFastPosVel {
  /** SGP4 propagation error code; 0 = success. */
  err: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
}

/**
 * Error thrown by the Sgp4Wasm wrapper classes.
 */
export class Sgp4WasmError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = 'Sgp4WasmError';
  }
}

/**
 * The subset of the evaluated Emscripten Module object used by the wrappers.
 * Exposed via {@link Sgp4WasmBase.module} as a raw escape hatch.
 */
export interface Sgp4PropEmscriptenModule {
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  /** Raw export used by the hot path to skip cwrap dispatch overhead. */
  _Sgp4PropPosVel_wasm(keysPtr: number, numKeys: number, startMse: number, propsPerSat: number, stepMin: number, resultPtr: number): number;
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown;
  ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown;
  setValue(ptr: number, value: number | bigint, type: string): void;
  getValue(ptr: number, type: string): number | bigint;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  HEAPF64: Float64Array;
  HEAP64: BigInt64Array;
  wasmBinary?: ArrayBuffer | Uint8Array;
  onRuntimeInitialized?: () => void;
  onAbort?: (reason: unknown) => void;
  print?: (msg: string) => void;
  printErr?: (msg: string) => void;
  calledRun?: boolean;
}

/**
 * The subset of Emscripten's internal FS object captured during glue
 * evaluation (it is not exported on the Module object). Needed for
 * `TleLoadFileVFS_wasm`, which reads `inFile` and writes `outFile` in the
 * virtual filesystem.
 */
export interface Sgp4PropFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string, opts: { encoding: 'utf8' }): string;
  readFile(path: string, opts?: { encoding: 'binary' }): Uint8Array;
  unlink(path: string): void;
  analyzePath(path: string): { exists: boolean };
}

/**
 * Human-readable messages for the negative return codes shared by the
 * dynamic-array management functions.
 */
export const SGP4_WASM_DYN_ARR_ERRORS: Record<number, string> = {
  [-1]: 'Error allocating space for the dynamic array',
  [-2]: 'Dynamic array is already initialized',
  [-3]: 'The requested size is too large',
  [-4]: 'The requested size is negative',
};

/**
 * Human-readable messages for the negative return codes of
 * `AddSatToDynArr_wasm`.
 */
export const SGP4_WASM_ADD_SAT_ERRORS: Record<number, string> = {
  [-1]: 'Dynamic array has not been allocated',
  [-2]: 'Dynamic array is out of space (call reallocDynArr)',
  [-3]: 'Failed to determine satKey from line 1',
  [-4]: 'Failed to parse line 1 or line 2',
};
