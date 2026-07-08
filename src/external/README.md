# Sgp4Wasm / Sgp4XpWasm — USSF Astro Standards SGP4 WebAssembly wrappers

`Sgp4Wasm` (classic SGP4) and `Sgp4XpWasm` (SGP4-XP) wrap the official USSF
Astro Standards **"C Sgp4Prop WebAssembly"** distribution (v9.1.1.0), exposing
all 19 exported functions as a typed TypeScript API.

## Obtaining the artifacts (required)

The four Emscripten artifacts are **license-restricted and are not included
in, or distributed with, ootk**:

```
src/external/Sgp4Prop.js        # classic SGP4 glue script
src/external/Sgp4Prop.wasm      # classic SGP4 binary
src/external/Sgp4Prop.xp.js     # SGP4-XP glue script
src/external/Sgp4Prop.xp.wasm   # SGP4-XP binary
```

Download the "C Sgp4Prop WebAssembly" release (e.g.
`v9.1.1.0_C_Sgp4Prop_Wasm.zip`) from the Astro Standards section of
[space-track.org](https://www.space-track.org) (requires an account and
acceptance of the SGP4 license) and copy the four files from its `build/`
folder into this directory. They are gitignored and must never be committed,
published to npm, or otherwise redistributed.

Everything in this folder degrades gracefully when the artifacts are absent:
`load()` rejects with a descriptive error and the test suites skip.

## Usage

### Node (artifacts in this directory)

```ts
import { Sgp4Wasm } from 'ootk';

const sgp4 = await new Sgp4Wasm().load();
const satKey = sgp4.addSat(line1, line2); // bigint satKey
sgp4.initSats([satKey]);                  // required before propagation

const state = sgp4.propagateOne(satKey, 60); // 60 minutes past TLE epoch
// state.position/velocity are TEME km / km/s; state.llh is geodetic
```

### Browser (artifacts served as static assets)

```ts
const sgp4 = await new Sgp4Wasm().load({
  glue: `${baseUrl}wasm/sgp4prop/Sgp4Prop.js`,
  wasm: `${baseUrl}wasm/sgp4prop/Sgp4Prop.wasm`,
});
```

The glue script is a classic non-modularized Emscripten build; it is fetched
as text and evaluated via `new Function`, which requires `'unsafe-eval'` if a
Content-Security-Policy is in place.

### Swapping in for the pure-TypeScript propagator

`Sgp4WasmPropagator` (in `src/propagator/`) adapts a loaded instance to the
same `Propagator` interface as `Sgp4Propagator`, so consumers can switch
between the TypeScript and Astro Standards implementations:

```ts
const propagator = new Sgp4WasmPropagator(sgp4, tle);
const j2000 = propagator.propagate(EpochUTC.fromDateTime(date));
```

## API mapping

| Wasm export | Wrapper method |
| --- | --- |
| `TleAddSatFrLines_wasm` | `addSat(line1, line2): SatKey` |
| `TleAddSatsFrLines_wasm` | `addSats(tleText): SatKey[]` |
| `TleLoadFileVFS_wasm` | `loadTlesVfs(tleText): SatKey[]` |
| `TleRemoveSats_wasm` | `removeSats(satKeys)` |
| `Sgp4InitSats_wasm` | `initSats(satKeys)` |
| `Sgp4RemoveSats_wasm` | `uninitSats(satKeys)` |
| `Sgp4Prop_wasm` | `propagate(satKeys, startMse, propsPerSat, stepMin)` |
| `Sgp4PropPosVel_wasm` | `propagatePosVel(...)` |
| `Sgp4PropDs50Utc_wasm` | `propagateDs50Utc(satKeys, ds50Utc, propsPerSat, stepMin)` |
| `Sgp4PropDs50UtcPosVel_wasm` | `propagateDs50UtcPosVel(...)` |
| `InitDynArr_wasm` | `initDynArr(size)` |
| `ReallocateDynArr_wasm` | `reallocDynArr(size)` |
| `FreeDynArr_wasm` | `freeDynArr()` |
| `GetDynArrSize_wasm` | `dynArrSize` (getter) |
| `AddSatToDynArr_wasm` | `addSatToDynArr(line1, line2): number` |
| `Sgp4PropDynArrPosVel_wasm` | `propagateDynArrPosVel(indexes, startMse, ...)` |
| `Sgp4PropDs50UtcDynArr_wasm` | `propagateDs50UtcDynArr(indexes, ds50Utc, ...)` |
| `Sgp4PropDs50UtcDynArrPosVel_wasm` | `propagateDs50UtcDynArrPosVel(...)` |
| `SetLogLevel_wasm` | `setLogLevel(level)` |

Raw escape hatches: `instance.module` (Emscripten Module — `_malloc`,
`ccall`/`cwrap`, heap views) and `instance.fs` (virtual filesystem).

## Notes

- **satKeys are `bigint`.** The Astro Standards satKey format is
  `JJJddddddYYSSSSSSSE` (19 digits) which exceeds `Number.MAX_SAFE_INTEGER`.
  Never convert to `number` or pass through `JSON.stringify`.
- **Time systems.** The `mse` propagation variants take minutes since each
  TLE's epoch; the `ds50UTC` variants take days since 1950 UTC
  (Julian date − 2433281.5, so 1950-01-01T00:00Z = 1.0). Use
  `Sgp4WasmBase.toDs50Utc(epoch)`.
- **Record layout.** Each propagation record is 8 doubles
  (`[err, time, pos×3, vel×3]`) or 11 doubles (plus `[lat, lon, height]`)
  in wasm memory. A nonzero per-record `err` does not throw (batch calls can
  partially succeed); a nonzero function-level return code does.
- **Output frame** is TEME (km, km/s), matching the pure-TypeScript `Sgp4`
  class.
- Each wrapper instance owns an isolated wasm runtime (its own TLE tree and
  dynamic array). `load()` is idempotent per instance; `Sgp4Wasm` and
  `Sgp4XpWasm` instances can coexist.
