# Migrating to ootk 8

ootk 8.0.0 is a correctness release. A full audit of the library found results that were
plausible but wrong (units, frames, reference radii, probability of collision), and fixing them
changes observable numbers and a few API contracts. This guide lists every change an external
consumer can see, with before and after code, followed by a checklist.

Three kinds of change appear below:

- **Compile-time**: a name or option was renamed or removed. TypeScript reports these.
- **Runtime contract**: the call still compiles, but it now throws, returns `NaN`/`null`, or
  means something different.
- **Numbers**: the API is unchanged and the returned values are now correct. Re-check any
  threshold, colour band or snapshot that was tuned against the old output.

## 1. `mag2db` renamed to `pow2db` (compile-time)

`mag2db` computed `10 log10(x)`, which is the power-ratio conversion (MATLAB's `mag2db` is
`20 log10`). It is now named for what it does. There is no alias.

<!-- doccheck:skip -->
```typescript
// v7
import { mag2db } from 'ootk';
const rcsDbsm = mag2db(rcsM2);
```

```typescript
// v8
import { pow2db } from 'ootk';

const rcsM2 = 10;
const rcsDbsm = pow2db(rcsM2); // 10 dBsm; pow2db(100) is 20
```

## 2. Lambert `posigrade` renamed to `shortWay` (compile-time, silent if missed)

The `LambertIOD.estimate` option selects the transfer angle, not the sense of motion: `true`
sweeps the angle between the two position vectors that is below 180 deg, `false` sweeps
360 deg minus that angle. A retrograde transfer is obtained by choosing the sweep that matches
the desired motion (see `LambertIOD.useShortPath`). There is no alias.

The options argument is a plain object, so a leftover `{ posigrade: false }` in untyped code
(or code that builds the object elsewhere) is silently ignored and the solver falls back to the
default short way. Search your code for `posigrade` after upgrading.

<!-- doccheck:skip -->
```typescript
// v7
const state = lambert.estimate(p1, p2, t1, t2, { posigrade: false, nRev: 0 });
```

```typescript
// v8
import { EpochUTC, Kilometers, LambertIOD, Seconds, Vector3D } from 'ootk';

const lambert = new LambertIOD();
const p1 = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
const p2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 0 as Kilometers);
const t1 = EpochUTC.fromDateTime(new Date('2026-01-01T00:00:00Z'));
const t2 = t1.roll(1800 as Seconds);

const longWay = lambert.estimate(p1, p2, t1, t2, { shortWay: false, nRev: 0 });

if (longWay === null) {
  console.log('No Lambert solution');
}
```

`estimate` returns `null` (not `undefined`) when the solver fails. `GoodingIOD.estimate` and
`GoodingIOD.solve` renamed their last positional parameter from `direction` to `shortWay`
with the same meaning, so positional callers need no change. `ModifiedGoodingIOD` keeps its
`direction` option, which is passed to Gooding as `shortWay`.

<a id="zenith-roll-convention"></a>

## 3. Zenith-pointing field of view: roll convention (runtime contract)

This is the only change that can silently move a sensor footprint.

### What changed

`FieldOfView` places an elliptical cone in a frame built from the boresight azimuth, elevation
and roll. Away from the zenith the frame is unchanged. At the zenith (`boresightEl` = 90) v7
measured roll from North, which made the frame jump discontinuously: for a boresight azimuth
of 90 deg the major axis rotated by 90 deg between elevation 89.99999 and 90.

In v8 the zenith frame is the limit of the general branch, so it is continuous. Roll at the
zenith is now measured from the boresight azimuth line:

> **Roll 0 = major axis along the boresight azimuth** (both directions, since the ellipse is
> symmetric). A fan pointing straight up, facing east (`boresightAz` 90) with roll 0 is an
> east-west fan.

Non-zenith configurations (any `boresightEl` below 90) and circular cones (`minorHalfAngle`
equal to `halfAngle`, or omitted) are not affected.

### Migration formula (zenith, non-circular only)

```text
newRoll = (oldRoll - boresightAz - 180) mod 360
```

Because the ellipse is symmetric under a 180 deg rotation, `(oldRoll - boresightAz) mod 180`
is equivalent. `FieldOfView.migrateZenithRollFromV7(params)` applies the formula only when
`boresightEl` is 90 (or omitted, since 90 is the default) and the cone is not circular, and
returns every other configuration as an unchanged copy, so it is safe to run over a whole
sensor catalog once.

### Worked example: Space Fence (Kwajalein)

The v7 configuration for the Space Fence is a 2 deg wide fan through the zenith, oriented
east-west, written as boresight azimuth 270, elevation 90, roll 90:

```text
oldRoll = 90, boresightAz = 270
newRoll = (90 - 270 - 180) mod 360 = (-360) mod 360 = 0
```

So the v8 configuration is roll 0, which reads naturally: the fan lies along the boresight
azimuth line (270/90, west-east).

```typescript
import { Degrees, FieldOfView, FieldOfViewParams, Kilometers } from 'ootk';

const v7Params: FieldOfViewParams = {
  boresightAz: 270 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 80 as Degrees,
  minorHalfAngle: 1 as Degrees,
  rollAngle: 90 as Degrees, // v7 meaning: measured from North
  minRange: 50 as Kilometers,
  maxRange: 3057.754 as Kilometers,
  minElevation: 10 as Degrees,
};

const v8Params = FieldOfView.migrateZenithRollFromV7(v7Params);

console.log(v8Params.rollAngle); // 0

const fence = new FieldOfView(v8Params);
const rng = 1000 as Kilometers;

console.log(fence.contains({ az: 270 as Degrees, el: 45 as Degrees, rng })); // true (west, along the fan)
console.log(fence.contains({ az: 90 as Degrees, el: 45 as Degrees, rng })); // true (east, along the fan)
console.log(fence.contains({ az: 0 as Degrees, el: 45 as Degrees, rng })); // false (north, across the fan)
```

Passing the unmigrated v7 parameters (roll 90) to v8 produces a north-south fan: the 270/45
direction is rejected and 0/45 is accepted. That is the failure mode to look for.

Any configuration where `rollAngle` equals `boresightAz` at the zenith (a fan lying along its
own boresight azimuth) migrates to roll 0.

### Default zenith frames are rotated 180 deg

For azimuth 0 and roll 0 the v8 frame is the v7 frame rotated 180 deg about the boresight
(`u` and `v` both change sign). Containment is identical, but `directionAt(t)` now returns what
v7 returned at `t + 180 deg`, so boundary samples start on the opposite side. This is a
rotation, not a reflection, so the winding order of a rendered boundary is unchanged. Code that
compares boundary samples one-to-one with stored v7 output should compare them as an unordered
set, or shift the parameter by 180 deg.

## 4. `FieldOfView` requires `halfAngle` (runtime contract)

v7 accepted a missing or `NaN` `halfAngle`, which produced a sensor that saw nothing except the
exact boresight. v8 throws a `ValidationError` ("Half angle must be between 0 and 90 degrees")
unless `halfAngle` is finite and in (0, 90]. Every sensor class (`PhasedArrayRadar`,
`MechanicalRadar`, `OpticalSensor`, `PassiveRFSensor`, `LaserRangingSensor`, `TtcAntenna`)
passes its `fieldOfView` through the same validation.

<!-- doccheck:skip -->
```typescript
// v7: compiled with a cast, silently saw nothing
const fov = new FieldOfView({ minRange: 0, maxRange: 5000 } as FieldOfViewParams);
```

```typescript
// v8
import { Degrees, FieldOfView, Kilometers } from 'ootk';

const fov = new FieldOfView({
  boresightAz: 0 as Degrees,
  boresightEl: 90 as Degrees,
  halfAngle: 90 as Degrees, // required
  minRange: 0 as Kilometers,
  maxRange: 5000 as Kilometers,
});
// or: FieldOfView.hemisphere(0 as Kilometers, 5000 as Kilometers)
```

## 5. `fovFromSwathWidth` returns `NaN` beyond the horizon (runtime contract)

A swath wider than the geometric horizon allows, `2 R acos(R / (R + h))`, has no line of sight.
v7 returned a plausible but wrong angle (6000 km at 500 km altitude gave 135 deg, which maps
back to a 3978 km swath). v8 returns `NaN`, as it does for negative widths and non-positive
altitudes. Guard the result before building a field of view from it.

```typescript
import { fovFromSwathWidth } from 'ootk';

const fullFovRad = fovFromSwathWidth(6000, 500);

if (Number.isNaN(fullFovRad)) {
  // clamp the request to the horizon, or reject it
}
```

## 6. CDM files are read and written in metres (numbers)

CCSDS 508.0-B-1 gives `MISS_DISTANCE` and `RELATIVE_POSITION_*` in m, `RELATIVE_SPEED` and
`RELATIVE_VELOCITY_*` in m/s, and the covariance in m², m²/s and m²/s². v7 read and wrote them
as km, km/s and km², so a real 715 m miss parsed as 715 km and exported files were rejected by
compliant consumers.

In v8, `CdmParser.parse` converts the file's metres into ootk's km-based units, and
`CdmExporter.export` converts back and writes `[m]`, `[m/s]` and `[m**2]` tags. A value with an
explicit `[km]` tag (as v7 wrote) is still honoured. The parsed fields keep their km types:

```typescript
import { CdmParser } from 'ootk';

declare const cdmText: string;

const cdm = CdmParser.parse(cdmText);
const missKm = cdm.relativeData.MISS_DISTANCE; // km: a file value of 715 [m] is 0.715
```

If you post-processed v7 parse results by dividing by 1000 to undo the bug, remove that step.

`RELATIVE_POSITION_R/T/N` are signed in the CDM, and v8 keeps the sign everywhere:
`ConjunctionEvent.radialDistance`, `intrackDistance` and `crosstrackDistance` are signed
components in the primary RIC frame (v7 stored absolute values and so exported `|T|` for a
negative in-track miss). Display code that expects magnitudes needs `Math.abs()`. The exporter
writes position and velocity from one source, and `OBJECT_DESIGNATOR` defaults to the catalog
number (`CATALOG_NAME = SATCAT`) with the COSPAR id in `INTERNATIONAL_DESIGNATOR`; v7 wrote the
COSPAR id as `OBJECT_DESIGNATOR`.

`CdmParser.parse` throws `ParseError` when `CCSDS_CDM_VERS`, `CREATION_DATE` or `ORIGINATOR` is
missing; v7 filled in defaults.

## 7. OEM files without `DATA_START` (runtime contract)

Spec-compliant OEM files (Orekit, GMAT, Space-Track, and ootk's own `OdmExporter`) have no
`DATA_START` keyword: the data lines follow `META_STOP`. v7 threw "no data blocks" on them. v8
accepts both forms. `COMMENT` lines, `TIME_SYSTEM`, `REF_FRAME` and `CENTER_NAME` are now read.

`EphemerisSatellite.fromParsedOem` now honours `REF_FRAME`:

- `EME2000`, `J2000`, `ICRF`, `GCRF`: treated as J2000.
- `TEME`: kept as TEME (v7 threw on every query for a TEME OEM).
- Earth-fixed (`ITRF`, `ITRF-93`, `ITRF97`, `ITRF2000`, `ITRF2008`, `ITRF2014`, `ITRF2020`,
  `ITRF1993`, `ECEF`): rotated into J2000 state by state.
- Anything else (for example `TOD`, `MOD`, `RTN`): rejected with an error. v7 silently treated
  these as J2000.

## 8. `cappedScreeningCovarianceFromTle` returns a real RIC covariance (numbers)

v7 wrote 1-sigma values (km) onto the diagonal of a matrix whose off-diagonals were variances,
swapped the in-track and cross-track slots, and labelled the result ECI.

v8 returns a `StateCovariance` in the **RIC frame** whose diagonal holds **variances** (km² for
R, I, C; km²/s² for the rates) in **R, I, C order**. The confidence level `k` scales the matrix
by `k²`. Each position sigma is capped by scaling its row and column, so a capped variance is
exactly `cap²` and the correlations are preserved.

The `caps` argument is still 1-sigma caps in km, but in **R, I, C order** (radial, in-track,
cross-track). The default changed from `[1200, 1000, 5000]` (v7 order R, C, I) to
`[35, 71, 32]`. v7 stored sigmas where every consumer read variances, so the caps that actually
bound in v7 were sqrt(1200) = 34.6 km radial, sqrt(5000) = 70.7 km in-track and
sqrt(1000) = 31.6 km cross-track; v8 keeps that behaviour with caps that are real 1-sigma values.
Passing `[1200, 5000, 1000]` in v8 means 1200 km sigmas, which almost never bind.

The fallback covariance (unparsable TLE or degenerate diagonal) holds `cap²` position variances
and `(cap / 1000 s)²` velocity variances, so the 6x6 is non-singular. v7 left the velocity block
zero.

<!-- doccheck:skip -->
```typescript
// v7: caps in R, C, I order; diagonal held sigmas in km
const cov = cappedScreeningCovarianceFromTle(l1, l2, 3, [1200, 1000, 5000]);
const radialSigmaKm = cov.matrix.elements[0][0];
```

```typescript
// v8: caps in R, I, C order; diagonal holds variances in km^2
import { cappedScreeningCovarianceFromTle } from 'ootk';

declare const l1: string;
declare const l2: string;

const cov = cappedScreeningCovarianceFromTle(l1, l2, 3, [35, 71, 32]);
const radialSigmaKm = Math.sqrt(cov.matrix.elements[0][0]);
const inTrackSigmaKm = Math.sqrt(cov.matrix.elements[1][1]);
```

Code that passes the result straight into `ConjunctionAssessment` needs no change, but its
probability of collision moves (see the next section).

## 9. Probability of collision and covariance aging (numbers)

- The 2D Pc in `ProbabilityOfCollision.calculate` (the private `chanPc2D` in v7) was wrong in
  both branches: off by 4x to 9x in either direction, and capped at 0.5 when the miss was
  inside the hard body. v8 integrates the 2D Gaussian over the hard-body disc in the
  covariance principal axes (closed-form inner integral, adaptive Gauss-Kronrod outer
  integral; Foster and Estes 1992, Alfano 2005), which is exact to about 1e-10 relative for
  anisotropic covariances too. For an isotropic covariance it equals Chan's series.
- `ConjunctionAssessment` rotates the secondary covariance into the primary's RIC frame before
  combining. v7 summed two RIC matrices expressed in different frames.
- `CovarianceSample` ages the TLE against the epoch of the state being evaluated. v7 used
  `new Date()`, which inflated sigmas for historical analysis by orders of magnitude and made
  results depend on the wall clock.
- `CovarianceRealism` labels are no longer inverted: a consistency ratio below 0.5
  (covariance too large) is "pessimistic", above 3 is "optimistic".

Expect every Pc you compute to change. Thresholds such as 1e-4 keep their meaning; they now
apply to correct numbers.

## 10. Screening filter pad (numbers and compile-time)

The apogee/perigee coarse filter now uses geocentric radii with a radial pad (default
`DEFAULT_SHELL_PAD_KM`, 10 km): a pair is rejected only when one shell lies entirely above the
other by more than the pad. Candidate counts grow slightly.

- `ScreeningFilter.shellsOverlap(shell1, shell2, pad?)` takes the pad as its third argument.
- `ScreeningFilter.filterCandidates(primary, secondaries, pad?)`: the third argument was the
  boolean `useInclinationFilter`; it is now the pad in km.
- `CatalogScreener` options: `useInclinationFilter` is removed (it never filtered anything) and
  `shellPad` is added.
- `ScreeningFilter.shellsOverlapWithInclination` is removed.

```typescript
import { CatalogScreeningOptions, EpochUTC, Kilometers } from 'ootk';

const options: CatalogScreeningOptions = {
  startTime: EpochUTC.fromDateTime(new Date('2026-01-01T00:00:00Z')),
  endTime: EpochUTC.fromDateTime(new Date('2026-01-02T00:00:00Z')),
  shellPad: 20 as Kilometers, // widen the coarse filter (default 10 km)
};
```

## 11. `estimateRcs` returns m²; `estimateVmagFromRcs` fixed (numbers)

`estimateRcs(length, width, height, shape)` was documented as m² but returned a length in
metres. It now returns the orientation-averaged projected area in m² (surface area / 4, which
for a sphere of diameter d is pi d² / 4). A 2 m sphere is 3.14 m². Re-tune any colour bands or
size classes built on the old output.

`estimateVmagFromRcs(rcs, albedo?)` returns a standard magnitude (1000 km range, 90 deg phase
angle) for a Lambertian sphere of geometric albedo `albedo` (default 0.2). With the default,
`m = 7.93 - 2.5 log10(rcs)`: a 1 m² object is about +7.9, where v7 returned -1.3 (about 9
magnitudes too bright). Each factor of 2.5 in albedo moves the result by 1 magnitude. The
result is clamped to [-5, 15], and `null` is returned for a non-positive RCS.

```typescript
import { estimateRcs, estimateVmagFromRcs } from 'ootk';

const rcsM2 = estimateRcs(2, 2, 2, 'sphere'); // 3.14 m^2
const vmag = estimateVmagFromRcs(1); // about 7.93
const darkerVmag = estimateVmagFromRcs(1, 0.1); // about 8.69
```

## 12. Apogee and perigee are altitudes above 6378.137 km (numbers)

Apogee and perigee altitudes now use the WGS-84 equatorial radius, 6378.137 km, everywhere.
New `apogeeRadius` and `perigeeRadius` give the geocentric distances.

| Property | v7 | v8 |
|---|---|---|
| `Satellite.apogee` / `perigee` | altitude above 6371 km | altitude above 6378.137 km (7.137 km lower) |
| `ClassicalElements.apogee` / `perigee` | altitude above `Earth.radiusMean` | altitude above 6378.137 km |
| `Tle.apogee` / `perigee` | **geocentric radius** | altitude above 6378.137 km |
| `apogeeRadius` / `perigeeRadius` | (did not exist) | geocentric radius a (1 ± e) |

```typescript
import { Satellite, TleLine1, TleLine2 } from 'ootk';

const iss = new Satellite({
  tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
  tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
});

console.log(iss.apogee); // about 420.5 km above the equatorial radius
console.log(iss.apogeeRadius); // about 6798.6 km from the Earth's center
```

If you used `Tle.apogee` as a radius, switch to `Tle.apogeeRadius`.

`Tle` and `Satellite` now derive the semimajor axis from the mean motion with the same mu, the
WGS-72 value 398600.8 km³/s² that SGP4 uses (`Tle.WGS72_MU`). `Tle.semimajorAxis`, `apogee` and
`perigee` grow by about 2 m against v7, which used 398600.4418 there.

## 13. `Matrix.inverse` throws on singular input (runtime contract)

v7 `inverse()` had no pivoting and no singularity check: it inverted some well-conditioned
matrices wrongly and returned garbage for singular ones. v8 uses Gauss-Jordan elimination with
partial pivoting and equilibration, and throws `SingularMatrixError` when the matrix is
singular to working precision or contains non-finite values. `tryInverse()` returns `null`
instead of throwing.

```typescript
import { Matrix, SingularMatrixError } from 'ootk';

const m = new Matrix([
  [1, 2],
  [2, 4],
]);

const inv = m.tryInverse(); // null

try {
  m.inverse();
} catch (e) {
  if (e instanceof SingularMatrixError) {
    // handle the degenerate geometry
  }
}
```

`LevenbergMarquardtOD`, `BatchLeastSquaresOD`, `Hill` and `CovarianceRealism` now surface a
singular normal matrix as an error instead of continuing with a wrong inverse. Wrap orbit
determination calls on sparse or degenerate observation sets in `try`/`catch`.

## 14. `BatchLeastSquaresResult.converged` (new field)

`BatchLeastSquaresOD.solve()` used to return the last iterate silently when `maxIter` ran out.
The result now has `converged`, true only when the RMS tolerance was met. The returned state,
RMS and covariance also now belong to the same iterate.

```typescript
import { BatchLeastSquaresOD } from 'ootk';

declare const od: BatchLeastSquaresOD;

const result = od.solve({ tolerance: 1e-3, maxIter: 50 });

if (!result.converged) {
  console.warn(`BLS did not converge, weighted RMS ${result.rms}`);
}
```

`LevenbergMarquardtOD` also fixed its convergence test. v7 required the noise-weighted RMS to
fall below `epsilon` (1e-6), which never happens on noisy data (the RMS of a correct fit is
about 1). v8 also accepts convergence when the undamped Gauss-Newton step would lower the
weighted RMS by at most `epsilon * max(RMS, 1)`.

## 15. `ContactScheduler`: one contact per satellite (runtime contract)

New option `oneContactPerSatellite` (default `true`): a satellite is in at most one contact at
any instant, so it is never scheduled at two stations over the same interval. v7 could
double-count coverage this way even with `allowHandover: false`. Set it to `false` for
deliberate simultaneous multi-station contacts (for example multistatic tracking).
`allowHandover` keeps its meaning (split overlapping windows at the midpoint).

Priority ordering is now strictly lexicographic: satellite priority, then the strategy's
quality measure, then station priority. v7 used `priority * 1000 + quality`, so a long contact
could outrank a higher priority. The station concurrency limit counts peak simultaneous
contacts rather than every overlapping one.

```typescript
import { ContactScheduler, GroundStation, Satellite } from 'ootk';

declare const stations: GroundStation[];
declare const satellites: Satellite[];

const contacts = ContactScheduler.schedule(stations, satellites, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'), {
  oneContactPerSatellite: false, // allow multistatic tracking
});
```

## 16. `Beacon` transmission windows (runtime contract)

`getNextTransmission(afterDate)` returns the next window that starts strictly after
`afterDate`. v7 returned the window in progress. The new `getCurrentTransmission(date)` returns
the window containing `date` (start <= date < end), or `null` when the beacon is silent or
`date` is before the epoch. `getTransmissionsInRange` and `getTransmissionCount` now use the
same half-open windows and respect the epoch phase.

<!-- doccheck:skip -->
```typescript
// v7: often the window already in progress
const win = beacon.getNextTransmission(now);
```

```typescript
// v8
import { Beacon } from 'ootk';

declare const beacon: Beacon;
const now = new Date();

const current = beacon.getCurrentTransmission(now); // in progress, or null
const next = beacon.getNextTransmission(now); // starts after now
```

## 17. Access windows (numbers)

- `AccessCalculator.getNextAccess(observer, target, after)` now admits a pass that starts
  exactly at `after`. A pass already in progress at `after` is still skipped.
- Rise and set edges are bisected to 1 ms after the coarse step brackets them; `stepMs` is the
  coarse step only. Zero-length windows are no longer emitted.

## 18. `ForceModel.setAtmosphericDrag` and F10.7 (numbers)

The signature is `setAtmosphericDrag(mass, area, coeff = 2.2, cosine = 4, f107 = 150)`.

- `cosine` is the Harris-Priester exponent n in cos^n(psi / 2) (2 for low-inclination, 6 for
  polar orbits per Montenbruck and Gill), not the cosine of an angle.
- `f107` (solar radio flux in SFU) is an ootk extension to Harris-Priester. v8 applies it as a
  multiplicative factor on the whole density, normalised to 1 at F10.7 = 150 (the mean-activity
  table). v7 scaled only the diurnal bulge term, which made the day/night bulge vanish at low
  activity and left the overall density unchanged.
- **Default drag changed.** At the default F10.7 = 150, v7 scaled the Harris-Priester bulge term
  by 0.444; v8 uses standard Harris-Priester, so the diurnal bulge is 2.25x larger (1 / 0.444) at
  default settings. Re-baseline decay, lifetime and drag-sensitive orbit determination results.
- Between 120 and 200 km the F10.7 factor ramps linearly from 1 to its 200 km value, because the
  thermosphere density ratio behind it inverts below about 190 km.

`setEarthGravity`, `setThirdBodyGravity`, `setSolarRadiationPressure` and
`setAtmosphericDrag` all return the force model, so the calls chain.

```typescript
import { ForceModel } from 'ootk';

const forces = new ForceModel()
  .setEarthGravity(8, 8)
  .setAtmosphericDrag(500, 4, 2.2, 4, 180);
```

## 19. `azel2uv` and `uv2azel` use direction cosines (runtime contract)

v7 computed `u = sin((delta az / beamwidth) * pi / 2)`, treating the beamwidth as the edge of
sine space, so the result depended on the beamwidth and was not a direction cosine. v8 returns
the standard phased-array sine-space pair:

```text
u = cos(el) sin(az),  v = sin(el)        (az, el off a horizontal boresight)
el = asin(v),  az = atan2(u, sqrt(1 - u^2 - v^2))
```

For a tilted face pass the boresight elevation as the fourth argument,
`azel2uv(az, el, coneHalfAngle, boresightEl)`: the line of sight is projected onto the face frame
(right, up, boresight), so u, v and the off-boresight angle are exact. `PhasedArrayRadar` and
`rae2ruv` do this for each face.

The third parameter is now `coneHalfAngle` (radians, default pi / 2): a bound on the true
angle off boresight, acos(w), beyond which the functions throw a
`ValidationError`. It no longer scales the result. Callers that passed a beamwidth as the third
argument must drop it or pass the cone limit they actually mean.

```typescript
import { azel2uv, Radians } from 'ootk';

const { u, v } = azel2uv((10 * Math.PI / 180) as Radians, 0 as Radians); // u = 0.1736 (sin 10 deg), v = 0
```

## 20. `MechanicalRadar.scanPeriod` uses the azimuth span (numbers)

`scanPeriod` is the azimuth span of the field of view divided by `scanRate`, as documented.
v7 divided the cone width instead, which halved the period for a hemisphere. The span is 360
deg when the field of view contains the zenith, `2 asin(sin(halfAngle) / cos(boresightEl))`
for a circular cone, and is sampled from the boundary for an elliptical cone.

## 21. `DynamicGroundObject.positionHistory` (runtime contract)

The LLA trail of a moving ground object is `positionHistory`. v7 returned it from `history`,
shadowing the base-class `history` (which holds TEME states) with a different type. In v8
`DynamicGroundObject.history` is the inherited `History<HistoricalState>` getter and is always
`null` for a ground object.

<!-- doccheck:skip -->
```typescript
// v7
const trail = vehicle.history;
```

```typescript
// v8
import { DynamicGroundObject } from 'ootk';

declare const vehicle: DynamicGroundObject;

const trail = vehicle.positionHistory; // History<LlaVec3<Degrees, Kilometers>> | null
```

Look angles from a moving observer (`Satellite.rae`, `az`, `el`, `rng`, `toRae`) now use the
observer's interpolated position at the requested time. v7 used the first waypoint.

`Satellite` history now records only direct `eci()` calls. The propagations made inside
`rae()`, `toRae()`, `lla()` and access sweeps are no longer recorded.

## 22. `Star.rae` and `Star.eci` (numbers)

`Star.rae(lla, date)` returns geometric azimuth and elevation (no atmospheric refraction),
matching the geometric elevations `Satellite.rae()` returns. The J2000 catalog position is
precessed and nutated to the date. The default observer is now (0, 0, 0); v7 defaulted to
latitude 180, which threw. `Star.eci()` places the star 250000 km from the Earth's center along
its catalog direction, rotated from J2000 to TEME; it is observer-independent. v7 was correct
only for an observer at (0, 0).

## 23. Moon and planet RA/Dec are geocentric J2000 (numbers)

`CelestialBody.getRightAscension` and `getDeclination` (used by `MoonBody` and the planets)
return geocentric right ascension and declination in the J2000 frame, the same vector as
`eci()`. v7 used an observer on the surface at 0N 0E (up to about 1 deg off for the Moon,
varying with time of day) in the true equator and equinox of date. The frame change alone
moves results by the precession since 2000, about 0.36 deg in 2026.

## 24. `Earth.smaToDrift` is per day (numbers)

`Earth.smaToDrift(a)` returns the eastward longitude drift of a circular equatorial orbit in
rad per day (86400 s), as documented. v7 returned the drift per revolution. For a = 41164 km
the drift is 13.24 deg/day (v7: 12.73). `Earth.smaToDriftDegrees(a)` returns deg/day.

## 25. `getOrbitRegime` MEO band (numbers)

`ClassicalElements.getOrbitRegime()` classifies MEO as eccentricity at most 0.25 with perigee
and apogee altitudes (above 6378.137 km) both within **2,000 to 31,570 km**, the ESA Space
Environment Report band. v7 used a period window of 600 to 800 min, so Galileo (845 min) and
O3b (288 min) came back `OTHER`. They are now `MEO`.

## 26. Catalog number strings (numbers)

`Satellite.sccNum5` and `sccNum6` are fixed width and keep leading zeros: satellite 5 is
`"00005"` and `"000005"`, and 25544 is `"25544"` and `"025544"`. `sccNum` is unchanged.
Code that compares `sccNum6` with an unpadded string needs to pad, or compare `sccNum`.

## 27. Smaller contract changes

- `satrec.ndot` and `satrec.nddot` are stored in rad/min² and rad/min³ like Vallado's
  `twoline2rv` and python-sgp4. Propagation is unaffected.
- The SGP4 wasm backend sets `satrec.error` on failure, and satrecs re-attach after
  `clearSgp4WasmBackend()`. Error paths that were invisible are now visible.
- The Gauss initial orbit determination that `GoodingIOD.estimate` uses to seed its ranges
  (`GaussIOD`, not exported from the package root) returns `null` when no valid range root
  exists, and Gooding then throws an `OrbitDeterminationError`. v7 substituted a made-up
  GEO-like state. A root is valid only with positive slant ranges, at least `minRadius` and
  away from the observer's own radius.
- `Propagator.ascendingNodeEpoch` / `descendingNodeEpoch` throw `PropagationError` for an
  orbit with no node (equatorial); v7 returned an arbitrary epoch.
- Alpha-5 strings with a leading letter and 5 digits (`Z99999`) throw a range error.
- `Satellite.fromOmm` rejects an EPOCH with a space instead of `T` or with a UTC offset.
- `Beacon.getNextTransmission(afterDate)` skips a window that starts exactly at `afterDate`.
- `DownhillSimplex` stops only when both tolerances are met.
- `ScreeningFilter.filterCandidates`: plain JavaScript callers that still pass the old boolean
  get a 1 km (`true`) or 0 km (`false`) pad; pass a number in km or omit it.
- `Geodetic.isInView` uses the sum of both horizon angles, so mutual visibility of two elevated
  points is no longer understated.

## 28. Other numeric fixes (no API change)

These change results without any code change on your side. Re-run snapshot tests and look for
diffs in these areas:

- OMM epochs keep fractional seconds (v7 truncated to whole seconds: up to 7.6 km along-track
  in LEO for every OMM-built satellite).
- `Propagator` apogee, perigee and node searches use the period in minutes correctly;
  `Waypoint` revolution counts and the `ChebyshevCompressor` default segment length likewise.
- `alpha5` encodes catalog numbers 230000 to 239999 with the letter P (not the illegal O).
- TLE `meanMoDev2` reads the assumed decimal point and exponent.
- `eci2lla` and `ITRF.toGeodetic` on the polar axis.
- `ClassicalElements` round trips for circular and retrograde equatorial orbits.
- `Random.nextInt`, `RandomGaussianSource.gaussVector` and `gaussSphere`, and the Box-Muller
  seed sequence (observation noise was `NaN` in v7).
- `EulerAngles.fromDcm321`, `Quaternion.angle` (shortest arc).
- `RepeatGroundTrack` includes apsidal rotation; `isSunSynchronous` checks the sign.
- `LaunchTrajectoryGenerator` inclination and eccentricity, `PlaneChangeBurn` flight-path angle.
- Sun lighting ratio beyond the umbra tip (Sun-Earth L2), leap-second lookups for GPS and TT,
  `EpochUTC.fromDateTimeString` with an explicit offset.
- Parser robustness: Horizons observer tables, OEM block terminators and covariance blocks.

## Checklist

- [ ] Replace every `mag2db` with `pow2db`.
- [ ] Replace every Lambert `posigrade` option with `shortWay`, then search for `posigrade` to
      catch untyped call sites.
- [ ] Run `FieldOfView.migrateZenithRollFromV7` over every stored zenith (`boresightEl` 90)
      non-circular FOV configuration, or apply `newRoll = (oldRoll - boresightAz - 180) mod 360`
      by hand. A fan with `rollAngle` equal to `boresightAz` becomes roll 0.
- [ ] If you compare `directionAt` boundary samples of zenith FOVs against stored v7 output,
      compare them as a set.
- [ ] Give every `FieldOfView` and sensor `fieldOfView` a finite `halfAngle` in (0, 90].
- [ ] Guard `fovFromSwathWidth` results with `Number.isNaN`.
- [ ] Remove any km-to-m workaround around `CdmParser` / `CdmExporter`.
- [ ] Check OEM files with non-J2000 `REF_FRAME` values; unsupported frames now throw in
      `EphemerisSatellite.fromParsedOem`.
- [ ] Reorder `cappedScreeningCovarianceFromTle` caps to R, I, C and read the diagonal as
      variances.
- [ ] Re-baseline every probability of collision and covariance-derived threshold.
- [ ] Replace `useInclinationFilter` with `shellPad` (or remove it) in `CatalogScreener`
      options and `ScreeningFilter.filterCandidates` calls.
- [ ] Re-tune anything built on `estimateRcs` or `estimateVmagFromRcs`.
- [ ] Use `apogeeRadius` / `perigeeRadius` where you need geocentric distances; expect
      `Satellite.apogee` / `perigee` to drop by 7.137 km and `Tle.apogee` / `perigee` to become
      altitudes.
- [ ] Catch `SingularMatrixError` (or use `tryInverse`) around matrix inversion and orbit
      determination.
- [ ] Check `BatchLeastSquaresResult.converged`.
- [ ] Decide whether `ContactScheduler` should allow simultaneous multi-station contacts
      (`oneContactPerSatellite: false`).
- [ ] Use `Beacon.getCurrentTransmission` where you relied on `getNextTransmission` returning
      the window in progress.
- [ ] Drop any beamwidth argument passed to `azel2uv` / `uv2azel`.
- [ ] Read `DynamicGroundObject.positionHistory` instead of `history`.
- [ ] Pad catalog-number keys compared against `sccNum6`.
- [ ] Re-run your snapshot tests and explain each diff with an item above.
