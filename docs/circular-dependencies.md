# Circular dependencies

ootk enforces an **acyclic-ratchet** in CI (`npm run circular`, see
`scripts/check-circular.mjs`). The build fails if the number of import cycles
rises above a baseline, so no *new* cycle can slip in, while the existing ones
can be driven down over time.

The madge check ignores type-only imports (`.madgerc` → `skipTypeImports`), so
every cycle below is a **runtime value cycle**.

## Baseline: 9 intentional cycles

All 9 are **method-body-only value cycles** between classes that convert into one
another by design. Every cross-reference lives inside a method body (never at
module top level and never across a `class … extends …`), so all modules finish
initializing before any cross-reference runs. They are runtime-safe in both the
ESM and CJS bundles, which is why the full test suite passes.

| # | Cycle | Why it exists |
| --- | --- | --- |
| 1 | `operations/Matrix ↔ operations/Vector` | `Vector.row()`/`.outer()` build a `Matrix`; `Matrix` methods return a `Vector`. |
| 2–3 | `operations/Vector3D ↔ operations/Matrix` (and `Vector`) | `Vector3D` builds rotation/row matrices; `Matrix` returns a `Vector3D`. |
| 4 | `time/EpochUTC ↔ time/EpochGPS` | `EpochUTC.toGPS()` builds an `EpochGPS`; `EpochGPS.getReference()` builds the 1980 `EpochUTC` epoch. |
| 5 | `coordinate/ClassicalElements ↔ coordinate/EquinoctialElements` | mutual `.toX()` element-set conversions. |
| 6–7 | `coordinate/frames ↔ coordinate/ClassicalElements` | `StateVector.toClassicalElements()` / `J2000.fromClassicalElements()` ↔ `ClassicalElements.toJ2000()`. |
| 8 | `coordinate/Geodetic ↔ coordinate/ITRF (frames)` | `Geodetic.toITRF()` / `ITRF.toGeodetic()`. |
| 9 | `objects/GroundObject → coordinate/Geodetic → objects/GroundStation` | `Geodetic.toGroundStation()`; `GroundStation extends GroundObject`. |

These are the fluent frame/element/epoch conversion APIs (`a.toB()`), idiomatic
for an astrodynamics library. Removing them would mean breaking the fluent API
(moving conversions into separate converter modules) — disproportionate for
cycles that are safe.

## The frame hierarchy is co-located on purpose

`coordinate/frames.ts` holds `StateVector` **and** its concrete subclasses
`J2000`, `ITRF`, `TEME` in one module. `StateVector.ts`, `J2000.ts`, `ITRF.ts`,
and `TEME.ts` are thin re-export shims that preserve the import paths.

This is deliberate. Previously each lived in its own file, and because the
frames convert into one another *and* every frame does `class X extends
StateVector`, the cross-module cycle crossed a top-level `extends`. That is the
one cycle shape that can throw at load time ("Cannot access 'StateVector' before
initialization" / "Class extends value undefined") if module-evaluation order is
unlucky — a failure tests would not catch. Co-locating them makes every `extends`
**intra-module** (StateVector is declared first), so the hazard cannot occur.

> A dependency-injection alternative (registering the converter lazily) was tried
> and reverted: it broke propagator paths that reach `toClassicalElements()`
> without loading `ClassicalElements`. Co-location is the robust fix and keeps the
> public API identical.

## Rules

- **Never** raise the baseline to unblock a build. A rising count means a new
  cycle — break it.
- When you remove a cycle, lower `BASELINE` in `scripts/check-circular.mjs` and
  update this table.
- Prefer `import type` for type-only references — the checker already ignores
  them, and they never cause load-order hazards.
- Keep the `StateVector` hierarchy co-located in `coordinate/frames.ts`. Do not
  re-split it into per-class files, or the extends-crossing hazard returns.
