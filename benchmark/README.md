# SGP4 benchmark: ootk vs satellite.js

Measures three phases over the real ~25k-object space-track snapshot in
`test/sgp4/full-catalog/`:

1. **init** — satrec initialization (`Sgp4.createSatrec` vs `twoline2satrec`)
2. **prop** — pure SGP4 propagation (`sgp4(satrec, tsince)`), no transforms
3. **e2e** — the exact scenario from [ootk issue #31](https://github.com/thkruz/ootk/issues/31):
   look angles for the whole catalog from one ground site at one instant
   (`groundObject.rae(sat, date)` vs the reporter's `propagate` +
   `eciToEcf` + `ecfToLookAngles` pipeline with `gstime` hoisted)
4. **micro** — every standalone function both libraries share, over a
   deterministic seeded dataset built without either library (25k calls per
   round): `gstime`, `eci↔ecf`, `eci→geodetic`, `geodetic→ecf`,
   `ecf→look angles`, `dopplerFactor`

```sh
npm run bench          # rebuilds dist/ first (ootk is benched from dist, like a consumer)
npm run bench:only     # skip the rebuild
node benchmark/run.mjs 5   # custom trial count (default 3)
```

## Why the numbers are trustworthy

- **Fresh Node process per library per trial** (`worker.mjs` benches exactly one
  library). This matters: running both libraries in one process lets the first
  library's JIT type feedback and GC pressure distort the second's numbers.
- **Alternating run order** across trials cancels CPU warm-up/thermal drift.
- **Warmup rounds** before timing, then 10 timed rounds per trial; the report
  pools all rounds and leads with the **median** (min and stddev shown too).
- **Checksum parity**: each worker accumulates the sum of all position
  components (phase 2) or az+el radians (phase 3) inside the timed loop. This
  blocks dead-code elimination *and* proves both libraries computed
  numerically identical results (the report warns if the relative delta
  exceeds 1e-9, or if error counts differ).

Known cross-library behavior differences the harness accounts for:

- The e2e observer sits at a nonzero altitude (0.1 km) on purpose: elevation
  parity with satellite.js doubles as a regression test for the `lla2sez`
  fix that made observer altitude flow into the SEZ frame.
- For long-decayed objects propagated months past epoch, ootk flags error 6
  and returns null while satellite.js returns garbage positions (up to 1e15
  km) with `error === 0`, so the e2e success sets differ by design. The
  parity warning only fires when the success counts match but checksums
  still diverge.

## Results snapshot (2026-07, ootk v7 vs satellite.js 7.0.1, Node 22)

| Phase | ootk | satellite.js | ratio |
| --- | --- | --- | --- |
| satrec init (25,551 TLEs, one-time) | 164 ms | 139 ms | 1.18x |
| SGP4 propagate | 391 ns/call | 397 ns/call | 0.99x |
| e2e issue #31 look-angle sweep | 1059 ns/call | 1058 ns/call | 1.00x |
| gstime | 13 ns | 13 ns | 1.05x |
| eci → ecf / ecf → eci | 16 ns | 16 ns | ~1.00x |
| eci → geodetic | 796 ns | 810 ns | 0.98x |
| geodetic → ecf | 34 ns | 35 ns | 0.99x |
| ecf → look angles | 60 ns | 57 ns | 1.05x |
| dopplerFactor | 10 ns | 10 ns | 0.98x |

SGP4 output is **bit-identical** between the libraries (checksum relative
delta 0), and every shared transform matches within float noise. Same speed —
but ootk also validates its outputs (decayed objects return an error instead
of a garbage state vector) and layers on what satellite.js doesn't have:
initial orbit determination, maneuver planning, conjunction assessment,
covariance, numerical propagation with force models, sensor/observation
modeling, orbit design, Sun/Moon ephemerides, and proper time systems.

## Interpreting

`ratio > 1.00x` = ootk slower. `per call (ns)` is the cost of a single
`sgp4(satrec, tsince)` call, median round time divided by calls per round
(25,551 satrecs x 4 time offsets spread over a day, so near-earth and
deep-space paths both run).
