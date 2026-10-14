### Changelog

This is an automatic changelog that automatically records all changes made to the project. Generated from Git commit
messages, it details updates like bug fixes and new features, providing a clear history of the project's development.

### [v8.0.0](https://github.com/thkruz/ootk/compare/v7.1.0...v8.0.0)

ootk 8.0.0 is a correctness release that follows a module-by-module audit of the library
(QA deep dive, October 2026). Most changes fix numbers that were wrong in 7.x: units, reference
radii, time scales, frames and numerical methods. Several fixes change observable outputs or API
contracts, so this is a major version. Two names are renamed without an alias (`mag2db` is now
`pow2db`, and the Lambert option `posigrade` is now `shortWay`), and the zenith roll convention of
`FieldOfView` changed. Each fix is pinned by a regression test in the module's `__tests__` folder
(`qa-regressions-2026-10.test.ts`). Read the breaking changes below before upgrading.

#### Breaking changes

Renames and removals

- `mag2db` is renamed `pow2db` with no alias. The math is unchanged (`10 log10(x)`); the error message now reads "Power must be positive".
- `LambertIOD.estimate` option `posigrade` is renamed `shortWay` with no alias. The default is `shortWay: true`. A leftover `posigrade` key is silently ignored at runtime (the options object is structural), so a missed call site reverts to the short way: search your code for `posigrade`. `shortWay` selects the sweep angle (below or above 180 deg), not the direction of motion.
- `LambertIOD.estimate` and `LambertIOD.solve` give `nRev` a sign: for |nRev| >= 1, a positive value returns the previous branch and a negative value returns the other multi-revolution solution.
- `GoodingIOD.estimate` / `solve`: the last positional parameter is renamed from `direction` to `shortWay` (no numeric change; positional callers are unaffected).
- `ScreeningFilter.shellsOverlapWithInclination` is removed (it always returned the radial result). `CatalogScreeningOptions.useInclinationFilter` is removed and replaced by `shellPad?: Kilometers`.

Sensors and field of view

- Zenith roll convention: in `boresightFrameFromAzElRoll`, roll at the zenith (el = 90 deg) is now measured from the boresight azimuth line, not from north. The frame is the limit of the general branch as el approaches 90 deg, so it is continuous through the zenith. Roll 0 puts the major axis along the boresight azimuth. Convert v7 zenith configs with
  `newRoll = (oldRoll - boresightAz - 180) mod 360`,
  which `FieldOfView.migrateZenithRollFromV7(params)` applies (only to non-circular zenith configs; it returns a copy). Non-zenith configs need no change. For az 0, roll 0 the footprint is unchanged but `u` and `v` are rotated 180 deg, so `directionAt(t)` returns what v7 returned at `t + 180 deg`.
- `FieldOfView` throws `ValidationError` when `halfAngle` is missing or non-finite (v7 accepted it and produced a sensor that saw nothing). `minorHalfAngle` must be finite when given.
- `azel2uv(az, el, coneHalfAngle = pi/2, boresightEl = 0)` returns direction cosines of the line of sight in the face frame (right, up, boresight). With a horizontal boresight this is `u = cos(el) sin(az)` and `v = sin(el)` (the sign of `v` is flipped from v7); the new optional `boresightEl` makes it exact for a tilted face, where az/el differences are not sine-space offsets. `coneHalfAngle` is optional and bounds the true angle off boresight, acos(w); a direction outside it throws `ValidationError`. `uv2azel(u, v, coneHalfAngle, boresightEl)` is the exact inverse and throws when `u² + v² > 1` or the direction is outside the cone. In v7 the inputs went through mixed-unit scaling and the bounds checks never fired.
- `PhasedArrayRadar.uvFromAzEl` / `azElFromUV` and `rae2ruv` use the face's boresight elevation, so a tilted face no longer rejects targets inside its field of view (boresight el 20 deg, half-angle 60 deg: az 55 el 50 is 52.5 deg off boresight and threw) or returns the wrong u (az 40 el 60: 0.321, was 0.492). They bound sine space by the FOV half-angle instead of the beamwidth. `azElFromUV` wraps azimuth to [0, 360).
- `FieldOfView.migrateZenithRollFromV7` treats a config as zenith with the same 1e-10 rad test the frame builder uses (it used 1e-10 deg, so el = 90 - 1e-9 deg took the zenith frame but was not migrated).
- `MechanicalRadar.scanPeriod` is the FOV azimuth span divided by `scanRate`: 360 deg when the FOV contains the zenith, `2 asin(sin(alpha) / cos(el))` for a circular cone, measured from the boundary for an elliptical cone. v7 used the cone width, so a zenith hemisphere doubles (360 deg instead of 180).
- `fovFromSwathWidth` returns `NaN` when the swath extends past the geometric horizon, for a negative width and for a non-positive altitude.

Conjunction and covariance

- `cappedScreeningCovarianceFromTle` returns a real 6x6 `StateCovariance` in the RIC frame (`CovarianceFrame.RIC`, was labelled ECI). The diagonal holds variances (km², km²/s²) in R, I, C order; v7 wrote 1-sigma values with the in-track and cross-track slots swapped. The covariance is scaled by `confidenceLevel²` and each position axis is capped with `D C D` (d_i = min(1, cap_i / sigma_i)), so a capped variance is exactly cap² and correlations are kept. `caps` are 1-sigma caps in km in R, I, C order; the default changed from `[1200, 1000, 5000]` to `[35, 71, 32]` km, which reproduces the caps v7 applied in practice (v7 read its sigmas as variances, so its caps bound at sqrt(1200), sqrt(5000), sqrt(1000) = 34.6, 70.7, 31.6 km). The fallback covariance holds cap² position variances and (cap / 1000 s)² velocity variances in RIC, so it is non-singular (v7 left the velocity block zero).
- `CovarianceSample` with a `tle` ages the TLE against the state epoch, not `new Date()`, so results no longer depend on the wall clock (old TLEs gave covariances up to about 7000x too large radially). The R/I/C quality and aging factors are applied in the RIC frame even when the covariance is ECI.
- The 2D probability of collision is the exact encounter-plane integral (Foster and Estes 1992) in the covariance principal axes, with a high-precision erfc and adaptive Gauss-Kronrod quadrature. The approximate `chanPc2D` path and `approximateErfc` are removed. Pc values change for anisotropic covariances, hard-body radii larger than sigma and misses inside the hard body. `COLLISION_PROBABILITY_METHOD` defaults to `FOSTER-1992` (was `CHAN-2D`).
- `ConjunctionAssessment` rotates the secondary covariance into the primary RIC frame (`M C Mᵀ`, `M = Q_p Q_sᵀ`) before summing. v7 summed each covariance in its own RIC frame.
- `ConjunctionAssessment` with `useHighFidelity` seeds the RK89 state from the new `highFidelitySeedEpoch` option (default: window start), not `Date.now()`, so results are reproducible. Names, designators and per-object covariances are passed through to the `ConjunctionEvent`.
- `ConjunctionEvent.radialDistance`, `intrackDistance` and `crosstrackDistance` are SIGNED components of the secondary's position relative to the primary in the primary RIC frame, the CCSDS `RELATIVE_POSITION_R/T/N` convention (v7 stored their absolute values). Take `Math.abs()` where a magnitude is displayed. New optional `radialVelocity`, `intrackVelocity`, `crosstrackVelocity` hold the signed relative velocity.
- `ConjunctionEvent.primaryDesignator` / `secondaryDesignator` default to the TLE catalog number (`Tle.satnum`, CDM `OBJECT_DESIGNATOR` with `CATALOG_NAME = SATCAT`); v7 used the COSPAR id. The COSPAR id moves to the new `primaryInternationalDesignator` / `secondaryInternationalDesignator` (CDM `INTERNATIONAL_DESIGNATOR`).
- `CovarianceRealism` consistency-ratio labels are corrected: ratio < 0.5 is `'pessimistic'` (covariance too large), ratio > 3 is `'optimistic'` (covariance too small); 0.5 to 3 stays `'realistic'`.
- `ScreeningFilter.filterCandidates(primary, secondaries, pad)`: the third parameter is a radial pad in km (default `DEFAULT_SHELL_PAD_KM`, 10 km), not the boolean `useInclinationFilter`. TypeScript flags an old boolean argument; plain JavaScript callers get no error, and `true` / `false` are coerced to a 1 km / 0 km pad, so remove the argument or pass a number. `shellsOverlap(shell1, shell2, pad)` rejects a pair only when `perigee1 - pad > apogee2` or `perigee2 - pad > apogee1`, so candidate counts grow. `getOrbitalShell` returns geocentric radii in km and the inclination in radians (v7 converted radians to radians a second time).
- `Matrix.inverse` throws `SingularMatrixError` for a singular or non-finite matrix (pivot at or below `n * eps`) and `Error` for a non-square one; v7 returned garbage or NaN. It now uses Gauss-Jordan with partial pivoting on an equilibrated copy. Use `Matrix.tryInverse()` to get `null` instead. This reaches `LevenbergMarquardtOD`, `BatchLeastSquaresOD`, `Hill`, `CovarianceRealism` and `Observation.noiseCovariance()`.
- `Matrix.cholesky` throws for a non-square, non-finite or not positive semi-definite matrix (v7 returned NaN entries); positive semi-definite input is accepted (a zero covariance factors to zero).

CCSDS parsers and exporters

- CDM parse and export use CCSDS 508.0-B-1 units: `MISS_DISTANCE` and `RELATIVE_POSITION_*` in m, `RELATIVE_SPEED` and `RELATIVE_VELOCITY_*` in m/s, covariance in m², m²/s and m²/s²; state vectors stay in km and km/s. `CdmParser` converts to km (a value with no unit tag is read in the standard unit, an explicit `[km...]` tag from pre-v8 ootk output is honoured, any other unit throws `ParseError`). Parsed values change by 1e3 (distances) and 1e6 (variances) against v7.
- `CdmParser` honours each object's `REF_FRAME` (EME2000, J2000, GCRF, ICRF used as J2000; ITRF* and TEME rotated to J2000; anything else throws). It builds the full 6x6 RTN covariance for each object and rotates OBJECT2's into OBJECT1's RTN before combining. The mandatory header fields `CCSDS_CDM_VERS`, `CREATION_DATE` and `ORIGINATOR` are no longer defaulted: `CdmParser.parse` throws `ParseError` ("CDM validation failed: Missing ...") for a CDM missing any of them.
- `CdmExporter` always writes `REF_FRAME = EME2000` (metadata overrides are ignored), writes every mandatory metadata keyword with a default when none is supplied, and `includeFullCovariance` defaults to `true` (all 21 terms, as CDM 1.0 requires). OBJECT1 and OBJECT2 each get their own covariance; v7 wrote `combinedCovariance` as OBJECT1's and none for OBJECT2. `RELATIVE_POSITION_*` and `RELATIVE_VELOCITY_*` are signed and come from one source: the event's stored components when it carries the relative velocity components, otherwise both recomputed from the two states (v7 wrote absolute positions next to signed velocities). `OBJECT_DESIGNATOR` defaults to the catalog number, and `INTERNATIONAL_DESIGNATOR`, `MANEUVERABLE`, `EPHEMERIS_NAME` and the screening period and volume (`START_SCREEN_PERIOD`, `STOP_SCREEN_PERIOD`, `SCREEN_VOLUME_FRAME`, `SCREEN_VOLUME_SHAPE`, `SCREEN_VOLUME_X/Y/Z`, `SCREEN_ENTRY_TIME`, `SCREEN_EXIT_TIME`) are written from the event when it carries them. Relative data keywords follow the Table 3-2 order (`RELATIVE_SPEED` before the components). `CdmParser` reads `SCREEN_VOLUME_*` and fills the new event fields.
- `OemParser` converts `TIME_SYSTEM` TAI, GPS, TT and TDB (TDB treated as TT) to UTC; UTC or absent is unchanged; any other value throws `ParseError`. v7 read every epoch as UTC. A malformed covariance line, a covariance without `EPOCH` or a partial (fewer than 21 terms) matrix throws.
- `OemParser` accepts spec-compliant files without `DATA_START` / `DATA_STOP`; the markers are still accepted.
- `EphemerisSatellite.fromParsedOem` reads `REF_FRAME` per block: EME2000, J2000, ICRF and GCRF are J2000; TEME stays TEME only when every block is TEME (mixed blocks are rotated to J2000); ITRF, ITRF-* and ECEF are rotated to J2000; any other frame throws. v7 stored every non-TEME frame as J2000 numbers.
- `OdmExporter` OPM and OMM KVN output no longer includes `META_START` / `META_STOP` (CCSDS 502.0-B-3 sections 3.2.3 and 4.2.3).

Objects and observation

- `Satellite.sccNum5` and `sccNum6` are fixed width and keep leading zeros: `sccNum6` is always 6 characters (ISS is `"025544"`, was `"25544"`), `sccNum5` is 5. `sccNum` has no leading zeros.
- `Tle.semimajorAxis` (and so `Tle.apogee` / `perigee` / `apogeeRadius` / `perigeeRadius`) derives a from the mean motion with the WGS-72 mu SGP4 uses, 398600.8 km³/s², the same as `Satellite.semiMajorAxis` (new `Tle.WGS72_MU`, `Tle.semimajorAxisFromMeanMotion`). v7 used 398600.4418 in `Tle`, 2.08 m below `Satellite` for the ISS.
- `Satellite.apogee` / `perigee`, `ClassicalElements.apogee` / `perigee` and `Tle.apogee` / `perigee` are altitudes above the WGS-84 equatorial radius, `a(1 +/- e) - 6378.137` km. `Satellite` and `ClassicalElements` used 6371 km (values drop by 7.137 km); `Tle` returned the geocentric radius. The new `apogeeRadius` / `perigeeRadius` getters on all three return `a(1 +/- e)`. `RepeatGroundTrack.findNearest` and `LaunchTrajectoryGenerator` altitudes use the same 6378.137 km reference.
- `ClassicalElements.getOrbitRegime()` MEO band: e <= 0.25, perigee >= 2000 km and apogee <= 31570 km (altitudes above 6378.137 km). v7 used a 600 to 800 min period window; Galileo (845 min) and O3b now classify as MEO.
- `DynamicGroundObject.history` always returns `null`; use `positionHistory` for the LLA trail. The v7 alias had a type the base class does not allow.
- `Star.rae()` returns geometric (unrefracted) elevation, and the J2000 RA/Dec is precessed and nutated to the equator of date before the horizon transform. The default observer is (0, 0, 0) (v7 used the invalid lat 180 deg). `Star.eci()` ignores its `lla` argument and returns the catalog direction at 250000 km in TEME.
- `Satellite` history records only direct `eci()` calls; internal propagations from `rae()`, `lla()`, `ecef()`, access sweeps and similar no longer add entries. `rae()` and `dopplerFactor()` evaluate the observer at `date` via the new `llaAt` / `eciAt` and return `null` when it has no position then.
- `Satellite.fromOmm` throws `Invalid OMM EPOCH` for an EPOCH that is not `YYYY-MM-DDThh:mm:ss[.f][Z]` or `YYYY-DDDThh:mm:ss[.f][Z]` (day-of-year is newly accepted). A space instead of `T` between date and time, or a UTC offset such as `+00:00`, is rejected (v7 accepted both through `Date.parse`).
- Alpha-5 conversions throw a range `ValidationError` ("exceeds TLE alpha-5 capacity (max Z9999 = 339999)") for a 6-character form with a leading letter such as `Z99999` or `B12345`; v7 passed it through, and `convertA5to6Digit('Z99999')` returned 3399999.
- `EphemerisSatellite.ecef()` and `lla()` return `null`, and `toITRF()` throws, for a non-Earth center body. `getLinearInterpolatedState()` returns `null` after the last epoch. `parseCenterBody('AREOCENTRIC')` returns `CenterBody.MARS`. Barycenter `CenterBodyMu` values use JPL DE440 system GM.
- `AccessCalculator.getNextAccess` returns a pass that rises exactly at `after` (an in-progress pass is still skipped). `calculateAccess` bisects rise and set to 1 ms (v7 edges fell on the coarse step grid), and returns `[]` for `stepMs <= 0` or `end < start`.
- Ground positions are validated by `GroundObject.validateLla`: negative altitudes are accepted, NaN or infinite values throw `RangeError`, and `DynamicGroundObject` validates constructor waypoints too.
- `Observation.noiseCovariance()` returns the matrix inverse of `noise` (v7 returned the element-wise reciprocal). The `sigma` argument of `sample()`, `sampleVector()` and `noiseSample_()` is a number of standard deviations (`sigma * chol(C)`); v7 scaled the variance. Calls with sigma = 1 are unchanged.
- `ObservationRadar.clos()` returns the cross line-of-sight chord `2 rho sin(theta / 2)` in km, as `ObservationOptical` does; v7 returned the range difference.
- `RadecTopocentric.fromDegrees`, `RadecTopocentric.fromStateVector` and `RadecGeocentric.fromDegrees` return right ascension in [0, 2pi). `RadecGeocentric.fromDegrees` rate parameters are typed `DegreesPerSecond`.

Orbit determination, maneuvers and orbit design

- `BatchLeastSquaresOD.solve()` converges when |dRMS| <= `tolerance * max(previous RMS, 1)` (v7's relative test never fired with noiseless data); on convergence the step is not applied, so state, RMS and covariance belong together. The result has a new `converged` flag.
- `LevenbergMarquardtOD.solve()` converges when the weighted RMS is below `epsilon` or the undamped Gauss-Newton step would lower it by at most `epsilon * max(RMS, 1)`, so fits at the noise floor report `converged = true`. `converged` is false when iterations run out or lambda exceeds 1e10.
- Both solvers throw `SingularMatrixError` for a singular normal matrix and no longer sort the caller's `observations` array in place.
- `GaussIOD.estimate` no longer substitutes a 35,000 km radius for a missing or out-of-range root and no longer caps roots at 50,000 km. A root of the range polynomial is accepted only if it is at least `minRadius` (new optional third constructor argument, default the Earth radius), is not within 3 % of the site radius (the spurious rho = 0 root), and gives positive slant ranges at all three epochs. When Halley iteration does not give such a root, every positive root is bracketed; of two valid roots the one closest to the Halley iterate (or else the larger) is taken. `estimate` returns `null` when no valid root exists. v7 accepted Halley's root even when it put the object behind the observer (160 % position errors for some inclined near-GEO triplets) and gave up when the polynomial had three positive roots.
- `PlaneChangeBurn` delta-v is `2 v cos(gamma) sin(|di| / 2)` with the flight-path angle at the node; `computeDeltaV` takes an optional third argument `flightPathAngleRad` (default 0).
- `Hill.maneuverSequence` applies and returns pre-maneuvers with epoch in [this.epoch, pivot] (v7 kept those after the pivot).
- `Geodetic.isInView` uses the sum of the two horizon angles (v7 used the larger one).

Time, bodies, propagation and utilities

- `Earth.smaToDrift()` returns drift per solar day, `(n - wE) * 86400` rad; v7 returned drift per revolution. `smaToDriftDegrees`, `driftToSemimajorAxis` and `driftDegreesToSma` follow.
- `CelestialBody.getRightAscension()` / `getDeclination()` (Moon, Sun and other bodies) are geocentric J2000, the same vector as `eci()`. v7 was topocentric from 0N 0E (up to about 1 deg off for the Moon) and of date.
- Default atmospheric drag changed: v8 uses standard Harris-Priester at the default F10.7 = 150, while v7 scaled the HP diurnal bulge term by 0.444 at F10.7 = 150. The day/night bulge is therefore 2.25x larger (1 / 0.444) at default settings and drag-driven decay is faster on the day side; re-baseline any decay or lifetime numbers.
- `DownhillSimplex` requires both the function-value and the simplex-size tolerance to be met before it stops (v7 stopped on either), so it can take more iterations.
- `ForceModel.setAtmosphericDrag(mass, area, coeff = 2.2, cosine = 4, f107 = 150)` gains `f107` (SFU). `setAtmosphericDrag`, `setEarthGravity`, `setThirdBodyGravity` and `setSolarRadiationPressure` return `this` for chaining.
- `RungeKuttaAdaptive.propagate()` (`DormandPrince54Propagator`, `RungeKutta89Propagator`) throws `PropagationError` after 1000 consecutive rejected steps; v7 returned the cached state at the wrong epoch.
- `Propagator.ascendingNodeEpoch` / `descendingNodeEpoch` throw `PropagationError` when the orbit has no node in that direction within one period (an equatorial orbit); v7 returned an arbitrary epoch.
- `Propagator.ephemeris()`, `maneuver()` and `ephemerisManeuver()` end exactly at `stop` (v7 ran one interval past it).
- `Beacon` windows are half-open `[epoch + k interval, epoch + k interval + duration)`. `getNextTransmission(afterDate)` returns the first window starting strictly after `afterDate`, so a window that starts exactly at `afterDate` is skipped (v7 returned the window in progress); the new `getCurrentTransmission(date)` returns the one in progress. `getTransmissionsInRange` includes and clips windows already in progress at `start`.
- `Receiver.canReceive()` returns `false` when the transmitter frequency is outside the receiver passband, whatever the SNR (`Transponder.canRelay` inherits this).
- `estimateRcs()` returns m², the orientation-averaged projected area `S / 4` (Cauchy) of the shape. v7 returned `1.5 sqrt(area)`, a length.
- `estimateVmagFromRcs(rcs, albedo = 0.2)` models a Lambertian sphere at 1000 km and 90 deg phase with the Sun at V = -26.74: `7.93 - 2.5 log10(rcs)` at the default albedo. A 1 m² object moves from -1.3 to about +7.9.
- `calcInertAz(lat, inc)` throws `ValidationError` unless `|lat| <= inc <= 180 - |lat|` (v7 returned NaN for some unreachable cases).
- `factorial(n)` returns `NaN` for negative or non-integer `n` (v7 used `|n|`). `gamma(x)` is the real Gamma function (Lanczos and reflection; NaN at the poles). `copySign` follows C `copysign` for signed zeros.
- `MILLISECONDS_TO_DAYS` is exactly `1 / 86400000`; `MILLISECONDS_PER_DAY` is typed `Milliseconds`.
- `satrec.ndot` / `nddot` are stored in rad/min² and rad/min³ as in Vallado `twoline2rv` (SGP4 does not use them). Drag-driven out-of-range eccentricity reports `MEAN_ELEMENTS_INVALID` (1), not `MEAN_MOTION_NEGATIVE` (2).
- Wasm SGP4 backend: a propagation failure sets `satrec.error` to the new `Sgp4ErrorCode.WASM_PROPAGATION_FAILED` (7); satrecs re-attach to the next backend after `clearSgp4WasmBackend()` or a backend swap. `Sgp4WasmPropagator` shares sat keys with the global backend through `acquireWasmSatKey` / `releaseWasmSatKey` (module exports, not in the public barrel).
- `Vector3D.sight(v, radius)` types `v` as `Vector3D<Kilometers>`.

#### Fixed

- OMM epochs keep fractional seconds (`Satellite.fromOmm`); v7 truncated them, up to about 7.6 km along track. A missing `CLASSIFICATION_TYPE` writes 'U'.
- Period units: `StateVector.period` is in minutes and is now converted to seconds in the `Propagator` node and apsis searches (`ascendingNodeEpoch`, `descendingNodeEpoch`, `apogeeEpoch`, `perigeeEpoch` searched a span 3600x too short), `ChebyshevCompressor.compress` default segments (60x too short) and `Waypoint.toManeuvers` (nRev 60x too large).
- Alpha-5: `convert6DigitToA5` skips the letter O correctly (230000 is `P0000`) and handles leading-zero 6-digit input.
- `Tle.meanMoDev2` decodes the assumed decimal point and exponent (`" 12345-5"` is 1.2345e-6).
- `FormatTle.eccentricity` formats values below 1e-6 (5e-7 is `0000005`).
- Probability of collision: exact 2D integral (above); the 3D zero-relative-velocity fallback uses the exact noncentral chi distribution.
- Nutation: `Earth.nutation()` sums the full 106-term IAU 1980 series (v7 had 4 rows in the wrong order); `gast` is wrapped to [0, 2pi).
- Leap seconds: `EpochGPS.toUTC()` and `EpochUTC.fromJ2000TTSeconds()` look up TAI - UTC on the TAI scale (v7 was 1 s off near each leap second). `EpochUTC.fromDateTimeString()` keeps explicit `+hh:mm` offsets. `jday()` with no arguments returns the current Julian date.
- Polar geodetic: `eci2lla()` and `ITRF.toGeodetic` use a height formula that is regular on the polar axis; a point below the south pole gets a positive altitude.
- `SunBody.lightingRatio()` handles the annular case (Earth disk inside the solar disk, as near Sun-Earth L2).
- Repeat ground track: `RepeatGroundTrack.calculate` includes apsidal rotation (Vallado Algorithm 71); Landsat-8 233/16 is about 706.7 km above 6371 km (was 709.5). `findNearest` flags sun-synchronous only for eastward precession.
- `LaunchTrajectoryGenerator` reaches the requested inclination (secant search on the launch azimuth) and keeps the requested eccentricity.
- `RandomGaussianSource.gaussVector(n)` returns n values (v7 returned 1); `gaussSphere` follows. `Random.nextInt(max)` is uniform in [0, max) (v7 ranged over [0, max²]); seeds are reduced into range. Box-Muller uses `1 - u` so it never takes `ln(0)`.
- `EulerAngles.fromDcm321()` uses `atan2` for roll and yaw (full range). `Quaternion.angle()` returns the shortest arc in [0, pi]. Zero-vector `normalize()` returns a fresh instance instead of the shared constant.
- Cholesky (above); `SimpleLinearRegression` returns slope 0 for constant y and uses `n - 2` in the standard error; `DownhillSimplex` stops only when both tolerances are met.
- Harris-Priester: F10.7 scales the whole density by a ratio of US76 thermosphere densities, and the default 150 SFU reproduces standard Harris-Priester. v7 removed the diurnal bulge at F10.7 = 70. Between 120 and 200 km the factor ramps linearly from 1 to its 200 km value, because the density ratio inverts below about 190 km (a quiet Sun gave 5.7 % more drag at 140 km); the factor is non-decreasing in F10.7 at every height.
- `RungeKuttaAdaptive` floors its tolerance at the roundoff level of the state, `RungeKutta89Propagator.order` is 9, and `ephemerisManeuver` keeps only maneuvers inside the window, in order.
- `newtonM` / `newtonNu` handle hyperbolic and parabolic orbits.
- `ClassicalElements.fromStateVector` handles circular and equatorial orbits per Vallado Algorithm 9, so it round-trips with `toJ2000()`; `EquinoctialElements.toClassicalElements` wraps angles to [0, 2pi).
- `Geodetic.isInView`, `Hill.maneuverSequence` filter, `Observation` noise and radar `clos` (above).
- `GibbsIOD` coplanarity check normalizes `r2 x r3` (a 20 deg out-of-plane triplet is now rejected).
- TCA search finds fast encounters between coarse grid samples (Lipschitz branch-and-bound then golden-section polish).
- `CovarianceRealism` eigenvalues use Smith's trigonometric form, exact for diagonal matrices and repeated roots (v7 returned NaN or zeros).
- `FieldOfView.containsDirection` rejects a zero or non-finite direction; cone containment is boundary-inclusive; step-mode elevation masks normalize azimuth and copy the caller's array.
- Scheduler: `ContactScheduler` orders by satellite priority, then quality, then station priority (v7 let a large quality outrank priority); the new `oneContactPerSatellite` option (default `true`) prevents one satellite at two stations at once; concurrency uses the peak number of simultaneous contacts; handover splits every consecutive overlap; trimmed windows re-evaluate their peak; `MAX_TOTAL_TIME` runs an exchange search.
- Parsers: `HorizonsParser.parseVectors` reads CSV tables and converts `KM-D` / `AU-D` units (unsupported units throw); observer tables parse dates, sexagesimal RA/Dec and light time. `OemParser` stores one 21-term covariance per `EPOCH` (v7 stamped each line with `new Date()`), accepts day-of-year epochs and ignores `COMMENT` lines in data sections. `OdmExporter.exportOem` `START_TIME` / `STOP_TIME` match the emitted points.
- `AccessCalculator` window edges to 1 ms; `History` sampling interval is symmetric and `clone()` deep-copies; `DynamicGroundObject` splines use real waypoint times and antipodal great-circle interpolation no longer returns NaN; `clone()` of ground objects deep-clones sensors and comm devices; `EphemerisSatellite` TEME handling no longer rotates twice.
- `RAE.fromStateVector` returns finite rates at zenith and nadir.
- `EphemerisBody` sorts a copy of its input and estimates spline tangents; `getRiseSetTimes` and Moon rise/set report the true culmination.
- SGP4 deep-space resonance caches `atime`, `xli` and `xni` as Vallado does.
- `Antenna.getOffAxisLoss()` floors gain at -10 dBi (ITU-R S.465); `Transmitter.isVisible()` handles ground-to-ground links.
- `VisualizationHelpers.generateOrbitTrack` altitude is the WGS-84 geodetic height.
- `createCovarianceFromTle` no longer logs to the console.

#### Added

- `SingularMatrixError` and `Matrix.tryInverse()`.
- `pow2db`, `wrapTwoPi`, `DEFAULT_SHELL_PAD_KM` (new public exports).
- `FieldOfView.migrateZenithRollFromV7(params)`.
- `apogeeRadius` / `perigeeRadius` on `Satellite`, `ClassicalElements` and `Tle`.
- `BatchLeastSquaresResult.converged`.
- `Beacon.getCurrentTransmission(date)`.
- `GroundObject.validateLla`, `GroundObject.llaAt(date)`, `GroundObject.eciAt(date)`; `DynamicGroundObject.eci(date)` returns the interpolated position.
- `ScheduleOptions.oneContactPerSatellite`, `CatalogScreeningOptions.shellPad`, `ConjunctionAssessmentOptions.highFidelitySeedEpoch`, `ConjunctionAssessmentOptions.screenVolume`, `ConjunctionSpaceObjectInput.designator`, `internationalDesignator`, `maneuverable` and `ephemerisName`, `CdmExportOptions.collisionProbabilityMethod`.
- `ConjunctionEvent` relative velocity components, international designators, maneuverability, ephemeris names and `screenVolume` (`ConjunctionScreenVolume`, `ConjunctionManeuverable` types); `CdmRelativeData.SCREEN_VOLUME_*`.
- `Tle.WGS72_MU` and `Tle.semimajorAxisFromMeanMotion(revsPerDay)`; optional `minRadius` on the `GaussIOD` constructor; optional `boresightEl` on `azel2uv` / `uv2azel`.
- `DataHandler.getLeapSecondsFromTai(jdTai)` and `DataHandler.getIau1980Count()`.
- `Sgp4ErrorCode.WASM_PROPAGATION_FAILED`.
- Optional `f107` on `ForceModel.setAtmosphericDrag`, `albedo` on `estimateVmagFromRcs`, `flightPathAngleRad` on `PlaneChangeBurn.computeDeltaV`.

#### [v7.1.0](https://github.com/thkruz/ootk/compare/v7.0.3...v7.1.0)

- Release 7.1.0: WGS84 ground sites, Doppler/rate fixes, SGP4 WASM seam, new sensors and orbit design tools [`#51`](https://github.com/thkruz/ootk/pull/51)
- Consolidate changelog management and sync develop with main [`#50`](https://github.com/thkruz/ootk/pull/50)
- feat(external): :sparkles: add USSF Astro Standards Sgp4Prop wasm wrappers [`f388dc7`](https://github.com/thkruz/ootk/commit/f388dc780250bfe66575fbc11577b25bc2971e1e)
- chore(changelog): :wrench: consolidate on auto-changelog as single source [`02c6f66`](https://github.com/thkruz/ootk/commit/02c6f66c72943ce28a3594c9460d1bab957652b4)
- feat(orbit-design): :sparkles: replace OrbitFinder with closed-form groundTrackStateVector [`5ad1208`](https://github.com/thkruz/ootk/commit/5ad1208d5309eb2c0d725aebda176eff79aca35b)
- feat(sgp4): :sparkles: add wasm backend seam to Sgp4 [`c200b4f`](https://github.com/thkruz/ootk/commit/c200b4f9c0c09ce0348e0f658e03c0156e7f3812)
- feat(orbit-design): :sparkles: add LaunchWindowFinder for RAAN-matched launch windows [`f23fd72`](https://github.com/thkruz/ootk/commit/f23fd72e3edd8b18d1e1e8aeec2848f3dbe308a2)
- fix(satellite): :bug: correct toRae() rates, keep zero rates, and fix the lighting checks [`356f8de`](https://github.com/thkruz/ootk/commit/356f8dec1e597f2db7257474df1df0b0a0e92f9d)
- feat(maneuver): :sparkles: add combined plane-change Hohmann transfer and propellant budget [`4124318`](https://github.com/thkruz/ootk/commit/412431853808cf11f63b89ae5b6eec416925316e)
- fix(ground-object): :bug: put toJ2000() on WGS84 with the Earth-rotation velocity [`58ac5da`](https://github.com/thkruz/ootk/commit/58ac5da13061b874b19682b44447d17a9a0f9cc8)
- feat(propagator): :sparkles: add Sgp4WasmPropagator adapter [`12ba26d`](https://github.com/thkruz/ootk/commit/12ba26de69f496b29531305c16ebd92e69274a33)
- fix(sun): :bug: stop double-correcting light time and pass elevations to SearchAltitude [`2899984`](https://github.com/thkruz/ootk/commit/289998414f830b96f993263782d028e26a58e871)
- feat(sensor): :sparkles: add FieldOfView.directionAt cone sampling for FOV mesh generation [`9c4113a`](https://github.com/thkruz/ootk/commit/9c4113ad9be1fd72533d0a92393f0ef70cc35735)
- fix(ground-object): :bug: place the observer on WGS84 in eci() so dopplerFactor matches rae() [`cedcb60`](https://github.com/thkruz/ootk/commit/cedcb609e1cdb1faed42e832cea78281b7f2524b)
- feat(sensor): :sparkles: add TtcAntenna cooperative tracking sensor type [`9be7374`](https://github.com/thkruz/ootk/commit/9be7374ef5ce24f59071edb57f34284808ce043d)
- fix(parsers): :bug: parse padded Horizons metadata labels [`cd9289d`](https://github.com/thkruz/ootk/commit/cd9289d463ea51d614c7aa6a8e65271eeef60738)
- fix(coordinate): :bug: keep formatTleExponential to eight characters [`c307da5`](https://github.com/thkruz/ootk/commit/c307da550d26c095730a8c38b2dc56e442f1c660)
- fix(phased-array-radar): :bug: wrap azimuth and use the great-circle angle for faces [`7d56080`](https://github.com/thkruz/ootk/commit/7d56080a3af7b1713f1a6d042553dd849cc3294b)
- chore(ci): :wrench: install with pnpm in every workflow [`a433dab`](https://github.com/thkruz/ootk/commit/a433dabbe81f76de770fec6f512a2749df808664)
- fix(classical-elements): :bug: use the caller's mu, solve Kepler by Newton, fix the MEO regime [`722faa3`](https://github.com/thkruz/ootk/commit/722faa39daa900a9fb17fd164d709f9e2cf90f73)
- refactor(epoch): :recycle: optimize epoch comparisons to POSIX [`b9dbc5b`](https://github.com/thkruz/ootk/commit/b9dbc5be70febb96f5506f23c7b6f754c92bd618)
- chore(pnpm): :wrench: migrate the repo from npm to pnpm [`90eb838`](https://github.com/thkruz/ootk/commit/90eb8388f5f0ed0a505b822e42e2e0972fdbfb67)
- fix(launch-trajectory): :bug: start the trajectory on the WGS84 pad in J2000 [`ee33d84`](https://github.com/thkruz/ootk/commit/ee33d84e14468ad6f5171946584d57733eadadc1)
- fix(visualization): :bug: place elliptical FOV boundary points along their own direction [`f2f12dd`](https://github.com/thkruz/ootk/commit/f2f12dd9db3d31b02f3d8fabb6660bd68f8357ad)
- fix(kepler-propagator): :bug: filter maneuvers by window and restore the elements [`f646223`](https://github.com/thkruz/ootk/commit/f6462232111328151f16f6309427776585e0402b)
- ci(release): :wrench: back-merge main into develop after release [`0860417`](https://github.com/thkruz/ootk/commit/086041714667e7a852f0ebcc2fcda9ca25a1513e)
- fix(tle): :bug: count real elapsed time in calcElsetAge [`93fde19`](https://github.com/thkruz/ootk/commit/93fde19824ec79404414e0c5df4e85bbd1b50ce2)
- fix(transmitter): :bug: compute the link-budget noise floor in the receiver bandwidth [`331f90f`](https://github.com/thkruz/ootk/commit/331f90f5e4acff0c4d0ddfcfc151ab9810fa6c08)
- fix(horizons): :bug: read vector-table epochs as TDB [`b6fe698`](https://github.com/thkruz/ootk/commit/b6fe698f82e9e8554cf57d7f230161df4667eca6)
- fix(utils): :bug: fold negative angles in wrapAngle and clamp the cosine distance [`ef99b98`](https://github.com/thkruz/ootk/commit/ef99b989d3faf77d0960c874ce81fa0968049ccc)
- build(deps): :arrow_up: clear the pnpm audit gate for dev tooling [`f366c2b`](https://github.com/thkruz/ootk/commit/f366c2b4f0362433dcf0ed228fd0b2c8abf40ca7)
- docs(readme): :memo: switch the contributor instructions to pnpm [`dd0e5bf`](https://github.com/thkruz/ootk/commit/dd0e5bfc30f8973d89639c556bfc25ec0cb6f4b8)
- chore(eslint): :wrench: upgrade to ESLint 10 [`aa07806`](https://github.com/thkruz/ootk/commit/aa07806970190c808cbd8ad82abb6313a596587a)
- ci(release): :construction_worker: stop chore/docs/style/test/ci commits from triggering releases [`b7187c4`](https://github.com/thkruz/ootk/commit/b7187c4f19cb0b745b4493bd80633ea866840143)
- test(integration): :white_check_mark: refresh the public API export snapshot [`a20ce8d`](https://github.com/thkruz/ootk/commit/a20ce8d4e2d07b1d24ace31d293c687022a844ef)
- refactor(orbit-determination): :recycle: scope the Gauss seed orbit to its branch [`a6b4448`](https://github.com/thkruz/ootk/commit/a6b4448bc3b954a3605edb63efe695d1623ba44a)
- fix(field-of-view): :bug: keep accepting FOV params without a halfAngle [`2f3b750`](https://github.com/thkruz/ootk/commit/2f3b750178eb951ec82a891d228ab13c95bf996a)
- refactor(body): :recycle: drop initializers that are always overwritten [`4d77381`](https://github.com/thkruz/ootk/commit/4d77381f644b5397742e988a8f882c6ba918f21e)
- chore(release): :wrench: drop package-lock.json from the release assets [`b9cb5e1`](https://github.com/thkruz/ootk/commit/b9cb5e10d1f8b8d21f9b35fee87cb5beaea1e544)
- chore(release): :wrench: sync develop package version to 7.0.3 [`0361ca8`](https://github.com/thkruz/ootk/commit/0361ca8ff430ec28a215dfdf0db50f31782b9e2a)
- build(deps): :wrench: declare @types/node, which tsconfig's "types" relies on [`577265b`](https://github.com/thkruz/ootk/commit/577265b9cef1c8c3c52b6bcca9a06136255b1d0d)
- fix(utils): :bug: add ASTEROID to the space object type string map [`0958dc1`](https://github.com/thkruz/ootk/commit/0958dc1129d80f0eec37c2343c32218d6ee0f707)
- feat(types): :sparkles: add ASTEROID to SpaceObjectType [`b4668f8`](https://github.com/thkruz/ootk/commit/b4668f8167089995f30e4e9bc8e88e3a335d91b7)
- chore(mailmap): :wrench: add .mailmap for author mapping [`5c5af87`](https://github.com/thkruz/ootk/commit/5c5af87f4d208c0d5ad27dae3a548469c630e082)

#### [v7.0.3](https://github.com/thkruz/ootk/compare/v7.0.2...v7.0.3)

> 6 July 2026 

- Fix GitHub Pages deployment and custom domain serving [`#49`](https://github.com/thkruz/ootk/pull/49)
- fix(docs): :bug: serve docs at custom-domain root (base '/') and persist CNAME [`90c9dc5`](https://github.com/thkruz/ootk/commit/90c9dc5a69385f733e7263e6ef57793daf3ea1f7)
- fix(docs): :bug: auto-enable github pages in deploy workflow [`53ae2ed`](https://github.com/thkruz/ootk/commit/53ae2ed5a9a6faeb9174c49bcd5806566d66e173)
- chore(release): :wrench: 7.0.3 [skip ci] [`a8139f2`](https://github.com/thkruz/ootk/commit/a8139f22f66014692d78b8ab72162f3779574213)

#### [v7.0.2](https://github.com/thkruz/ootk/compare/v7.0.1...v7.0.2)

> 6 July 2026 

- Improve documentation deployment and optimize performance [`#48`](https://github.com/thkruz/ootk/pull/48)
- chore(benchmark): :wrench: add benchmark harness comparing ootk to satellite.js [`6aa8d60`](https://github.com/thkruz/ootk/commit/6aa8d605c504fa5972c266227abc2f6230dc32cb)
- chore(docs): :wrench: deploy vitepress docs to github pages [`0546969`](https://github.com/thkruz/ootk/commit/0546969cd87bbd2d99d14c98b3173cdbfb221b31)
- perf(objects): :zap: memoize Satellite time-variable computation for catalog sweeps [`4322788`](https://github.com/thkruz/ootk/commit/432278808a8e4e572369846ea9bc640478da9928)
- perf(utils): :zap: speed up dopplerFactor hot path [`10a5f3a`](https://github.com/thkruz/ootk/commit/10a5f3a3260cc05bd5caaf7f9119419fb9ee7ed1)
- fix(transforms): :bug: use observer altitude in lla2sez instead of hardcoded 0 [`ba1d434`](https://github.com/thkruz/ootk/commit/ba1d43442a862ff24accc3548dfb4ca603e2c0e9)
- chore(release): :wrench: 7.0.2 [skip ci] [`f13b45a`](https://github.com/thkruz/ootk/commit/f13b45a0c5114575d62000f03c796c88ee015ae6)

#### [v7.0.1](https://github.com/thkruz/ootk/compare/v7.0.0...v7.0.1)

> 6 July 2026 

- Increase propagator timeouts and adjust release gate settings [`#47`](https://github.com/thkruz/ootk/pull/47)
- fix(release): :bug: skip husky pre-push hook in CI so semantic-releas… [`#46`](https://github.com/thkruz/ootk/pull/46)
- v7.1.0 [`#45`](https://github.com/thkruz/ootk/pull/45)
- refactor(coordinate): :recycle: break circular dependencies via alpha5 extraction and frame co-location [`4a50290`](https://github.com/thkruz/ootk/commit/4a50290e293a2e91c482260c8be17f4dcc8dcdad)
- refactor(ootk): :recycle: de-barrel main-barrel imports to concrete module paths [`9378608`](https://github.com/thkruz/ootk/commit/93786085d0a7e38ce0625cd8eef22abb1b7c097f)
- chore(eslint): :wrench: migrate to ESLint 9 flat config [`caaf27a`](https://github.com/thkruz/ootk/commit/caaf27a3036abd6e455b7fe12458bbe39da4ba98)
- style(ootk): :art: resolve ESLint 9 lint violations in source [`1c5e5a7`](https://github.com/thkruz/ootk/commit/1c5e5a7788f86fc6446bc66bde3cf03089e74f44)
- test(integration): :white_check_mark: update export snapshot for new API surface [`8dde3ef`](https://github.com/thkruz/ootk/commit/8dde3ef1d47cdbf8130e8ee264305783a1cd08e7)
- test(ootk): :white_check_mark: resolve ESLint 9 lint violations in tests [`c4a601b`](https://github.com/thkruz/ootk/commit/c4a601bb1c7a40bbde2a155c4f57482569a96dc3)
- chore(release): :wrench: automate npm releases with semantic-release and husky pre-push [`a507bd3`](https://github.com/thkruz/ootk/commit/a507bd3f4802be1b653680b1b5b0efd3bdfbb791)
- chore(ci): :wrench: gate circular dependencies with a ratchet and document them [`f2c6977`](https://github.com/thkruz/ootk/commit/f2c6977dae37ca1c44cac80092679b37e32aad64)
- chore(release): :wrench: slim release gate to build-only and trust PR CI for tests [`ea1ca12`](https://github.com/thkruz/ootk/commit/ea1ca12f4f9bc99206205e5222765854d66218cf)
- test(propagator): :white_check_mark: raise slow propagator-accuracy timeouts to 60s for CI headroom [`104680f`](https://github.com/thkruz/ootk/commit/104680fcaf6bd6d1af471599784cd6937c340c31)
- fix(release): :bug: skip husky pre-push hook in CI so semantic-release can push [`92b47d4`](https://github.com/thkruz/ootk/commit/92b47d48c2f79e441e4aecda18164d9851c71489)
- chore(release): :wrench: 7.0.1 [skip ci] [`16f3694`](https://github.com/thkruz/ootk/commit/16f369428237f8b7e023f3540cdb30ae8b372e08)

### [v7.0.0](https://github.com/thkruz/ootk/compare/v6.0.7...v7.0.0)

> 2 July 2026 

- fix(examples): :bug: repair example scripts against current API [`086771c`](https://github.com/thkruz/ootk/commit/086771c73d9c7895d27dfd22bd813ef48c3ea4c4)
- docs(vitepress): :memo: add VitePress documentation site with example walkthroughs [`1d8d230`](https://github.com/thkruz/ootk/commit/1d8d2305d46a447e6dba6218514bac5a1fc4e931)
- feat(orbit-design): :sparkles: add computeInclinationFromAzimuth helper [`8e5129e`](https://github.com/thkruz/ootk/commit/8e5129e8cca3be2da362847d94630cee2c2fbe96)
- ci: :wrench: run CI on Node 24 (npm 11) to fix package-lock sync; bump engines to node &gt;=20 [`c181ac5`](https://github.com/thkruz/ootk/commit/c181ac5bd352f90180a8eb44ec6648912b1cf056)
- test(exports): :white_check_mark: add localeCompare compare function to export key sorts [`ea0b454`](https://github.com/thkruz/ootk/commit/ea0b4542f9edd4ecc5c317f903d43e6d63087e8c)
- style(keywords): :art: reorder keywords in package.json [`1344643`](https://github.com/thkruz/ootk/commit/1344643977fafa19e41bc5acb7de8f4440ce5a42)
- fix(observation): :bug: export Observation classes from package root [`77f4e64`](https://github.com/thkruz/ootk/commit/77f4e641439d3fb41c086d6dbf80b3935c3426c3)
- chore(deps): :wrench: bump vitepress to 2.0.0-alpha.17 to clear dev-server CVEs [`151051c`](https://github.com/thkruz/ootk/commit/151051cd34e8c39694950714adc4de493909dcd4)
- chore: :wrench: update package-lock.json for dependencies [`83d8037`](https://github.com/thkruz/ootk/commit/83d8037f7452540489daf2791594476aa16c1feb)

#### [v6.0.7](https://github.com/thkruz/ootk/compare/v6.0.6...v6.0.7)

> 23 June 2026 

- feat(orbit-determination): :sparkles: add rv2tle for IOD from state vectors [`23178b0`](https://github.com/thkruz/ootk/commit/23178b087f171b6c31716090b0c0a33cec37e7d6)
- test(Satellite): :white_check_mark: pin sccNum derivation across all 5 sccNum forms [`01c704b`](https://github.com/thkruz/ootk/commit/01c704bdcd786d60bc7e3919df5721f1ac7d8d98)
- feat(Satellite): :sparkles: enforce display-canonical numeric sccNum invariant [`bc10faf`](https://github.com/thkruz/ootk/commit/bc10faf42c8a5d35ae93702349fe480e8e123905)
- fix(tle): :bug: handle real-world TLE edge cases in parsing and age [`e69f602`](https://github.com/thkruz/ootk/commit/e69f602642f1fe2a5ea668cb78e1e66fef31f0a6)
- test(parsers): :white_check_mark: add OdmExporter KVN export tests [`2f05f07`](https://github.com/thkruz/ootk/commit/2f05f070b134c9a8b60673a4d10727dcb20ed3bd)
- feat(photometry): :sparkles: add RCS-based visual magnitude estimator [`25debfd`](https://github.com/thkruz/ootk/commit/25debfd1523fe1dde4b57dcb8231077402ab61e0)
- feat(covariance): :sparkles: add RIC display-radii scaling helper [`0fdb613`](https://github.com/thkruz/ootk/commit/0fdb613101cfacc16fce4cea17a4d94036eb1e73)
- test(OrbitFinder): :white_check_mark: pin extended-sccNum TLE generation behavior [`2f061e1`](https://github.com/thkruz/ootk/commit/2f061e1a8670b129761aef841f9f7d1933268c64)
- fix(tle): :bug: tolerate blank catalog number on JSC Vimpel TLEs [`edcc5a6`](https://github.com/thkruz/ootk/commit/edcc5a69d7657b4eb5e27ff83294962382b589ef)
- feat(covariance): :sparkles: add cappedScreeningCovarianceFromTle for debris screening [`66b3955`](https://github.com/thkruz/ootk/commit/66b395547bbb0f39c92720d2f92e7cd0099cce8e)
- feat(Satellite): :sparkles: strip leading zeros from sccNum for natural-number canonical form [`7b06e93`](https://github.com/thkruz/ootk/commit/7b06e93ff63b6f2758c9ae674319190a70abf459)
- fix(OrbitFinder): :bug: keep TLE satnum 5-char for extended sccNums [`e206d29`](https://github.com/thkruz/ootk/commit/e206d291aeaf694b0470c7d5ec4206f3978cd1f6)
- fix(time): :bug: use full time-of-day precision in TLE epoch generation [`e3c3f28`](https://github.com/thkruz/ootk/commit/e3c3f28c387a083ca419a63231fd805e91048997)
- test(tle): :white_check_mark: update snapshot for full-precision TLE epoch [`188e487`](https://github.com/thkruz/ootk/commit/188e487b51da9dbd7718dade62eaa80186c9ddca)
- fix(sgp4): :bug: handle blank Vimpel catalog number in createSatrec [`6d13f77`](https://github.com/thkruz/ootk/commit/6d13f77fa38a84e898b26032eede079c9d3de9e3)

#### [v6.0.6](https://github.com/thkruz/ootk/compare/v6.0.5...v6.0.6)

> 29 November 2025 

- docs: add comprehensive advanced features guide [`#41`](https://github.com/thkruz/ootk/pull/41)
- docs: add comprehensive user guide and getting started documentation [`#39`](https://github.com/thkruz/ootk/pull/39)
- feat: add high accuracy conjunction assessment workflow [`#37`](https://github.com/thkruz/ootk/pull/37)
- feat: add comprehensive examples for library features [`#38`](https://github.com/thkruz/ootk/pull/38)
- Lambert Satellite Integration [`#36`](https://github.com/thkruz/ootk/pull/36)
- test: :camera_flash: update snapshots to deal with floating point errors [`9ee23a1`](https://github.com/thkruz/ootk/commit/9ee23a1d10977db13142cea65e4d2405ef3a5573)
- feat(ootk): :sparkles: add interpolator, maneuver and orbit-design modules [`dd8e395`](https://github.com/thkruz/ootk/commit/dd8e395a90ce63338b1e97edab863932d998c2dc)
- test(satellite): :white_check_mark: add unit tests for propagators [`d7ef3b5`](https://github.com/thkruz/ootk/commit/d7ef3b5322e0fe848823fa0b8e0054aac76adcf7)
- feat(parsers): :sparkles: add OMM parser and types [`253b1c2`](https://github.com/thkruz/ootk/commit/253b1c2208325997b2fa9ef19a79363b36c506fe)
- test(integration): :white_check_mark: add pre-publish integration tests [`f50e22a`](https://github.com/thkruz/ootk/commit/f50e22a6b33213ba9daba13d1e9f196e2261bebe)
- feat(parsers): :sparkles: add OdmExporter and export options [`dc43ffc`](https://github.com/thkruz/ootk/commit/dc43ffc641aac466a2a3700dbd714988df989209)
- docs: :memo: update copyright year to 2025-2026 [`0cceb50`](https://github.com/thkruz/ootk/commit/0cceb50c1878f0e04a148da529ae0b5850fd83ab)
- test(OmmParser): :white_check_mark: add unit tests for OMM parsing [`057a7fd`](https://github.com/thkruz/ootk/commit/057a7fde4925f81dbb1beb2784a83bd8f50eb415)
- feat(Satellite): add support for OMM ID conversion and classification of satellite catalog numbers [`379e9b5`](https://github.com/thkruz/ootk/commit/379e9b5062f9d222736d83d6f36ae0e90af49559)
- test(FormatTle): :white_check_mark: add CelesTrak stations validation tests [`773cf97`](https://github.com/thkruz/ootk/commit/773cf97e74a0e628698ef5371e248c5fe5aae3d4)
- refactor(objects): :recycle: remove PropagatorType from ObjectTypes [`98d4d8f`](https://github.com/thkruz/ootk/commit/98d4d8ff5ae42e48be4e369a77ba34e95a0e6dd5)
- test(Tle): :white_check_mark: add tests for meanMoDev1 and bstar parsing [`13ee240`](https://github.com/thkruz/ootk/commit/13ee240644b242123e0780557721d18247ae4ee9)
- fix(HorizonsParser): :bug: improve target name extraction logic [`37f600a`](https://github.com/thkruz/ootk/commit/37f600aa0649e6deac3b110baba51ee8b6fade3e)
- feat(OdmExporter): :sparkles: add OEM export from state vectors [`d738f8a`](https://github.com/thkruz/ootk/commit/d738f8a012d2a33512387e451e559eca26b02de7)
- feat(FormatTle): :sparkles: enhance TLE generation with new formatting [`c7cc06f`](https://github.com/thkruz/ootk/commit/c7cc06fb7b3470937f43ef79c175a7d07297b961)
- style: :art: fix indentation and license header in source files [`d43bdb7`](https://github.com/thkruz/ootk/commit/d43bdb70b7df5b911c623739da4aa319dc3168d8)
- chore(gitignore): :wastebasket: update .gitignore to include propagator accuracy summary file [`a87119c`](https://github.com/thkruz/ootk/commit/a87119c2f3624c157abda186c4754cbb81493239)
- test(propagator): :white_check_mark: add SP3 accuracy comparison results [`d06617c`](https://github.com/thkruz/ootk/commit/d06617ce6b5311b720a55c157ee261ec30a0197b)
- docs: :memo: update documentation [`fa530aa`](https://github.com/thkruz/ootk/commit/fa530aaec393a40b518549ef2bbd1b234c8c60e6)
- feat(Satellite): :sparkles: update OMM parsing to use Number [`8e5357c`](https://github.com/thkruz/ootk/commit/8e5357c784ad57bf15997af627a6f5ca9536bb87)
- feat(OmmParser): :sparkles: add JSON parsing for CelesTrak OMM [`42587bc`](https://github.com/thkruz/ootk/commit/42587bcbacbef5942f3a6a6bae9cf9d9efa09a8f)
- feat(numerical-propagator): :sparkles: add NumericalPropagatorOptions interface [`5723c02`](https://github.com/thkruz/ootk/commit/5723c020791f1bec0e920e088ac106f84d7b4854)
- feat(OmmFormat): :sparkles: update data format to support numeric types [`1a051ff`](https://github.com/thkruz/ootk/commit/1a051ffe7e517adbc895678bc0378dc9530491c9)
- feat(enums): :sparkles: add PropagatorType enum with implementations [`20fd9f6`](https://github.com/thkruz/ootk/commit/20fd9f6230639d702124fdc8c087fbdb5c8b800e)
- fix(ClassicalElements): :bug: handle equatorial orbits in fromStateVector [`1b6d7f9`](https://github.com/thkruz/ootk/commit/1b6d7f9b2aac09994df5f433da49e0c432d09f88)
- fix(FormatTle): :bug: fix TLE formatting to match NORAD/CelesTrak conventions [`8862276`](https://github.com/thkruz/ootk/commit/88622764a3b6828ccd2ed953925ccafa763ea2a5)
- fix(package): :bug: fix license typo and configure dual ESM/CJS exports [`ba956a8`](https://github.com/thkruz/ootk/commit/ba956a80b5370d724ce0582ab8794d79cff03fc6)
- fix(Epoch): :bug: allow pre-1970 POSIX timestamps for historic TLEs [`3776ada`](https://github.com/thkruz/ootk/commit/3776ada2110a623f85a94ff087982a4a8094a26d)
- test(EpochUTC): :white_check_mark: add tests for pre-1970 dates [`d58ec39`](https://github.com/thkruz/ootk/commit/d58ec395163f29610c313c3d434ac93131460194)
- fix(CatalogSource): :bug: update catalog source names to match standards [`a28ef5d`](https://github.com/thkruz/ootk/commit/a28ef5d0d2681f63f5c79f75570e4539f203ebf0)
- feat(TleParams): :sparkles: add additional satellite parameters [`e3e4ef8`](https://github.com/thkruz/ootk/commit/e3e4ef87c94275e42c13c0beedd390e70a655031)
- chore(ci): :wrench: add Node 18 to test matrix [`a851aec`](https://github.com/thkruz/ootk/commit/a851aecad7be4df3f5aa1daf96533c29079522c3)
- feat(Satellite): :sparkles: add fromOmm method for satellite creation [`6dfb390`](https://github.com/thkruz/ootk/commit/6dfb39027b67875ccaf8987da49218f2a17113d6)
- chore(build): :wrench: bundle astronomy-engine and add CJS output [`1ed5e98`](https://github.com/thkruz/ootk/commit/1ed5e98fcdff33228e06a00016a6f292863695d3)
- fix(Tle): :bug: add debug info for TLE line validation [`84bc268`](https://github.com/thkruz/ootk/commit/84bc2687816ce2ea7b9a987604f4f3d0fc5e98b1)
- fix(sgp4): :bug: handle decayed satellites in Sgp4 class [`c4b985a`](https://github.com/thkruz/ootk/commit/c4b985af00f74ec04bb8ccd1c8168384d28b011d)
- test(FormatTle): :white_check_mark: update test expectations for new TLE formatting [`a522f08`](https://github.com/thkruz/ootk/commit/a522f0803334f6cd6107335b80217cb9f45ac228)
- fix(Tle): :bug: handle '0' as valid BSTAR symbol [`7dded61`](https://github.com/thkruz/ootk/commit/7dded6167597678d2a749954f4416b2283008928)
- chore(package): :wrench: bump version to 6.0.5 [`5063a8d`](https://github.com/thkruz/ootk/commit/5063a8d3233291b6f9902f2eae69517aa7679554)
- chore(.gitignore): :wrench: add .dev.vars to ignore list [`355e740`](https://github.com/thkruz/ootk/commit/355e740a6179e78e267cbbd16527b2e4bb86a51c)
- fix(Tle): :bug: handle additional BSTAR exponent symbols [`2b31e4f`](https://github.com/thkruz/ootk/commit/2b31e4fc097582ee8644ebec50b4c20ef4e41932)
- chore(package): :wrench: bump version to 6.0.2 [`9573455`](https://github.com/thkruz/ootk/commit/9573455557ac8e0782ad08f7337eb543449016ae)
- fix(CatalogSource): :bug: add UNKNOWN source to enum [`0e0054e`](https://github.com/thkruz/ootk/commit/0e0054e8c7da919967da3a716a6304b0bc55fd8d)
- chore(package): :wrench: bump version to 6.0.4 [`4925527`](https://github.com/thkruz/ootk/commit/4925527adfc91e88e5884db1d28cab840ce9981d)
- refactor: :recycle: update and modernize body module to use astronomy-engine [`a56c10c`](https://github.com/thkruz/ootk/commit/a56c10cbd7abe03a4c78cad8fc6aa488fef53298)
- feat: :sparkles: Add CDM types and parsing/exporting logic [`85ddedd`](https://github.com/thkruz/ootk/commit/85ddedd2b373b3f27a5657f9e7eee7607e304d41)
- test: :sparkles: add integration tests for core functionality [`f8c380c`](https://github.com/thkruz/ootk/commit/f8c380c36322b4a6bfbe09b36989d2c93bc5b0f5)
- refactor: :recycle: complete phase 1A of objects module refactor [`0f75b33`](https://github.com/thkruz/ootk/commit/0f75b33f603b1e710e63c2084806f415d737c4c1)
- feat: :sparkles: Add communication devices and tests [`e840337`](https://github.com/thkruz/ootk/commit/e840337e90feff225af9243e654802c4981d01e9)
- feat: :sparkles: Add OEM parsing and data structures [`c0967d1`](https://github.com/thkruz/ootk/commit/c0967d1efe1c788dd3628ddf41ad3e3e57a1a8e7)
- feat: :sparkles: add PassiveRFSensor and PhasedArrayRadar classes [`935a778`](https://github.com/thkruz/ootk/commit/935a77826c5bc2033609f2136fd81eaeda84b543)
- test: :rocket: add LambertIOD test suite for orbit determination [`c26343b`](https://github.com/thkruz/ootk/commit/c26343b7cf581568f28ec6d49aefb0e146fd11d7)
- refactor: :recycle: Rename ECF to ECEF in codebase [`0ef09ea`](https://github.com/thkruz/ootk/commit/0ef09ea91930eb5eb235732a3e2069523ed06346)
- Implement tests for GaussIOD and GoodingIOD; refactor ModifiedGoodingIOD and RungeKuttaAdaptive for improved error handling and integration logic [`5da537b`](https://github.com/thkruz/ootk/commit/5da537b9c82cecdfddc4284f805a927ca9cd043b)
- test: :zap: improve test performance [`cd82439`](https://github.com/thkruz/ootk/commit/cd8243917a413aeabe2542657e93b0e595b3c58e)
- feat: :sparkles: Add ScheduledContact and tests [`fa11c93`](https://github.com/thkruz/ootk/commit/fa11c93687c2cc0687bd473b21efe699fa9581ec)
- test: :white_check_mark: Add tests for DynamicGroundObject [`e35c4a9`](https://github.com/thkruz/ootk/commit/e35c4a99d997436bf0148999f7cd1e7ab9c357f1)
- test: :sparkles: add comprehensive tests for Levenberg-MarquardtOD [`c9d458a`](https://github.com/thkruz/ootk/commit/c9d458af8f27c587bce68e4108a1f4633e9fa18e)
- docs: add Lambert integration guide and examples [`eb83cf5`](https://github.com/thkruz/ootk/commit/eb83cf50fa19e2115be0577938e4c7594391d10c)
- docs(time): enhance documentation for time classes and conversions [`6dd3c5e`](https://github.com/thkruz/ootk/commit/6dd3c5ead6f431cf6ea1b2c790c2f14fcc012a88)
- feat: :sparkles: Add RepeatGroundTrack and tests [`4541925`](https://github.com/thkruz/ootk/commit/4541925c44d77b0aef1501cba620cfbb759b9cfb)
- chore(ootk): standardize imports/exports, refine base APIs, bump version [`8a6a365`](https://github.com/thkruz/ootk/commit/8a6a3656ce392f3a9663693046097e7b5eacb648)
- test: :white_check_mark: add integration tests for built package [`688f339`](https://github.com/thkruz/ootk/commit/688f339f4881190debee54507edb302ddbce080d)
- refactor: 🔧 rename private methods for consistency and clarity [`34d28e0`](https://github.com/thkruz/ootk/commit/34d28e04a1a8aa54deeeaa2d0cc1e756cc9bd33c)
- feat: :sparkles: add AccessCalculator and AccessWindow types [`32abe79`](https://github.com/thkruz/ootk/commit/32abe795021435356c2a2910e0d7e5894e11ee5d)
- test: :camera_flash: update coordinate module snapshots for Vitest [`5135e7e`](https://github.com/thkruz/ootk/commit/5135e7e36cc0f7c8bd2209e08578b50c9eaaebc3)
- test: :camera_flash: update coordinate module snapshots for Vitest [`c35f910`](https://github.com/thkruz/ootk/commit/c35f910da78215889c22daced8bb1db8f849e12d)
- test: :white_check_mark: add tests for interpolators [`43e9aad`](https://github.com/thkruz/ootk/commit/43e9aadb3593c811518652b2c9a6503431edfa08)
- feat: :sparkles: Add ConstellationGenerator and tests [`c50d16f`](https://github.com/thkruz/ootk/commit/c50d16f5b6fe1c43364a9561abd43c4551894249)
- feat: :sparkles: Add custom error classes for ootk [`79baa37`](https://github.com/thkruz/ootk/commit/79baa377dd288d175c6eaee3769076ca70ea5099)
- feat: :sparkles: add VisualizationHelpers and related types [`278e8bd`](https://github.com/thkruz/ootk/commit/278e8bd513b0f84d83b535f79adcff929badafff)
- docs: :memo: add comprehensive coordinate systems guide [`24bfedd`](https://github.com/thkruz/ootk/commit/24bfedd71c5517cd99f3cb97c2487379d3308c37)
- test: :truck: move tests into __tests__ folders for easier management [`bd907d8`](https://github.com/thkruz/ootk/commit/bd907d80bcf91842cf673bfe1d6fd59cabecfbdd)
- feat: :sparkles: add clone methods for sensor and device classes [`51cbb97`](https://github.com/thkruz/ootk/commit/51cbb977db928a623f3b7741b399443714a42c28)
- feat: :sparkles: add OrbitFinder class for satellite orbits [`448eef9`](https://github.com/thkruz/ootk/commit/448eef9f5dc16aeca45eca6e7c6cc1e3ffdde2c7)
- feat: :sparkles: add SunStatus enum for illumination states [`97c188b`](https://github.com/thkruz/ootk/commit/97c188b31679e9f2b5cb904477f085665337a0fd)
- feat: :sparkles: Add HorizonsParser and tests [`d808d1e`](https://github.com/thkruz/ootk/commit/d808d1eaed2fc03d8db4596686a8d7dfec822d42)
- test: :camera_flash: update operations module snapshots for Vitest [`0547cc3`](https://github.com/thkruz/ootk/commit/0547cc3b92c63d64a3efd28c022df2656a8292ed)
- test: :camera_flash: update operations module snapshots for Vitest [`725d6ea`](https://github.com/thkruz/ootk/commit/725d6ea72e12cd6d0a7e1fea7ab9f3f2a100e61b)
- refactor: :recycle: change sensor and object IDs to numbers [`d69137b`](https://github.com/thkruz/ootk/commit/d69137b2e41f4bd204f1fc8ee0a18533449216ea)
- build: :arrow_up: upgrade all dependencies to most current [`fedc88b`](https://github.com/thkruz/ootk/commit/fedc88bdbbe3acd087509e5e33b4d62bbbaf7e05)
- test(create-covariance-from-tle): :sparkles: add tests for covariance creation from TLE [`6ace6b2`](https://github.com/thkruz/ootk/commit/6ace6b21197790ce75e067a2243728dd843231cd)
- feat(ootk): :satellite: add NASA JPL Horizons client + constants/interfaces; extend SpaceObjectType with planetary/moon types and update tsconfig lib [`76ed1f7`](https://github.com/thkruz/ootk/commit/76ed1f7e05c37cc1cde69887acea2a6153275c4f)
- remove: :fire: delete Horizons API client and constants [`18aed53`](https://github.com/thkruz/ootk/commit/18aed53fa6b114095d20a9c214a66a9f6afc482e)
- test(sgp4): :white_check_mark: add unit tests for Sgp4Propagator functionality [`038c912`](https://github.com/thkruz/ootk/commit/038c9128d705507acbe7638da00fe03464d92539)
- test(propagator): :white_check_mark: add unit tests for MockPropagator and RungeKutta4Propagator [`84aef88`](https://github.com/thkruz/ootk/commit/84aef88855c43960549dc51d45bc10056c3b978c)
- docs(readme): :sparkles: add comprehensive documentation for orbit determination algorithms [`8ed7178`](https://github.com/thkruz/ootk/commit/8ed7178536e3894a96e932a6a9d3c783a30f4097)
- docs(readme): :sparkles: add README for optimize module with examples [`491bbed`](https://github.com/thkruz/ootk/commit/491bbedff9a0a6ec257ad3d7c626de99fa584567)
- docs: :memo: update documentation for coordinate transformations [`b37ba1b`](https://github.com/thkruz/ootk/commit/b37ba1b13adf7269fe90ba242f34f2a6a333af58)
- test: :white_check_mark: add tests for optimization algorithms [`78199f4`](https://github.com/thkruz/ootk/commit/78199f46933af9497340c3d29a4723d8a46cf1d2)
- feat: :sparkles: add history tracking to Satellite class [`5ab6b1e`](https://github.com/thkruz/ootk/commit/5ab6b1e2bb0d4133e65d7d27c2ec1ba876c9eccc)
- test(kepler): :white_check_mark: add comprehensive tests for KeplerPropagator [`cc61975`](https://github.com/thkruz/ootk/commit/cc61975031e58ed91a38fedfc6f61e45d44b200a)
- feat: :sparkles: make lat, lon, alt properties readonly [`f3ad72c`](https://github.com/thkruz/ootk/commit/f3ad72c9e7a2ed0c831e8f491a146bbf63599952)
- docs(readme): :memo: add detailed documentation for orbital propagators [`6f033f2`](https://github.com/thkruz/ootk/commit/6f033f26caa9d46b09e74310ab656ec320b23a44)
- test: :camera_flash: update observation module snapshots for Vitest [`cc1d7d5`](https://github.com/thkruz/ootk/commit/cc1d7d5869654d7576f9e21452f7ec859d9a16ba)
- test: :camera_flash: update observation module snapshots for Vitest [`26e205b`](https://github.com/thkruz/ootk/commit/26e205bac9152eaa0a4fe019bb4ab10ce3166018)
- feat: :sparkles: implement RAE methods in SpaceObject class [`2f00d20`](https://github.com/thkruz/ootk/commit/2f00d20109d3cae549bf1c2d8e12a922da1ebe5d)
- refactor(simplex): :recycle: move SimplexEntry to internal directory [`0680b95`](https://github.com/thkruz/ootk/commit/0680b951724845c032030b26baa0136329f11474)
- refactor(smoothing): :recycle: convert ExponentialSmoothing class to functions [`e0c978b`](https://github.com/thkruz/ootk/commit/e0c978b6c38811a8b8675bafb54c06ef0725b349)
- test: :white_check_mark: add tests for Hill class methods [`475acc3`](https://github.com/thkruz/ootk/commit/475acc3334dbba4717d7f250d4fffff3e3c14a65)
- docs(golden-section): :memo: enhance documentation and examples for optimizer [`b627eaf`](https://github.com/thkruz/ootk/commit/b627eaf6fa6a00ceceb3b28d10756cbf3498a383)
- test: :camera_flash: update time module snapshots for Vitest [`1f427ff`](https://github.com/thkruz/ootk/commit/1f427ff3b6d082bdc9bdf0d9e72e550e02ef804d)
- feat: :sparkles: add validation errors for sensor parent checks [`824c8bf`](https://github.com/thkruz/ootk/commit/824c8bf41348ccdd68928301de0e5bc350721058)
- test: :camera_flash: update time module snapshots for Vitest [`aa0313b`](https://github.com/thkruz/ootk/commit/aa0313ba8264a3864abe439d8df4180841d03e95)
- feat: :sparkles: enhance visibility checks for Transmitter [`1701853`](https://github.com/thkruz/ootk/commit/1701853a8ec4f0cf26ae6432ec7134f6b1b8ec98)
- feat: :sparkles: add history tracking and cloning options [`261dc52`](https://github.com/thkruz/ootk/commit/261dc52c98dd18c9c2a598a327c51e14f5feb84d)
- refactor: :recycle: replace EciVec3 with TemeVec3 types [`00e3af3`](https://github.com/thkruz/ootk/commit/00e3af33ddcbdebf57c3b771c9ae1af649e3b190)
- refactor: :recycle: streamline imports and enhance AccessWindow [`6a71aec`](https://github.com/thkruz/ootk/commit/6a71aec8504b9f797cfe7a1f5c1afc80f00ee6d2)
- refactor(polynomial-regression): :recycle: move PolynomicalRegressionResult to internal directory [`c6a7fd5`](https://github.com/thkruz/ootk/commit/c6a7fd5eb88b4b0b05113ecc33ee017399ddcc3e)
- docs: :memo: add examples for SunBody, Satellite, and Sensor [`f4a1c9e`](https://github.com/thkruz/ootk/commit/f4a1c9e0681b34e8f8d409a15bd2d0bd390ef2e4)
- docs(simple-linear-regression): :memo: enhance class documentation and examples [`23ce52f`](https://github.com/thkruz/ootk/commit/23ce52f1ab650db9654f4faae254fbe6ad9215d6)
- docs(polynomial-regression): :memo: enhance documentation and examples for optimizer [`9f8c019`](https://github.com/thkruz/ootk/commit/9f8c019666aea11e1e2a2f63343142f67ba727ec)
- build: :building_construction: migrate to tsup for ESM builds [`5b505cd`](https://github.com/thkruz/ootk/commit/5b505cd15c1218b45d8072fcae42de2f95732da9)
- test: :white_check_mark: migrate test files from Jest to Vitest [`3bdcf24`](https://github.com/thkruz/ootk/commit/3bdcf24f746833a03aa8acc076e080babe8aaa7c)
- test: :truck: move tests into __tests__ folders for easier management [`507cb3d`](https://github.com/thkruz/ootk/commit/507cb3d2a2081c538506568ede11e98707836de8)
- refactor: :recycle: update SpaceObject to use TEME frame [`1b046f9`](https://github.com/thkruz/ootk/commit/1b046f9b9ddb030f38758f1ca7de1c92fa07365c)
- refactor(orbit_determination): improve GoodingIOD and ModifiedGoodingIOD structure [`993a790`](https://github.com/thkruz/ootk/commit/993a79065cabb4b8b562b4bf0c45436b25265d3a)
- build: :wrench: migrate from Jest to Vitest [`4138c43`](https://github.com/thkruz/ootk/commit/4138c4380bcd6c97bfeafe66078551f8eb3f8111)
- test: :white_check_mark: add tests for ephemerisManeuver [`3b8e24f`](https://github.com/thkruz/ootk/commit/3b8e24ff9916bdb1a7ff04a3baa1986ae80d2a75)
- feat: :sparkles: add angle calculations for satellites and Sun [`5d2fc8a`](https://github.com/thkruz/ootk/commit/5d2fc8affc7af755c377638e835e2aede6289dde)
- chore(gitignore): :sparkles: add CLAUDE.md to .gitignore [`3b32de8`](https://github.com/thkruz/ootk/commit/3b32de845f568b88893d4cc2db6a5d2740a9829f)
- build: :wrench: add ESM import path fixer for dist output [`07be71c`](https://github.com/thkruz/ootk/commit/07be71c7b14140bb8f93a364afe63f0111ce2596)
- test: :white_check_mark: add tests for ModifiedGoodingIOD [`3795c53`](https://github.com/thkruz/ootk/commit/3795c531c4fe4f968eb64fa3d0d959bfcbc79799)
- refactor(conjunction): :recylce: update ConjunctionEvent constructor to use params object [`284dc02`](https://github.com/thkruz/ootk/commit/284dc02b6573ef7be66fa9721c47539d3bb5dfe7)
- test: :white_check_mark: add integration test infrastructure with Vitest [`0431ecc`](https://github.com/thkruz/ootk/commit/0431eccd2c9b19b4724ba8dc816d0397aae7a1d6)
- test: :camera_flash: update utils module snapshots for Vitest [`76daf1e`](https://github.com/thkruz/ootk/commit/76daf1ea2c9d1a8e5801cb35e6e7cf675d1d4a0d)
- test: :white_check_mark: add unit tests for conversions [`ec789f4`](https://github.com/thkruz/ootk/commit/ec789f4b9e786559b3807afdf8fda6f7a28fdc23)
- feat: :sparkles: add interpolator and maneuver modules [`6f94279`](https://github.com/thkruz/ootk/commit/6f94279d25a2f17c7743e990f5ac62110af8707d)
- test: :camera_flash: update utils module snapshots for Vitest [`f7930db`](https://github.com/thkruz/ootk/commit/f7930db9a19e6f55fc190fd891572b62a2aa9753)
- refactor(chebyshev): :recycle: improve documentation and method naming [`007d17e`](https://github.com/thkruz/ootk/commit/007d17e271119593b21292bf3fc1a3a0efdd6899)
- refactor(conjunction): :sparkles: reorganize imports and improve covariance handling [`e1a0d28`](https://github.com/thkruz/ootk/commit/e1a0d28e5cdeb9253d35fe559658b21f73c8bc5b)
- test: :camera_flash: update transforms module snapshots for Vitest [`16ac8a4`](https://github.com/thkruz/ootk/commit/16ac8a4cc616d0e9469e4d135913a6ba378f2a24)
- test: :camera_flash: update transforms module snapshots for Vitest [`bf3fecb`](https://github.com/thkruz/ootk/commit/bf3fecbe021bc2502acf1859ea49945f0b9afb2d)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from imports [`04efea0`](https://github.com/thkruz/ootk/commit/04efea0bf93c96d4239367553488bca90c11755e)
- refactor(downhill-simplex): :recycle: improve method naming and documentation [`acfb462`](https://github.com/thkruz/ootk/commit/acfb4621fe29816a5a3baeb06351050a7494ad3d)
- refactor: :recycle: update sensor imports and exports [`33d40e4`](https://github.com/thkruz/ootk/commit/33d40e4c5b0469d5422d8953060b7ffec4e63ae2)
- ci: :construction_worker: add circular-check and integration test jobs [`bf9fa35`](https://github.com/thkruz/ootk/commit/bf9fa3502a321828233437bdf772fd4cdb98fc5e)
- test: :camera_flash: update body module snapshots for Vitest [`b3ff8e4`](https://github.com/thkruz/ootk/commit/b3ff8e402ffb000f8ae94ff77cc58a2d23c9e73c)
- test: :camera_flash: update body module snapshots for Vitest [`7589ca4`](https://github.com/thkruz/ootk/commit/7589ca487eab7294121ddcddd2f2e307ed43d6f2)
- feat: :sparkles: add fromPosVel method for RIC coordinates [`93b0e68`](https://github.com/thkruz/ootk/commit/93b0e68907f3f225f3a20977ffabcbab6af345b6)
- refactor: :recycle: simplify imports in multiple files [`cf97616`](https://github.com/thkruz/ootk/commit/cf97616e967f16e7e351abe8396023d960d9af3e)
- test(body): update Moon snapshots for getMoonTimes (including timezone adjustment) and rae [`7612eca`](https://github.com/thkruz/ootk/commit/7612eca02a77dc5d53ddb56a2e5def4c6383cab5)
- fix: :bug: resolve circular dependency in types.ts [`9b9dc88`](https://github.com/thkruz/ootk/commit/9b9dc88012a2efb2d32458bf8d2ac63797f45a81)
- feat: :sparkles: add additional star parameters to interface [`6bf1f21`](https://github.com/thkruz/ootk/commit/6bf1f215557efd5ec49bfcf3e085dba3b572541e)
- feat: :sparkles: add PayloadStatus type [`e691a5d`](https://github.com/thkruz/ootk/commit/e691a5db862cb9141a07a38d29ab8e5e0b7bf203)
- fix: :bug: replace @src/ path alias with relative imports [`3169ba5`](https://github.com/thkruz/ootk/commit/3169ba5cf62cc2f78e6baac5571f570ae38ea476)
- refactor: :recycle: Update sun position methods in force classes [`13dc9c0`](https://github.com/thkruz/ootk/commit/13dc9c02925a231ac724694cec8517951369a34d)
- test: :sparkles: add tests for factorial function with edge cases [`aec8e93`](https://github.com/thkruz/ootk/commit/aec8e9333fc6ca9b300afb3ee6f7861b9d0961ef)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`9bce358`](https://github.com/thkruz/ootk/commit/9bce3588b48cf3d8ed420574ab9fdf5bfa8c1b91)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`af2b4e2`](https://github.com/thkruz/ootk/commit/af2b4e2fa7cb80a11a2bd1ec0ed63ec23b48a954)
- refactor: :recycle: clean up exports in index.ts [`ee556b2`](https://github.com/thkruz/ootk/commit/ee556b2cd8fb60d818f73c8e6e6c0d913b273cc4)
- fix: :bug: correct maneuver filtering logic in propagator [`6dd0d1a`](https://github.com/thkruz/ootk/commit/6dd0d1ab2c7d9c8a36877ed0d729e5269175ef96)
- build: :wrench: add madge configuration for circular dependency detection [`c164f92`](https://github.com/thkruz/ootk/commit/c164f9206ea499ededeadcc0062850a262204c24)
- build: :package: add madge, vitest and integration test scripts [`5b93c82`](https://github.com/thkruz/ootk/commit/5b93c82a9860f2ca13efd4de667f47ef5d210eb1)
- feat: :sparkles: Integrate astronomy-engine for star position [`b8f940a`](https://github.com/thkruz/ootk/commit/b8f940aed765a5ba755eb126e20f08c09ad46d54)
- refactor(conjunction): :sparkles: remove file extensions from imports [`4df0ad8`](https://github.com/thkruz/ootk/commit/4df0ad88e1b826cdae50fcbbec7c66ca49ad6bd8)
- fix: :bug: resolve circular dependencies in operations module [`bffe544`](https://github.com/thkruz/ootk/commit/bffe544c757cda090fbc9f02d13d09ea085dbca0)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from exports [`2f1856b`](https://github.com/thkruz/ootk/commit/2f1856bbf012fc0c99d6f79569ff2f553a396e0c)
- fix: :bug: initialize Float64Arrays with coeffs length [`66565ce`](https://github.com/thkruz/ootk/commit/66565ce96e9e863c89e499eaab1f95aa73897e9c)
- refactor: :recycle: rename astronomicalUnit to KM_PER_AU and update usages in Sun & SolarRadiationPressure [`6bc4943`](https://github.com/thkruz/ootk/commit/6bc494365e8302c92b681456a0a22b090f8edf2b)
- test(create-sample-covariance-from-tle): :white_check_mark: add test for realistic covariance creation [`8e7806e`](https://github.com/thkruz/ootk/commit/8e7806e24e0b5594c1b8fa7a633d4515d2d2b67f)
- test(probability): :white_check_mark: adjust relative velocity and position for encounter plane [`9e112b0`](https://github.com/thkruz/ootk/commit/9e112b05d9570e876c661a914c6e22b194076adc)
- refactor: :recycle: Correct export test for CelestialBody [`ceb0c58`](https://github.com/thkruz/ootk/commit/ceb0c58af29369d10485ff2a4db9d98d1a1aa685)
- refactor(GaussIOD): reorganize import statements for better clarity [`842b458`](https://github.com/thkruz/ootk/commit/842b458b309cfbc78eafb162359b4a8d2c499cc9)
- feat(optimize): :sparkles: add index file to export optimization modules [`64485c2`](https://github.com/thkruz/ootk/commit/64485c2a6e2a5e3b60c9f1ba1c16174e6c7bcccf)
- refactor(functions): :sparkles: optimize log10, array2d, and distance calculations [`0c4dc65`](https://github.com/thkruz/ootk/commit/0c4dc6540d5e6d534933705c6a8a70fe3d2b8566)
- chore(ootk): bump @typescript-eslint/eslint-plugin & parser to ^8.46.2 and refresh package-lock.json [`e340ccc`](https://github.com/thkruz/ootk/commit/e340ccc84207b744e0ef1623c6f1a542fd07b5d8)
- refactor: :recycle: update tsconfig to exclude test files [`4b06dad`](https://github.com/thkruz/ootk/commit/4b06dad3133435a60562d61b22c1bf7e03776d4c)
- fix(ootk): add missing SpaceObjectType string mappings for terrestrial/gas/ice/dwarf planets and moon [`9b49f2f`](https://github.com/thkruz/ootk/commit/9b49f2f09862d4fa9bc324c913f61dea22698873)
- test: :wrench: increase timeout for ConjunctionAssessment high-fidelity tests [`7e1e498`](https://github.com/thkruz/ootk/commit/7e1e4989c2ca8a9f84cba199fc7d67c691f3bd0a)
- chore: :wrench: update .gitignore to include new files [`d8a565a`](https://github.com/thkruz/ootk/commit/d8a565a8fb9ee4e21d6a28ba92f004ac5ac6a9a1)
- chore: :wrench: update version to 6.0.0-rc.4 [`ae88268`](https://github.com/thkruz/ootk/commit/ae8826827e56168b90c162b1ef9cd86a01202e08)
- refactor(main): :sparkles: remove unnecessary file extensions from exports [`6467bfa`](https://github.com/thkruz/ootk/commit/6467bfa913cf13ce0a1e7e8573ba3efc913e58f8)
- chore(package): update version to 6.0.0-rc.2 [`6316048`](https://github.com/thkruz/ootk/commit/63160480d8c06913fa50cd5f78e9811ba530cf56)
- feat(orbit-determination): :sparkles: add maxIter option to SolveOptions [`2571b7b`](https://github.com/thkruz/ootk/commit/2571b7bceabfe3b9c7584bbf54ae4e217093bf77)
- chore(package): :wrench: bump version to 6.0.3 [`56e6b13`](https://github.com/thkruz/ootk/commit/56e6b1354b7f1c12755e0833c80af25531b5cbc3)
- test(FormatTle): :white_check_mark: fix line 2 expected value for new formatting [`198faa0`](https://github.com/thkruz/ootk/commit/198faa0b11051ed5965e157e475f6f5a6b54bc43)
- chore(package): :wrench: bump version to 6.0.1 [`9b88b46`](https://github.com/thkruz/ootk/commit/9b88b461440f250be487e41d75942a528ececa8b)
- chore(gitignore): :wastebasket: fix path format for propagator accuracy summary file [`b8ff3b3`](https://github.com/thkruz/ootk/commit/b8ff3b364329cbcf72f96f1d9560952989151776)
- chore: :wrench: update repository URL format in package.json [`d38f1c5`](https://github.com/thkruz/ootk/commit/d38f1c5328d75f6b7044adf301ea42bb9d5d15d6)
- chore: :wrench: update version to 6.0.0-rc.5 in package.json [`52c65a2`](https://github.com/thkruz/ootk/commit/52c65a2b0ec901f915fc91ea104ac4b92e73426b)
- fix: :bug: resolve circular dependency in Earth class [`be38190`](https://github.com/thkruz/ootk/commit/be38190bf6b1cd58953b725760d6d3dbeebe891a)
- chore: :wrench: update coveragePathIgnorePatterns in jest config [`c275e6b`](https://github.com/thkruz/ootk/commit/c275e6b74b8aee1d18e1f44097051180e1a59299)
- chore: :truck: update import path for transformsData [`b022166`](https://github.com/thkruz/ootk/commit/b0221668108cac5cf0372687d7044a91a21bbcda)
- refactor(orbit-determination): :recycle: move CostFunction import to internal directory [`a3e00b1`](https://github.com/thkruz/ootk/commit/a3e00b11ae2d301b9ef8e89a832661ca432821be)
- refactor(conjunction): :sparkles: rename parameter for clarity in initializeCovarianceSamples [`50e2da8`](https://github.com/thkruz/ootk/commit/50e2da8fd1f7996c7fffb9d28beff33da2fb0a0a)
- chore(package): update version to 6.0.0-rc.3 [`02aa5b3`](https://github.com/thkruz/ootk/commit/02aa5b39cbd7570f9c494ab0d4b85b1312c7818f)
- test(integration): :white_check_mark: update export snapshot for new OMM exports [`63e06e4`](https://github.com/thkruz/ootk/commit/63e06e42b762aa154a7d37fe31d476484c093db3)
- fix: :bug: export PayloadStatus from types module [`247323a`](https://github.com/thkruz/ootk/commit/247323aefb79bbf613993502275c3130ad54d049)
- chore: :wrench: add .npmrc to .gitignore [`6b4dfe7`](https://github.com/thkruz/ootk/commit/6b4dfe7f40d5c07d1cbcc9f848dd4255f2fa2fbf)
- test: :wrench: exclude integration tests from Jest [`08fc0ed`](https://github.com/thkruz/ootk/commit/08fc0edd53494a6a176d810dac62fe73c781fd19)
- refactor: :truck: rename all iod tests to match main files [`9272b24`](https://github.com/thkruz/ootk/commit/9272b24fc983c132b850607880aa770789091f19)
- docs: update CHANGELOG (add v5.1.1 entries and reorder v4/v5 sections) [`e4a0574`](https://github.com/thkruz/ootk/commit/e4a057462d523a7eb40fff5fc6eaecb231ec15bf)

#### [v6.0.5](https://github.com/thkruz/ootk/compare/v6.0.4...v6.0.5)

> 29 November 2025 

- docs: add comprehensive advanced features guide [`#41`](https://github.com/thkruz/ootk/pull/41)
- docs: add comprehensive user guide and getting started documentation [`#39`](https://github.com/thkruz/ootk/pull/39)
- feat: add high accuracy conjunction assessment workflow [`#37`](https://github.com/thkruz/ootk/pull/37)
- feat: add comprehensive examples for library features [`#38`](https://github.com/thkruz/ootk/pull/38)
- Lambert Satellite Integration [`#36`](https://github.com/thkruz/ootk/pull/36)
- test: :camera_flash: update snapshots to deal with floating point errors [`8aaa72b`](https://github.com/thkruz/ootk/commit/8aaa72bd12414260661578bdbebdc2880a7cfd2a)
- feat(ootk): :sparkles: add interpolator, maneuver and orbit-design modules [`c9163d7`](https://github.com/thkruz/ootk/commit/c9163d70ec025d2c1042c5079485a425105df750)
- test(satellite): :white_check_mark: add unit tests for propagators [`2c262bd`](https://github.com/thkruz/ootk/commit/2c262bd982cf7397920f61be68099e7e3ba03ba1)
- feat(parsers): :sparkles: add OMM parser and types [`645b3e4`](https://github.com/thkruz/ootk/commit/645b3e4f955382e6861fc4eb3556f5c98fb7da8b)
- test(integration): :white_check_mark: add pre-publish integration tests [`bc9add5`](https://github.com/thkruz/ootk/commit/bc9add5692316841b0b65b4716648c3055af4b4c)
- feat(parsers): :sparkles: add OdmExporter and export options [`4188e41`](https://github.com/thkruz/ootk/commit/4188e41e9fd4e1b1e42808d0de4a14daa0d4f712)
- docs: :memo: update copyright year to 2025-2026 [`83cccfb`](https://github.com/thkruz/ootk/commit/83cccfb1503c49291d9adcf71f70bf1a8226f0b2)
- test(OmmParser): :white_check_mark: add unit tests for OMM parsing [`e238a56`](https://github.com/thkruz/ootk/commit/e238a56c0c50d7a43552bda501b76ae4689b160b)
- test(FormatTle): :white_check_mark: add CelesTrak stations validation tests [`bb4230c`](https://github.com/thkruz/ootk/commit/bb4230c659cd2c8473a71acecec85ac498515d37)
- refactor(objects): :recycle: remove PropagatorType from ObjectTypes [`74f3f8b`](https://github.com/thkruz/ootk/commit/74f3f8b3a16e4c4f8e02737f4dd6e15bca4fad98)
- test(Tle): :white_check_mark: add tests for meanMoDev1 and bstar parsing [`506a2d8`](https://github.com/thkruz/ootk/commit/506a2d81b5e95c0e5065d0fcbf7ee5056ec91345)
- fix(HorizonsParser): :bug: improve target name extraction logic [`7ac2bbf`](https://github.com/thkruz/ootk/commit/7ac2bbf28659ef0db298863acdebe045861f29a7)
- feat(OdmExporter): :sparkles: add OEM export from state vectors [`eeb9ff0`](https://github.com/thkruz/ootk/commit/eeb9ff0e5a50974b74279c7d27098c5e81c645a8)
- feat(FormatTle): :sparkles: enhance TLE generation with new formatting [`ba10fd0`](https://github.com/thkruz/ootk/commit/ba10fd0792ff4d5ce762508f7849b16ea9707265)
- style: :art: fix indentation and license header in source files [`ba6a437`](https://github.com/thkruz/ootk/commit/ba6a437eddda7f6ff543c053ce9b939cc37e2593)
- chore(gitignore): :wastebasket: update .gitignore to include propagator accuracy summary file [`1673dc2`](https://github.com/thkruz/ootk/commit/1673dc29f55ecccf92b8cbccdd7cb44100f89644)
- test(propagator): :white_check_mark: add SP3 accuracy comparison results [`5bcc040`](https://github.com/thkruz/ootk/commit/5bcc04091c9b6bc65f40ef69d780106abecfef26)
- docs: :memo: update documentation [`208253c`](https://github.com/thkruz/ootk/commit/208253cf99ddecd2cf81449b253d1c67927af160)
- feat(Satellite): :sparkles: update OMM parsing to use Number [`0d37c26`](https://github.com/thkruz/ootk/commit/0d37c2652a83118605628ef4b667986cf324d5e8)
- feat(OmmParser): :sparkles: add JSON parsing for CelesTrak OMM [`9da31e3`](https://github.com/thkruz/ootk/commit/9da31e3a291ea744b16a3ea641869ff7d6ef08be)
- feat(numerical-propagator): :sparkles: add NumericalPropagatorOptions interface [`c23666f`](https://github.com/thkruz/ootk/commit/c23666fcf05fa033e47a0d8b2ec9ba9b0d806e69)
- feat(OmmFormat): :sparkles: update data format to support numeric types [`afecc3f`](https://github.com/thkruz/ootk/commit/afecc3f97e3c8e4774063c0460b7bd3ae7eb0901)
- feat(enums): :sparkles: add PropagatorType enum with implementations [`54b7b46`](https://github.com/thkruz/ootk/commit/54b7b46662e85befb7c1b108486f057c921e2e81)
- fix(ClassicalElements): :bug: handle equatorial orbits in fromStateVector [`a2b210e`](https://github.com/thkruz/ootk/commit/a2b210e655daad44e61cbfe5ae8ebae367d53b38)
- fix(FormatTle): :bug: fix TLE formatting to match NORAD/CelesTrak conventions [`d34218d`](https://github.com/thkruz/ootk/commit/d34218d7f1251f7436e3ed7560587c4e3b26d1c0)
- fix(package): :bug: fix license typo and configure dual ESM/CJS exports [`57de37b`](https://github.com/thkruz/ootk/commit/57de37ba1bfec6e138c897cd9b799ecd3e6a7e19)
- fix(Epoch): :bug: allow pre-1970 POSIX timestamps for historic TLEs [`15c1841`](https://github.com/thkruz/ootk/commit/15c1841d6d8a20a0e82117b973740e3ad82ec1ba)
- fix(CatalogSource): :bug: update catalog source names to match standards [`3951df7`](https://github.com/thkruz/ootk/commit/3951df79f469c18160804e4c91a4527da1e7828c)
- feat(TleParams): :sparkles: add additional satellite parameters [`2734276`](https://github.com/thkruz/ootk/commit/27342760b13e97382ae090d8450733c539df09b4)
- chore(ci): :wrench: add Node 18 to test matrix [`5ad6593`](https://github.com/thkruz/ootk/commit/5ad65937b4f929233ca1b52dd427f0b9c1a611a0)
- fix: :bug: initialize Float64Arrays with coeffs length [`03458d4`](https://github.com/thkruz/ootk/commit/03458d49a847659957fe43e1b1be46737ae5510c)
- feat(Satellite): :sparkles: add fromOmm method for satellite creation [`a8f46fe`](https://github.com/thkruz/ootk/commit/a8f46fe7864bfc9a97e0a00656eb3f2534920ea2)
- chore(build): :wrench: bundle astronomy-engine and add CJS output [`f853673`](https://github.com/thkruz/ootk/commit/f8536730f6987faf8af1d79470b3a8bd0d267de6)
- fix(Tle): :bug: add debug info for TLE line validation [`24558e1`](https://github.com/thkruz/ootk/commit/24558e1172bde3aa6d00e0b13308bb0886e33acb)
- fix(sgp4): :bug: handle decayed satellites in Sgp4 class [`ad58b63`](https://github.com/thkruz/ootk/commit/ad58b6322dcfe9567ce17440f71669b87ef36904)
- test(FormatTle): :white_check_mark: update test expectations for new TLE formatting [`bcb907b`](https://github.com/thkruz/ootk/commit/bcb907b64ad11c8c81d0cc26d1219ceac022c4bb)
- fix(Tle): :bug: handle '0' as valid BSTAR symbol [`6cda026`](https://github.com/thkruz/ootk/commit/6cda026fd74c99d6b2d2f4538b2037e0e8bf2667)
- chore(package): :wrench: bump version to 6.0.5 [`db25f3b`](https://github.com/thkruz/ootk/commit/db25f3bc4616b09adb518672c6939c9673828bf5)
- chore(.gitignore): :wrench: add .dev.vars to ignore list [`87f7bdf`](https://github.com/thkruz/ootk/commit/87f7bdfa3a43bc54c7f0a6ed6a7e8caabeef13f6)
- fix(Tle): :bug: handle additional BSTAR exponent symbols [`e5f96b4`](https://github.com/thkruz/ootk/commit/e5f96b461ea7ca91083c8d7e59acc794524084be)
- chore(package): :wrench: bump version to 6.0.3 [`be31bfa`](https://github.com/thkruz/ootk/commit/be31bfa79a7a431bb53e65400de3cc479f82ff92)
- chore(package): :wrench: bump version to 6.0.1 [`e116431`](https://github.com/thkruz/ootk/commit/e1164313e86d5a22bd2d55a9fbd21bbd405837e6)
- fix(CatalogSource): :bug: add UNKNOWN source to enum [`5d0f8ed`](https://github.com/thkruz/ootk/commit/5d0f8edbf83e3bab96642e841e05a455e765731c)
- chore(package): :wrench: bump version to 6.0.4 [`e36a2fa`](https://github.com/thkruz/ootk/commit/e36a2faa1e037362f02c851cb39d469c736f03a4)
- refactor: :recycle: update and modernize body module to use astronomy-engine [`f667a99`](https://github.com/thkruz/ootk/commit/f667a9936bde0d91f7375626eb099def3ab6675a)
- feat: :sparkles: Add CDM types and parsing/exporting logic [`b62ace8`](https://github.com/thkruz/ootk/commit/b62ace8382887f246f0ae8d8d32b9832305d52bd)
- test: :sparkles: add integration tests for core functionality [`c5f2baa`](https://github.com/thkruz/ootk/commit/c5f2baa6edfd93c83698750c9870d68a86c53fd7)
- refactor: :recycle: complete phase 1A of objects module refactor [`ab64d69`](https://github.com/thkruz/ootk/commit/ab64d69ed200cb8c04ba944ec507c57ac07437aa)
- feat: :sparkles: Add communication devices and tests [`4ddfd84`](https://github.com/thkruz/ootk/commit/4ddfd842e7b53552c803d69bb9a6dc43d8a7395b)
- feat: :sparkles: Add OEM parsing and data structures [`6420500`](https://github.com/thkruz/ootk/commit/64205004006524f4fa8cbc40f721630247de518d)
- feat: :sparkles: add PassiveRFSensor and PhasedArrayRadar classes [`3aa9e1f`](https://github.com/thkruz/ootk/commit/3aa9e1f109041c9fde64408e4f14deaaf855d6ce)
- test: :rocket: add LambertIOD test suite for orbit determination [`9d1d061`](https://github.com/thkruz/ootk/commit/9d1d0615c9f9366679078866c9878ed36296e648)
- refactor: :recycle: Rename ECF to ECEF in codebase [`b033a34`](https://github.com/thkruz/ootk/commit/b033a347f45c1f547b9e910f2f60f748e402cb92)
- Implement tests for GaussIOD and GoodingIOD; refactor ModifiedGoodingIOD and RungeKuttaAdaptive for improved error handling and integration logic [`4099fe2`](https://github.com/thkruz/ootk/commit/4099fe2966d0f71530c7e3c1b1f671e56415dd6e)
- test: :zap: improve test performance [`4cabf8e`](https://github.com/thkruz/ootk/commit/4cabf8e9cddedd3181b4b8638e5ad1d10c06e52d)
- feat: :sparkles: Add ScheduledContact and tests [`ecfdc4a`](https://github.com/thkruz/ootk/commit/ecfdc4a8247393a619ade0fa5851649cae234e12)
- test: :white_check_mark: Add tests for DynamicGroundObject [`0b80eae`](https://github.com/thkruz/ootk/commit/0b80eaeab2599a92d7310c2ae352601d65115d6c)
- test: :sparkles: add comprehensive tests for Levenberg-MarquardtOD [`4366868`](https://github.com/thkruz/ootk/commit/436686862173313f97a10e7d3da8903322e45bf0)
- docs: add Lambert integration guide and examples [`8149d08`](https://github.com/thkruz/ootk/commit/8149d0842281ca281172a059861c011c418df165)
- docs(time): enhance documentation for time classes and conversions [`a0ba7f7`](https://github.com/thkruz/ootk/commit/a0ba7f7b9fe38919ce7a570b3c2ef63969eb554f)
- feat: :sparkles: Add RepeatGroundTrack and tests [`ea8a151`](https://github.com/thkruz/ootk/commit/ea8a1511edf43ac83d7509f5ef059237a3f93cb5)
- chore(ootk): standardize imports/exports, refine base APIs, bump version [`5bd33d9`](https://github.com/thkruz/ootk/commit/5bd33d9692d0d4e55a43a3b6c887a871517b734b)
- test: :white_check_mark: add integration tests for built package [`c2935fe`](https://github.com/thkruz/ootk/commit/c2935fe96e98ada46624d1577b694adb503d8b69)
- refactor: 🔧 rename private methods for consistency and clarity [`d4bc5dd`](https://github.com/thkruz/ootk/commit/d4bc5dd0d171cf6e5444e4bb005432943d184bf7)
- feat: :sparkles: add AccessCalculator and AccessWindow types [`7279bed`](https://github.com/thkruz/ootk/commit/7279bed55e0d92cb61b38800ffefb41f46327c31)
- test: :camera_flash: update coordinate module snapshots for Vitest [`7f53cbb`](https://github.com/thkruz/ootk/commit/7f53cbbb5e924e3ba1ce51b131efc93834d6f7d2)
- test: :camera_flash: update coordinate module snapshots for Vitest [`10f7564`](https://github.com/thkruz/ootk/commit/10f756430006a7fdff55b587951e7174898f3868)
- test: :white_check_mark: add tests for interpolators [`b34915c`](https://github.com/thkruz/ootk/commit/b34915c02b6d94bcc595114c210e6df5dce3bb3f)
- feat: :sparkles: Add ConstellationGenerator and tests [`6bac6f1`](https://github.com/thkruz/ootk/commit/6bac6f1df04dc2e3c78b34729f6ae61ef6128acb)
- feat: :sparkles: Add custom error classes for ootk [`c828297`](https://github.com/thkruz/ootk/commit/c828297e26161ba3ce1ffbf7df8bdbc37a06d5cc)
- feat: :sparkles: add VisualizationHelpers and related types [`855fa59`](https://github.com/thkruz/ootk/commit/855fa599205b62bf6fa42a80af9ca046475914b9)
- docs: :memo: add comprehensive coordinate systems guide [`a815ed1`](https://github.com/thkruz/ootk/commit/a815ed143d2dbad9048366595025d68502a5bdd6)
- test: :truck: move tests into __tests__ folders for easier management [`1a00952`](https://github.com/thkruz/ootk/commit/1a0095233c05f67100281bead7bfc06ef9281d52)
- feat: :sparkles: add clone methods for sensor and device classes [`2278f34`](https://github.com/thkruz/ootk/commit/2278f349f8b42b40a013dd49e4f329d36b53ead7)
- feat: :sparkles: add OrbitFinder class for satellite orbits [`45332cc`](https://github.com/thkruz/ootk/commit/45332cc7df8c49ba795bf18860a04b2edf0702ff)
- feat: :sparkles: add SunStatus enum for illumination states [`164227c`](https://github.com/thkruz/ootk/commit/164227c69981f1c2d09e38660f07525cc3a2df76)
- feat: :sparkles: Add HorizonsParser and tests [`f85a890`](https://github.com/thkruz/ootk/commit/f85a890266945a8e79855db73554aa5cd4328885)
- test: :camera_flash: update operations module snapshots for Vitest [`7718864`](https://github.com/thkruz/ootk/commit/77188645038d0e2f6a7201ae3d51b551ceed9282)
- test: :camera_flash: update operations module snapshots for Vitest [`2df04b5`](https://github.com/thkruz/ootk/commit/2df04b5dcd4809d21ad0efbac39c6a75188fb7f5)
- refactor: :recycle: change sensor and object IDs to numbers [`21ef8e3`](https://github.com/thkruz/ootk/commit/21ef8e3925728f3801c4be03c91a2aff082969a6)
- build: :arrow_up: upgrade all dependencies to most current [`19fb70c`](https://github.com/thkruz/ootk/commit/19fb70c9927226f47f709d0877bfbd5cdca019b6)
- test(create-covariance-from-tle): :sparkles: add tests for covariance creation from TLE [`a2f0e8d`](https://github.com/thkruz/ootk/commit/a2f0e8dd6a17f475e96fe87b5618623afeadfe29)
- feat(ootk): :satellite: add NASA JPL Horizons client + constants/interfaces; extend SpaceObjectType with planetary/moon types and update tsconfig lib [`b0cf306`](https://github.com/thkruz/ootk/commit/b0cf30698808a9d96f5c05e06d8f28320057d15e)
- remove: :fire: delete Horizons API client and constants [`c1bdf42`](https://github.com/thkruz/ootk/commit/c1bdf423f4ffc0e4c2ecdec1032242aa8d738990)
- test(sgp4): :white_check_mark: add unit tests for Sgp4Propagator functionality [`9e76fa6`](https://github.com/thkruz/ootk/commit/9e76fa6c8b428550d88f4f541e4293430401b53a)
- test(propagator): :white_check_mark: add unit tests for MockPropagator and RungeKutta4Propagator [`24e6c04`](https://github.com/thkruz/ootk/commit/24e6c048ddd37e5a4ba033af46c390fa26cfb191)
- docs(readme): :sparkles: add comprehensive documentation for orbit determination algorithms [`006de56`](https://github.com/thkruz/ootk/commit/006de568a0e05c1617c1e1585cd605410c55a5e9)
- docs(readme): :sparkles: add README for optimize module with examples [`97e4360`](https://github.com/thkruz/ootk/commit/97e4360fec0f61467b0412719fc8a174d5f84674)
- docs: :memo: update documentation for coordinate transformations [`eb7dd1d`](https://github.com/thkruz/ootk/commit/eb7dd1db676ae299fc5fe6ec918e4586cd677d73)
- test: :white_check_mark: add tests for optimization algorithms [`3892df5`](https://github.com/thkruz/ootk/commit/3892df59f66828d48e0ea15f1d374cbdd5abcc06)
- feat: :sparkles: add history tracking to Satellite class [`6aef063`](https://github.com/thkruz/ootk/commit/6aef063c610974810f3ff8568ef71a633b8fc643)
- test(kepler): :white_check_mark: add comprehensive tests for KeplerPropagator [`5d493ee`](https://github.com/thkruz/ootk/commit/5d493ee4c1b2b75756cecb5589d4fcc7d531ba99)
- feat: :sparkles: make lat, lon, alt properties readonly [`f1f2057`](https://github.com/thkruz/ootk/commit/f1f2057655ac8c475ab3bd47f0695594d865fa61)
- docs(readme): :memo: add detailed documentation for orbital propagators [`d9ff134`](https://github.com/thkruz/ootk/commit/d9ff1349623be2170cde04f812d232e7371a80b4)
- test: :camera_flash: update observation module snapshots for Vitest [`eb4f13a`](https://github.com/thkruz/ootk/commit/eb4f13a074c16d0b78358c8bca0a63b28eb3229a)
- test: :camera_flash: update observation module snapshots for Vitest [`6d99dde`](https://github.com/thkruz/ootk/commit/6d99dde7cbe118ac2ee39f9322e4565045934001)
- feat: :sparkles: implement RAE methods in SpaceObject class [`daebe13`](https://github.com/thkruz/ootk/commit/daebe138ac5137d352bcac61c2944d49c79df101)
- refactor(simplex): :recycle: move SimplexEntry to internal directory [`a8945de`](https://github.com/thkruz/ootk/commit/a8945de074527ceaaa1bd3e37b424ad007cffe0b)
- refactor(smoothing): :recycle: convert ExponentialSmoothing class to functions [`6386c64`](https://github.com/thkruz/ootk/commit/6386c647bf1bc28bfb9a6000005171ff840d345a)
- test: :white_check_mark: add tests for Hill class methods [`aeca4c5`](https://github.com/thkruz/ootk/commit/aeca4c5c6a5c083568aec7503af681d97ef7153d)
- docs(golden-section): :memo: enhance documentation and examples for optimizer [`5fe3a53`](https://github.com/thkruz/ootk/commit/5fe3a53671f774d7765b53327f6e954c389eea1e)
- test: :camera_flash: update time module snapshots for Vitest [`2e0d369`](https://github.com/thkruz/ootk/commit/2e0d369f0945453d92825ba7e7f4eb152780bdd3)
- feat: :sparkles: add validation errors for sensor parent checks [`9dc1673`](https://github.com/thkruz/ootk/commit/9dc1673a9600a64242a6b04c66e6f8cbf29f35f0)
- test: :camera_flash: update time module snapshots for Vitest [`72e33f2`](https://github.com/thkruz/ootk/commit/72e33f24f939434c9940886dc2ae5529aa120317)
- feat: :sparkles: enhance visibility checks for Transmitter [`f1eb38c`](https://github.com/thkruz/ootk/commit/f1eb38c0e7f9b646720760dc0e60abefe4dfc714)
- feat: :sparkles: add history tracking and cloning options [`2cdb3c5`](https://github.com/thkruz/ootk/commit/2cdb3c5877af6208c277733f18a9562518d6b1f8)
- refactor: :recycle: replace EciVec3 with TemeVec3 types [`69e4d53`](https://github.com/thkruz/ootk/commit/69e4d53611df9a99986c589ec2505c7c30cb2bc4)
- refactor: :recycle: streamline imports and enhance AccessWindow [`a0fa846`](https://github.com/thkruz/ootk/commit/a0fa8464004b1e330d624b20b7218c1609346f47)
- refactor(polynomial-regression): :recycle: move PolynomicalRegressionResult to internal directory [`87f200b`](https://github.com/thkruz/ootk/commit/87f200b2554b7cc6724eea49f47f6755b8626a8a)
- docs: :memo: add examples for SunBody, Satellite, and Sensor [`6be84fe`](https://github.com/thkruz/ootk/commit/6be84fec69bc99ab77234928882a002787b00564)
- docs(simple-linear-regression): :memo: enhance class documentation and examples [`68e1cab`](https://github.com/thkruz/ootk/commit/68e1cabd83297f188f92743e4483edda06d98c71)
- docs(polynomial-regression): :memo: enhance documentation and examples for optimizer [`9a0b207`](https://github.com/thkruz/ootk/commit/9a0b20765b6202724fa11c7c0f011ab86ec30aa5)
- build: :building_construction: migrate to tsup for ESM builds [`1cf04cb`](https://github.com/thkruz/ootk/commit/1cf04cb38d38671b35dbff7a80042de5b42cbdd8)
- test: :white_check_mark: migrate test files from Jest to Vitest [`a1f10c7`](https://github.com/thkruz/ootk/commit/a1f10c7f828d4581eecf67aff0f6eaeda5c63003)
- test: :truck: move tests into __tests__ folders for easier management [`38e834a`](https://github.com/thkruz/ootk/commit/38e834a25e1533f06408b4e080930cf5f94fdd23)
- refactor: :recycle: update SpaceObject to use TEME frame [`e15fc3b`](https://github.com/thkruz/ootk/commit/e15fc3b3baa58bcd4e7d901e22f48b8593c81a59)
- refactor(orbit_determination): improve GoodingIOD and ModifiedGoodingIOD structure [`c8a4587`](https://github.com/thkruz/ootk/commit/c8a45877fc063099fac74b997277ca7a2a0f49b3)
- build: :wrench: migrate from Jest to Vitest [`420630a`](https://github.com/thkruz/ootk/commit/420630a3663e1e7ad70c8943df302903dc3f2f31)
- test: :white_check_mark: add tests for ephemerisManeuver [`3c9b1d4`](https://github.com/thkruz/ootk/commit/3c9b1d439dcab82ce516cec6194f56e5e7e9616b)
- feat: :sparkles: add angle calculations for satellites and Sun [`3c1cb5a`](https://github.com/thkruz/ootk/commit/3c1cb5a354d1af97283789ce57897b1e1090eaed)
- chore(gitignore): :sparkles: add CLAUDE.md to .gitignore [`6a8a3e7`](https://github.com/thkruz/ootk/commit/6a8a3e7c56e1746f3e23516d6ef35158afcc4e30)
- build: :wrench: add ESM import path fixer for dist output [`dd28aa5`](https://github.com/thkruz/ootk/commit/dd28aa500c73c733168f99ba15ab2d91aa6cc50a)
- test: :white_check_mark: add tests for ModifiedGoodingIOD [`fbcf52d`](https://github.com/thkruz/ootk/commit/fbcf52d106b332a1eecd81b1b10949acd2a3d10d)
- refactor(conjunction): :recylce: update ConjunctionEvent constructor to use params object [`426f02f`](https://github.com/thkruz/ootk/commit/426f02fa8e3de0a6a3cf5c5ab045998888d904a6)
- test: :white_check_mark: add integration test infrastructure with Vitest [`2ebf579`](https://github.com/thkruz/ootk/commit/2ebf5797984b2bb1ee159258e34550b05b0c1fda)
- test: :camera_flash: update utils module snapshots for Vitest [`3034ddf`](https://github.com/thkruz/ootk/commit/3034ddf368c00b273fcba2332f8ff07b7e85699b)
- test: :white_check_mark: add unit tests for conversions [`ebcec5b`](https://github.com/thkruz/ootk/commit/ebcec5bf4ecef6b4fd1a739b9065c8efe24f6d7e)
- feat: :sparkles: add interpolator and maneuver modules [`17c1af6`](https://github.com/thkruz/ootk/commit/17c1af68583648f45e815ebab261d44361d76b8d)
- test: :camera_flash: update utils module snapshots for Vitest [`94fd1fe`](https://github.com/thkruz/ootk/commit/94fd1fec908ca4dfbc812ba9c60b4b0502dbb293)
- refactor(chebyshev): :recycle: improve documentation and method naming [`d40d8e0`](https://github.com/thkruz/ootk/commit/d40d8e0318e6134cd78c717c17e7a8348cec948a)
- refactor(conjunction): :sparkles: reorganize imports and improve covariance handling [`d3c0743`](https://github.com/thkruz/ootk/commit/d3c07435db0888216cbfb6d2dc660c11b0d9982a)
- test: :camera_flash: update transforms module snapshots for Vitest [`0d086dc`](https://github.com/thkruz/ootk/commit/0d086dcf25d4fd96c1a6e45916cbcd8b22d6c0c2)
- test: :camera_flash: update transforms module snapshots for Vitest [`5e28592`](https://github.com/thkruz/ootk/commit/5e28592f637ea52a3e7f45bdfda12443f5b6164f)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from imports [`5457a4c`](https://github.com/thkruz/ootk/commit/5457a4c4e9580b86d34d3d471a9774f99fbbfe37)
- refactor(downhill-simplex): :recycle: improve method naming and documentation [`5f54b43`](https://github.com/thkruz/ootk/commit/5f54b432b0bd926d7036b6fbd284fcca3ca1538d)
- refactor: :recycle: update sensor imports and exports [`97fea98`](https://github.com/thkruz/ootk/commit/97fea984e2f76de67a5d7b8a8b5e592c9c0b7a07)
- ci: :construction_worker: add circular-check and integration test jobs [`a5def79`](https://github.com/thkruz/ootk/commit/a5def79cc7f4b2ccfb9f35a0326af6e12396b0d7)
- test: :camera_flash: update body module snapshots for Vitest [`acf4527`](https://github.com/thkruz/ootk/commit/acf45273b8fb08374dda2156db9eab70eff10878)
- test: :camera_flash: update body module snapshots for Vitest [`a519e63`](https://github.com/thkruz/ootk/commit/a519e63c3121ceb8db5c87b666c6822fa8062760)
- feat: :sparkles: add fromPosVel method for RIC coordinates [`e6aeb91`](https://github.com/thkruz/ootk/commit/e6aeb91d7d67b8f1e6b15a251597325e25cc0292)
- refactor: :recycle: simplify imports in multiple files [`227b241`](https://github.com/thkruz/ootk/commit/227b2418e625e95ad1ffdc7c833a9043101e5815)
- test(body): update Moon snapshots for getMoonTimes (including timezone adjustment) and rae [`2538834`](https://github.com/thkruz/ootk/commit/25388341ff11cfe825d2993f6359972b1ca43ef4)
- fix: :bug: resolve circular dependency in types.ts [`29d3f5d`](https://github.com/thkruz/ootk/commit/29d3f5d2be17206c7297770e2f5fdc51d49192b4)
- feat: :sparkles: add additional star parameters to interface [`270f08d`](https://github.com/thkruz/ootk/commit/270f08d2a16ef94ce040cbecf1aca4582475908c)
- feat: :sparkles: add PayloadStatus type [`c4b4d46`](https://github.com/thkruz/ootk/commit/c4b4d461b6b9a17b00363a54125994b8ea488fde)
- fix: :bug: replace @src/ path alias with relative imports [`e59187d`](https://github.com/thkruz/ootk/commit/e59187d2f67f92975358779744903d161685ddbf)
- refactor: :recycle: Update sun position methods in force classes [`cc75b73`](https://github.com/thkruz/ootk/commit/cc75b7349c05734388c8601e482b071c7bba003e)
- test: :sparkles: add tests for factorial function with edge cases [`1f7e2f2`](https://github.com/thkruz/ootk/commit/1f7e2f21d6b47f82601565096c13583aa05b3eac)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`8c40159`](https://github.com/thkruz/ootk/commit/8c40159c002de5aa3fcd387d24626a7a9ec8b67c)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`b8addb6`](https://github.com/thkruz/ootk/commit/b8addb66ab3be630ea774def85a8d6dccdbdb085)
- refactor: :recycle: clean up exports in index.ts [`b1cae93`](https://github.com/thkruz/ootk/commit/b1cae93f0617e9db4af2dada989629de52aeb8a1)
- fix: :bug: correct maneuver filtering logic in propagator [`269afd8`](https://github.com/thkruz/ootk/commit/269afd80cc92cfa8b5639d13cd126cd2a9ebf367)
- build: :wrench: add madge configuration for circular dependency detection [`4432c75`](https://github.com/thkruz/ootk/commit/4432c75a4caa1d5afee3d458a144963e0314db38)
- build: :package: add madge, vitest and integration test scripts [`7f9fafa`](https://github.com/thkruz/ootk/commit/7f9fafac8b9fc629c1103366228ebb3c57997800)
- feat: :sparkles: Integrate astronomy-engine for star position [`51656b8`](https://github.com/thkruz/ootk/commit/51656b8ab91cef6fc65b9e3009c861d7e8779e54)
- refactor(conjunction): :sparkles: remove file extensions from imports [`b056e72`](https://github.com/thkruz/ootk/commit/b056e7213adeffe53d33618545d48aaf09701b07)
- fix: :bug: resolve circular dependencies in operations module [`68d23ad`](https://github.com/thkruz/ootk/commit/68d23ad94f4f3f9036df321d6306a847b7d58b24)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from exports [`aa83689`](https://github.com/thkruz/ootk/commit/aa836891c3a669850848b2136ddd9fd390b34308)
- refactor: :recycle: rename astronomicalUnit to KM_PER_AU and update usages in Sun & SolarRadiationPressure [`b03abb4`](https://github.com/thkruz/ootk/commit/b03abb49b0db885cba0b1e7859172090d0e50cf6)
- test(create-sample-covariance-from-tle): :white_check_mark: add test for realistic covariance creation [`f8461b9`](https://github.com/thkruz/ootk/commit/f8461b9a4417c1741d116eca0a76f45d12677486)
- test(probability): :white_check_mark: adjust relative velocity and position for encounter plane [`8c27236`](https://github.com/thkruz/ootk/commit/8c2723666e0f1c69ca5fa6d3d3affe48da18cc0f)
- refactor: :recycle: Correct export test for CelestialBody [`dcd353f`](https://github.com/thkruz/ootk/commit/dcd353f1fa2122c1e8efa6381d2df4ad22fc7827)
- refactor(GaussIOD): reorganize import statements for better clarity [`e280ebf`](https://github.com/thkruz/ootk/commit/e280ebf2de38ad967997a55153c9568c6ed3fc89)
- feat(optimize): :sparkles: add index file to export optimization modules [`bd14b0b`](https://github.com/thkruz/ootk/commit/bd14b0bf58e965767d0563e07c29df9897513a3a)
- refactor(functions): :sparkles: optimize log10, array2d, and distance calculations [`0416ea7`](https://github.com/thkruz/ootk/commit/0416ea7a18dc36faed17fc59cb4ae9d67100ee99)
- chore(ootk): bump @typescript-eslint/eslint-plugin & parser to ^8.46.2 and refresh package-lock.json [`a06b0e1`](https://github.com/thkruz/ootk/commit/a06b0e1a29b7aa5394e9be108eb85eccf98629f4)
- refactor: :recycle: update tsconfig to exclude test files [`c245aab`](https://github.com/thkruz/ootk/commit/c245aab7776ad1d0141551f96e4b8e3779875c75)
- fix(ootk): add missing SpaceObjectType string mappings for terrestrial/gas/ice/dwarf planets and moon [`803fd3e`](https://github.com/thkruz/ootk/commit/803fd3e6fe68c636072d19a5e2a1e1f2f51e5d18)
- test: :wrench: increase timeout for ConjunctionAssessment high-fidelity tests [`d6a800b`](https://github.com/thkruz/ootk/commit/d6a800b43562e1046b7e3d79f8849d6e4b3759ac)
- chore: :wrench: update .gitignore to include new files [`153db9d`](https://github.com/thkruz/ootk/commit/153db9d6445d2177e3f9b29b41601af4f941f095)
- chore: :wrench: update version to 6.0.0-rc.4 [`67ace98`](https://github.com/thkruz/ootk/commit/67ace987b4501c2f8289b4a89250cd1e288e2c1b)
- refactor(main): :sparkles: remove unnecessary file extensions from exports [`3fb1f57`](https://github.com/thkruz/ootk/commit/3fb1f57cc9d625c4401cea4b95f30c5d90f6e4a5)
- chore(package): update version to 6.0.0-rc.2 [`147846c`](https://github.com/thkruz/ootk/commit/147846c02d322377fb273408a5844426bf0eee82)
- feat(orbit-determination): :sparkles: add maxIter option to SolveOptions [`6c3776d`](https://github.com/thkruz/ootk/commit/6c3776dd110656230e59da8f522f06d0b99b666e)
- test(FormatTle): :white_check_mark: fix line 2 expected value for new formatting [`e607f21`](https://github.com/thkruz/ootk/commit/e607f215e430f5efcc0a7e5de5fbf218cdb5b3b2)
- chore(package): :wrench: bump version to 6.0.2 [`9e109d1`](https://github.com/thkruz/ootk/commit/9e109d1edb40d9147c0253ff86424a3323707e9d)
- chore(gitignore): :wastebasket: fix path format for propagator accuracy summary file [`ad1976c`](https://github.com/thkruz/ootk/commit/ad1976c97ca82327d5391aff5b455c40bb41e22b)
- chore: :wrench: update repository URL format in package.json [`07e3f69`](https://github.com/thkruz/ootk/commit/07e3f694b9c4085a77b26cc3ea170fd9cd94559e)
- chore: :wrench: update version to 6.0.0-rc.5 in package.json [`8b6ee64`](https://github.com/thkruz/ootk/commit/8b6ee64f26bb82f588a0d88a1bd3c3dd66d00c3b)
- fix: :bug: resolve circular dependency in Earth class [`0737a62`](https://github.com/thkruz/ootk/commit/0737a629f9c054822b49bc25a7c4813114f8542a)
- chore: :wrench: update coveragePathIgnorePatterns in jest config [`a4a045a`](https://github.com/thkruz/ootk/commit/a4a045a0e29c23b870564b3610e5dda18191e836)
- chore: :truck: update import path for transformsData [`8b1d1c5`](https://github.com/thkruz/ootk/commit/8b1d1c5358cd06f86d0cfe077546729d8ce8dc15)
- refactor(orbit-determination): :recycle: move CostFunction import to internal directory [`f41be5c`](https://github.com/thkruz/ootk/commit/f41be5c9c3c6b678b36fd6b3cd9057dbcad6f6dd)
- refactor(conjunction): :sparkles: rename parameter for clarity in initializeCovarianceSamples [`4a1a8e5`](https://github.com/thkruz/ootk/commit/4a1a8e52dfc0e675eb19c51e1e71427c72ba4989)
- chore(package): update version to 6.0.0-rc.3 [`af58805`](https://github.com/thkruz/ootk/commit/af58805776560ce516eac33b635cd418ebbf0cfd)
- test(integration): :white_check_mark: update export snapshot for new OMM exports [`e0c91b6`](https://github.com/thkruz/ootk/commit/e0c91b6a17988ea8e3fb36cb24edd2230bf2b846)
- fix: :bug: export PayloadStatus from types module [`b20e034`](https://github.com/thkruz/ootk/commit/b20e034dcde352fdc8b38b26b1dca059a6684952)
- chore: :wrench: add .npmrc to .gitignore [`5150253`](https://github.com/thkruz/ootk/commit/5150253f086824da703a10f10f28f60810b00fb2)
- test: :wrench: exclude integration tests from Jest [`3216d44`](https://github.com/thkruz/ootk/commit/3216d442acdf888de650088b10a825ef219ed8be)
- refactor: :truck: rename all iod tests to match main files [`0cfcc56`](https://github.com/thkruz/ootk/commit/0cfcc567ab92753fe12ac2ebaa0d7897a5595a03)
- docs: update CHANGELOG (add v5.1.1 entries and reorder v4/v5 sections) [`fbace9b`](https://github.com/thkruz/ootk/commit/fbace9bc62194632cdd81086b9c6420727361994)

#### [v6.0.4](https://github.com/thkruz/ootk/compare/v6.0.3...v6.0.4)

> 22 March 2026 

- docs: add comprehensive advanced features guide [`#41`](https://github.com/thkruz/ootk/pull/41)
- docs: add comprehensive user guide and getting started documentation [`#39`](https://github.com/thkruz/ootk/pull/39)
- feat: add high accuracy conjunction assessment workflow [`#37`](https://github.com/thkruz/ootk/pull/37)
- feat: add comprehensive examples for library features [`#38`](https://github.com/thkruz/ootk/pull/38)
- Lambert Satellite Integration [`#36`](https://github.com/thkruz/ootk/pull/36)
- chore(package): :wrench: bump version to 6.0.4 [`4925527`](https://github.com/thkruz/ootk/commit/4925527adfc91e88e5884db1d28cab840ce9981d)
- test: :camera_flash: update snapshots to deal with floating point errors [`9ee23a1`](https://github.com/thkruz/ootk/commit/9ee23a1d10977db13142cea65e4d2405ef3a5573)
- refactor: :recycle: update and modernize body module to use astronomy-engine [`a56c10c`](https://github.com/thkruz/ootk/commit/a56c10cbd7abe03a4c78cad8fc6aa488fef53298)
- feat: :sparkles: Add CDM types and parsing/exporting logic [`85ddedd`](https://github.com/thkruz/ootk/commit/85ddedd2b373b3f27a5657f9e7eee7607e304d41)
- test: :sparkles: add integration tests for core functionality [`f8c380c`](https://github.com/thkruz/ootk/commit/f8c380c36322b4a6bfbe09b36989d2c93bc5b0f5)
- refactor: :recycle: complete phase 1A of objects module refactor [`0f75b33`](https://github.com/thkruz/ootk/commit/0f75b33f603b1e710e63c2084806f415d737c4c1)
- feat: :sparkles: Add communication devices and tests [`e840337`](https://github.com/thkruz/ootk/commit/e840337e90feff225af9243e654802c4981d01e9)
- feat: :sparkles: Add OEM parsing and data structures [`c0967d1`](https://github.com/thkruz/ootk/commit/c0967d1efe1c788dd3628ddf41ad3e3e57a1a8e7)
- feat: :sparkles: add PassiveRFSensor and PhasedArrayRadar classes [`935a778`](https://github.com/thkruz/ootk/commit/935a77826c5bc2033609f2136fd81eaeda84b543)
- test: :rocket: add LambertIOD test suite for orbit determination [`c26343b`](https://github.com/thkruz/ootk/commit/c26343b7cf581568f28ec6d49aefb0e146fd11d7)
- refactor: :recycle: Rename ECF to ECEF in codebase [`0ef09ea`](https://github.com/thkruz/ootk/commit/0ef09ea91930eb5eb235732a3e2069523ed06346)
- Implement tests for GaussIOD and GoodingIOD; refactor ModifiedGoodingIOD and RungeKuttaAdaptive for improved error handling and integration logic [`5da537b`](https://github.com/thkruz/ootk/commit/5da537b9c82cecdfddc4284f805a927ca9cd043b)
- test: :zap: improve test performance [`cd82439`](https://github.com/thkruz/ootk/commit/cd8243917a413aeabe2542657e93b0e595b3c58e)
- feat(ootk): :sparkles: add interpolator, maneuver and orbit-design modules [`dd8e395`](https://github.com/thkruz/ootk/commit/dd8e395a90ce63338b1e97edab863932d998c2dc)
- feat: :sparkles: Add ScheduledContact and tests [`fa11c93`](https://github.com/thkruz/ootk/commit/fa11c93687c2cc0687bd473b21efe699fa9581ec)
- test: :white_check_mark: Add tests for DynamicGroundObject [`e35c4a9`](https://github.com/thkruz/ootk/commit/e35c4a99d997436bf0148999f7cd1e7ab9c357f1)
- test(satellite): :white_check_mark: add unit tests for propagators [`d7ef3b5`](https://github.com/thkruz/ootk/commit/d7ef3b5322e0fe848823fa0b8e0054aac76adcf7)
- test: :sparkles: add comprehensive tests for Levenberg-MarquardtOD [`c9d458a`](https://github.com/thkruz/ootk/commit/c9d458af8f27c587bce68e4108a1f4633e9fa18e)
- docs: add Lambert integration guide and examples [`eb83cf5`](https://github.com/thkruz/ootk/commit/eb83cf50fa19e2115be0577938e4c7594391d10c)
- docs(time): enhance documentation for time classes and conversions [`6dd3c5e`](https://github.com/thkruz/ootk/commit/6dd3c5ead6f431cf6ea1b2c790c2f14fcc012a88)
- feat: :sparkles: Add RepeatGroundTrack and tests [`4541925`](https://github.com/thkruz/ootk/commit/4541925c44d77b0aef1501cba620cfbb759b9cfb)
- chore(ootk): standardize imports/exports, refine base APIs, bump version [`8a6a365`](https://github.com/thkruz/ootk/commit/8a6a3656ce392f3a9663693046097e7b5eacb648)
- test: :white_check_mark: add integration tests for built package [`688f339`](https://github.com/thkruz/ootk/commit/688f339f4881190debee54507edb302ddbce080d)
- refactor: 🔧 rename private methods for consistency and clarity [`34d28e0`](https://github.com/thkruz/ootk/commit/34d28e04a1a8aa54deeeaa2d0cc1e756cc9bd33c)
- feat: :sparkles: add AccessCalculator and AccessWindow types [`32abe79`](https://github.com/thkruz/ootk/commit/32abe795021435356c2a2910e0d7e5894e11ee5d)
- test: :camera_flash: update coordinate module snapshots for Vitest [`5135e7e`](https://github.com/thkruz/ootk/commit/5135e7e36cc0f7c8bd2209e08578b50c9eaaebc3)
- feat(parsers): :sparkles: add OMM parser and types [`253b1c2`](https://github.com/thkruz/ootk/commit/253b1c2208325997b2fa9ef19a79363b36c506fe)
- test: :camera_flash: update coordinate module snapshots for Vitest [`c35f910`](https://github.com/thkruz/ootk/commit/c35f910da78215889c22daced8bb1db8f849e12d)
- test: :white_check_mark: add tests for interpolators [`43e9aad`](https://github.com/thkruz/ootk/commit/43e9aadb3593c811518652b2c9a6503431edfa08)
- feat: :sparkles: Add ConstellationGenerator and tests [`c50d16f`](https://github.com/thkruz/ootk/commit/c50d16f5b6fe1c43364a9561abd43c4551894249)
- feat: :sparkles: Add custom error classes for ootk [`79baa37`](https://github.com/thkruz/ootk/commit/79baa377dd288d175c6eaee3769076ca70ea5099)
- feat: :sparkles: add VisualizationHelpers and related types [`278e8bd`](https://github.com/thkruz/ootk/commit/278e8bd513b0f84d83b535f79adcff929badafff)
- docs: :memo: add comprehensive coordinate systems guide [`24bfedd`](https://github.com/thkruz/ootk/commit/24bfedd71c5517cd99f3cb97c2487379d3308c37)
- test: :truck: move tests into __tests__ folders for easier management [`bd907d8`](https://github.com/thkruz/ootk/commit/bd907d80bcf91842cf673bfe1d6fd59cabecfbdd)
- feat: :sparkles: add clone methods for sensor and device classes [`51cbb97`](https://github.com/thkruz/ootk/commit/51cbb977db928a623f3b7741b399443714a42c28)
- feat: :sparkles: add OrbitFinder class for satellite orbits [`448eef9`](https://github.com/thkruz/ootk/commit/448eef9f5dc16aeca45eca6e7c6cc1e3ffdde2c7)
- test(integration): :white_check_mark: add pre-publish integration tests [`f50e22a`](https://github.com/thkruz/ootk/commit/f50e22a6b33213ba9daba13d1e9f196e2261bebe)
- feat: :sparkles: add SunStatus enum for illumination states [`97c188b`](https://github.com/thkruz/ootk/commit/97c188b31679e9f2b5cb904477f085665337a0fd)
- feat: :sparkles: Add HorizonsParser and tests [`d808d1e`](https://github.com/thkruz/ootk/commit/d808d1eaed2fc03d8db4596686a8d7dfec822d42)
- test: :camera_flash: update operations module snapshots for Vitest [`0547cc3`](https://github.com/thkruz/ootk/commit/0547cc3b92c63d64a3efd28c022df2656a8292ed)
- test: :camera_flash: update operations module snapshots for Vitest [`725d6ea`](https://github.com/thkruz/ootk/commit/725d6ea72e12cd6d0a7e1fea7ab9f3f2a100e61b)
- refactor: :recycle: change sensor and object IDs to numbers [`d69137b`](https://github.com/thkruz/ootk/commit/d69137b2e41f4bd204f1fc8ee0a18533449216ea)
- build: :arrow_up: upgrade all dependencies to most current [`fedc88b`](https://github.com/thkruz/ootk/commit/fedc88bdbbe3acd087509e5e33b4d62bbbaf7e05)
- feat(parsers): :sparkles: add OdmExporter and export options [`dc43ffc`](https://github.com/thkruz/ootk/commit/dc43ffc641aac466a2a3700dbd714988df989209)
- test(create-covariance-from-tle): :sparkles: add tests for covariance creation from TLE [`6ace6b2`](https://github.com/thkruz/ootk/commit/6ace6b21197790ce75e067a2243728dd843231cd)
- docs: :memo: update copyright year to 2025-2026 [`0cceb50`](https://github.com/thkruz/ootk/commit/0cceb50c1878f0e04a148da529ae0b5850fd83ab)
- feat(ootk): :satellite: add NASA JPL Horizons client + constants/interfaces; extend SpaceObjectType with planetary/moon types and update tsconfig lib [`76ed1f7`](https://github.com/thkruz/ootk/commit/76ed1f7e05c37cc1cde69887acea2a6153275c4f)
- remove: :fire: delete Horizons API client and constants [`18aed53`](https://github.com/thkruz/ootk/commit/18aed53fa6b114095d20a9c214a66a9f6afc482e)
- test(sgp4): :white_check_mark: add unit tests for Sgp4Propagator functionality [`038c912`](https://github.com/thkruz/ootk/commit/038c9128d705507acbe7638da00fe03464d92539)
- test(OmmParser): :white_check_mark: add unit tests for OMM parsing [`057a7fd`](https://github.com/thkruz/ootk/commit/057a7fde4925f81dbb1beb2784a83bd8f50eb415)
- test(propagator): :white_check_mark: add unit tests for MockPropagator and RungeKutta4Propagator [`84aef88`](https://github.com/thkruz/ootk/commit/84aef88855c43960549dc51d45bc10056c3b978c)
- docs(readme): :sparkles: add comprehensive documentation for orbit determination algorithms [`8ed7178`](https://github.com/thkruz/ootk/commit/8ed7178536e3894a96e932a6a9d3c783a30f4097)
- docs(readme): :sparkles: add README for optimize module with examples [`491bbed`](https://github.com/thkruz/ootk/commit/491bbedff9a0a6ec257ad3d7c626de99fa584567)
- docs: :memo: update documentation for coordinate transformations [`b37ba1b`](https://github.com/thkruz/ootk/commit/b37ba1b13adf7269fe90ba242f34f2a6a333af58)
- test: :white_check_mark: add tests for optimization algorithms [`78199f4`](https://github.com/thkruz/ootk/commit/78199f46933af9497340c3d29a4723d8a46cf1d2)
- feat: :sparkles: add history tracking to Satellite class [`5ab6b1e`](https://github.com/thkruz/ootk/commit/5ab6b1e2bb0d4133e65d7d27c2ec1ba876c9eccc)
- test(FormatTle): :white_check_mark: add CelesTrak stations validation tests [`773cf97`](https://github.com/thkruz/ootk/commit/773cf97e74a0e628698ef5371e248c5fe5aae3d4)
- test(kepler): :white_check_mark: add comprehensive tests for KeplerPropagator [`cc61975`](https://github.com/thkruz/ootk/commit/cc61975031e58ed91a38fedfc6f61e45d44b200a)
- feat: :sparkles: make lat, lon, alt properties readonly [`f3ad72c`](https://github.com/thkruz/ootk/commit/f3ad72c9e7a2ed0c831e8f491a146bbf63599952)
- docs(readme): :memo: add detailed documentation for orbital propagators [`6f033f2`](https://github.com/thkruz/ootk/commit/6f033f26caa9d46b09e74310ab656ec320b23a44)
- test: :camera_flash: update observation module snapshots for Vitest [`cc1d7d5`](https://github.com/thkruz/ootk/commit/cc1d7d5869654d7576f9e21452f7ec859d9a16ba)
- test: :camera_flash: update observation module snapshots for Vitest [`26e205b`](https://github.com/thkruz/ootk/commit/26e205bac9152eaa0a4fe019bb4ab10ce3166018)
- feat: :sparkles: implement RAE methods in SpaceObject class [`2f00d20`](https://github.com/thkruz/ootk/commit/2f00d20109d3cae549bf1c2d8e12a922da1ebe5d)
- refactor(simplex): :recycle: move SimplexEntry to internal directory [`0680b95`](https://github.com/thkruz/ootk/commit/0680b951724845c032030b26baa0136329f11474)
- refactor(smoothing): :recycle: convert ExponentialSmoothing class to functions [`e0c978b`](https://github.com/thkruz/ootk/commit/e0c978b6c38811a8b8675bafb54c06ef0725b349)
- test: :white_check_mark: add tests for Hill class methods [`475acc3`](https://github.com/thkruz/ootk/commit/475acc3334dbba4717d7f250d4fffff3e3c14a65)
- docs(golden-section): :memo: enhance documentation and examples for optimizer [`b627eaf`](https://github.com/thkruz/ootk/commit/b627eaf6fa6a00ceceb3b28d10756cbf3498a383)
- test: :camera_flash: update time module snapshots for Vitest [`1f427ff`](https://github.com/thkruz/ootk/commit/1f427ff3b6d082bdc9bdf0d9e72e550e02ef804d)
- feat: :sparkles: add validation errors for sensor parent checks [`824c8bf`](https://github.com/thkruz/ootk/commit/824c8bf41348ccdd68928301de0e5bc350721058)
- test: :camera_flash: update time module snapshots for Vitest [`aa0313b`](https://github.com/thkruz/ootk/commit/aa0313ba8264a3864abe439d8df4180841d03e95)
- feat: :sparkles: enhance visibility checks for Transmitter [`1701853`](https://github.com/thkruz/ootk/commit/1701853a8ec4f0cf26ae6432ec7134f6b1b8ec98)
- feat: :sparkles: add history tracking and cloning options [`261dc52`](https://github.com/thkruz/ootk/commit/261dc52c98dd18c9c2a598a327c51e14f5feb84d)
- refactor: :recycle: replace EciVec3 with TemeVec3 types [`00e3af3`](https://github.com/thkruz/ootk/commit/00e3af33ddcbdebf57c3b771c9ae1af649e3b190)
- refactor: :recycle: streamline imports and enhance AccessWindow [`6a71aec`](https://github.com/thkruz/ootk/commit/6a71aec8504b9f797cfe7a1f5c1afc80f00ee6d2)
- refactor(polynomial-regression): :recycle: move PolynomicalRegressionResult to internal directory [`c6a7fd5`](https://github.com/thkruz/ootk/commit/c6a7fd5eb88b4b0b05113ecc33ee017399ddcc3e)
- docs: :memo: add examples for SunBody, Satellite, and Sensor [`f4a1c9e`](https://github.com/thkruz/ootk/commit/f4a1c9e0681b34e8f8d409a15bd2d0bd390ef2e4)
- docs(simple-linear-regression): :memo: enhance class documentation and examples [`23ce52f`](https://github.com/thkruz/ootk/commit/23ce52f1ab650db9654f4faae254fbe6ad9215d6)
- docs(polynomial-regression): :memo: enhance documentation and examples for optimizer [`9f8c019`](https://github.com/thkruz/ootk/commit/9f8c019666aea11e1e2a2f63343142f67ba727ec)
- build: :building_construction: migrate to tsup for ESM builds [`5b505cd`](https://github.com/thkruz/ootk/commit/5b505cd15c1218b45d8072fcae42de2f95732da9)
- refactor(objects): :recycle: remove PropagatorType from ObjectTypes [`98d4d8f`](https://github.com/thkruz/ootk/commit/98d4d8ff5ae42e48be4e369a77ba34e95a0e6dd5)
- test(Tle): :white_check_mark: add tests for meanMoDev1 and bstar parsing [`13ee240`](https://github.com/thkruz/ootk/commit/13ee240644b242123e0780557721d18247ae4ee9)
- test: :white_check_mark: migrate test files from Jest to Vitest [`3bdcf24`](https://github.com/thkruz/ootk/commit/3bdcf24f746833a03aa8acc076e080babe8aaa7c)
- test: :truck: move tests into __tests__ folders for easier management [`507cb3d`](https://github.com/thkruz/ootk/commit/507cb3d2a2081c538506568ede11e98707836de8)
- refactor: :recycle: update SpaceObject to use TEME frame [`1b046f9`](https://github.com/thkruz/ootk/commit/1b046f9b9ddb030f38758f1ca7de1c92fa07365c)
- refactor(orbit_determination): improve GoodingIOD and ModifiedGoodingIOD structure [`993a790`](https://github.com/thkruz/ootk/commit/993a79065cabb4b8b562b4bf0c45436b25265d3a)
- build: :wrench: migrate from Jest to Vitest [`4138c43`](https://github.com/thkruz/ootk/commit/4138c4380bcd6c97bfeafe66078551f8eb3f8111)
- test: :white_check_mark: add tests for ephemerisManeuver [`3b8e24f`](https://github.com/thkruz/ootk/commit/3b8e24ff9916bdb1a7ff04a3baa1986ae80d2a75)
- feat: :sparkles: add angle calculations for satellites and Sun [`5d2fc8a`](https://github.com/thkruz/ootk/commit/5d2fc8affc7af755c377638e835e2aede6289dde)
- chore(gitignore): :sparkles: add CLAUDE.md to .gitignore [`3b32de8`](https://github.com/thkruz/ootk/commit/3b32de845f568b88893d4cc2db6a5d2740a9829f)
- build: :wrench: add ESM import path fixer for dist output [`07be71c`](https://github.com/thkruz/ootk/commit/07be71c7b14140bb8f93a364afe63f0111ce2596)
- feat(FormatTle): :sparkles: enhance TLE generation with new formatting [`c7cc06f`](https://github.com/thkruz/ootk/commit/c7cc06fb7b3470937f43ef79c175a7d07297b961)
- test: :white_check_mark: add tests for ModifiedGoodingIOD [`3795c53`](https://github.com/thkruz/ootk/commit/3795c531c4fe4f968eb64fa3d0d959bfcbc79799)
- refactor(conjunction): :recylce: update ConjunctionEvent constructor to use params object [`284dc02`](https://github.com/thkruz/ootk/commit/284dc02b6573ef7be66fa9721c47539d3bb5dfe7)
- test: :white_check_mark: add integration test infrastructure with Vitest [`0431ecc`](https://github.com/thkruz/ootk/commit/0431eccd2c9b19b4724ba8dc816d0397aae7a1d6)
- test: :camera_flash: update utils module snapshots for Vitest [`76daf1e`](https://github.com/thkruz/ootk/commit/76daf1ea2c9d1a8e5801cb35e6e7cf675d1d4a0d)
- test: :white_check_mark: add unit tests for conversions [`ec789f4`](https://github.com/thkruz/ootk/commit/ec789f4b9e786559b3807afdf8fda6f7a28fdc23)
- feat: :sparkles: add interpolator and maneuver modules [`6f94279`](https://github.com/thkruz/ootk/commit/6f94279d25a2f17c7743e990f5ac62110af8707d)
- style: :art: fix indentation and license header in source files [`d43bdb7`](https://github.com/thkruz/ootk/commit/d43bdb70b7df5b911c623739da4aa319dc3168d8)
- test: :camera_flash: update utils module snapshots for Vitest [`f7930db`](https://github.com/thkruz/ootk/commit/f7930db9a19e6f55fc190fd891572b62a2aa9753)
- refactor(chebyshev): :recycle: improve documentation and method naming [`007d17e`](https://github.com/thkruz/ootk/commit/007d17e271119593b21292bf3fc1a3a0efdd6899)
- chore(gitignore): :wastebasket: update .gitignore to include propagator accuracy summary file [`a87119c`](https://github.com/thkruz/ootk/commit/a87119c2f3624c157abda186c4754cbb81493239)
- test(propagator): :white_check_mark: add SP3 accuracy comparison results [`d06617c`](https://github.com/thkruz/ootk/commit/d06617ce6b5311b720a55c157ee261ec30a0197b)
- docs: :memo: update documentation [`fa530aa`](https://github.com/thkruz/ootk/commit/fa530aaec393a40b518549ef2bbd1b234c8c60e6)
- feat(Satellite): :sparkles: update OMM parsing to use Number [`8e5357c`](https://github.com/thkruz/ootk/commit/8e5357c784ad57bf15997af627a6f5ca9536bb87)
- feat(OmmParser): :sparkles: add JSON parsing for CelesTrak OMM [`42587bc`](https://github.com/thkruz/ootk/commit/42587bcbacbef5942f3a6a6bae9cf9d9efa09a8f)
- refactor(conjunction): :sparkles: reorganize imports and improve covariance handling [`e1a0d28`](https://github.com/thkruz/ootk/commit/e1a0d28e5cdeb9253d35fe559658b21f73c8bc5b)
- feat(numerical-propagator): :sparkles: add NumericalPropagatorOptions interface [`5723c02`](https://github.com/thkruz/ootk/commit/5723c020791f1bec0e920e088ac106f84d7b4854)
- test: :camera_flash: update transforms module snapshots for Vitest [`16ac8a4`](https://github.com/thkruz/ootk/commit/16ac8a4cc616d0e9469e4d135913a6ba378f2a24)
- test: :camera_flash: update transforms module snapshots for Vitest [`bf3fecb`](https://github.com/thkruz/ootk/commit/bf3fecbe021bc2502acf1859ea49945f0b9afb2d)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from imports [`04efea0`](https://github.com/thkruz/ootk/commit/04efea0bf93c96d4239367553488bca90c11755e)
- refactor(downhill-simplex): :recycle: improve method naming and documentation [`acfb462`](https://github.com/thkruz/ootk/commit/acfb4621fe29816a5a3baeb06351050a7494ad3d)
- refactor: :recycle: update sensor imports and exports [`33d40e4`](https://github.com/thkruz/ootk/commit/33d40e4c5b0469d5422d8953060b7ffec4e63ae2)
- feat(OmmFormat): :sparkles: update data format to support numeric types [`1a051ff`](https://github.com/thkruz/ootk/commit/1a051ffe7e517adbc895678bc0378dc9530491c9)
- ci: :construction_worker: add circular-check and integration test jobs [`bf9fa35`](https://github.com/thkruz/ootk/commit/bf9fa3502a321828233437bdf772fd4cdb98fc5e)
- test: :camera_flash: update body module snapshots for Vitest [`b3ff8e4`](https://github.com/thkruz/ootk/commit/b3ff8e402ffb000f8ae94ff77cc58a2d23c9e73c)
- test: :camera_flash: update body module snapshots for Vitest [`7589ca4`](https://github.com/thkruz/ootk/commit/7589ca487eab7294121ddcddd2f2e307ed43d6f2)
- feat(enums): :sparkles: add PropagatorType enum with implementations [`20fd9f6`](https://github.com/thkruz/ootk/commit/20fd9f6230639d702124fdc8c087fbdb5c8b800e)
- feat: :sparkles: add fromPosVel method for RIC coordinates [`93b0e68`](https://github.com/thkruz/ootk/commit/93b0e68907f3f225f3a20977ffabcbab6af345b6)
- refactor: :recycle: simplify imports in multiple files [`cf97616`](https://github.com/thkruz/ootk/commit/cf97616e967f16e7e351abe8396023d960d9af3e)
- fix(ClassicalElements): :bug: handle equatorial orbits in fromStateVector [`1b6d7f9`](https://github.com/thkruz/ootk/commit/1b6d7f9b2aac09994df5f433da49e0c432d09f88)
- test(body): update Moon snapshots for getMoonTimes (including timezone adjustment) and rae [`7612eca`](https://github.com/thkruz/ootk/commit/7612eca02a77dc5d53ddb56a2e5def4c6383cab5)
- fix: :bug: resolve circular dependency in types.ts [`9b9dc88`](https://github.com/thkruz/ootk/commit/9b9dc88012a2efb2d32458bf8d2ac63797f45a81)
- fix(FormatTle): :bug: fix TLE formatting to match NORAD/CelesTrak conventions [`8862276`](https://github.com/thkruz/ootk/commit/88622764a3b6828ccd2ed953925ccafa763ea2a5)
- feat: :sparkles: add additional star parameters to interface [`6bf1f21`](https://github.com/thkruz/ootk/commit/6bf1f215557efd5ec49bfcf3e085dba3b572541e)
- feat: :sparkles: add PayloadStatus type [`e691a5d`](https://github.com/thkruz/ootk/commit/e691a5db862cb9141a07a38d29ab8e5e0b7bf203)
- fix: :bug: replace @src/ path alias with relative imports [`3169ba5`](https://github.com/thkruz/ootk/commit/3169ba5cf62cc2f78e6baac5571f570ae38ea476)
- refactor: :recycle: Update sun position methods in force classes [`13dc9c0`](https://github.com/thkruz/ootk/commit/13dc9c02925a231ac724694cec8517951369a34d)
- fix(package): :bug: fix license typo and configure dual ESM/CJS exports [`ba956a8`](https://github.com/thkruz/ootk/commit/ba956a80b5370d724ce0582ab8794d79cff03fc6)
- test: :sparkles: add tests for factorial function with edge cases [`aec8e93`](https://github.com/thkruz/ootk/commit/aec8e9333fc6ca9b300afb3ee6f7861b9d0961ef)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`9bce358`](https://github.com/thkruz/ootk/commit/9bce3588b48cf3d8ed420574ab9fdf5bfa8c1b91)
- fix(Epoch): :bug: allow pre-1970 POSIX timestamps for historic TLEs [`3776ada`](https://github.com/thkruz/ootk/commit/3776ada2110a623f85a94ff087982a4a8094a26d)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`af2b4e2`](https://github.com/thkruz/ootk/commit/af2b4e2fa7cb80a11a2bd1ec0ed63ec23b48a954)
- refactor: :recycle: clean up exports in index.ts [`ee556b2`](https://github.com/thkruz/ootk/commit/ee556b2cd8fb60d818f73c8e6e6c0d913b273cc4)
- fix: :bug: correct maneuver filtering logic in propagator [`6dd0d1a`](https://github.com/thkruz/ootk/commit/6dd0d1ab2c7d9c8a36877ed0d729e5269175ef96)
- build: :wrench: add madge configuration for circular dependency detection [`c164f92`](https://github.com/thkruz/ootk/commit/c164f9206ea499ededeadcc0062850a262204c24)
- fix(CatalogSource): :bug: update catalog source names to match standards [`a28ef5d`](https://github.com/thkruz/ootk/commit/a28ef5d0d2681f63f5c79f75570e4539f203ebf0)
- feat(TleParams): :sparkles: add additional satellite parameters [`e3e4ef8`](https://github.com/thkruz/ootk/commit/e3e4ef87c94275e42c13c0beedd390e70a655031)
- chore(ci): :wrench: add Node 18 to test matrix [`a851aec`](https://github.com/thkruz/ootk/commit/a851aecad7be4df3f5aa1daf96533c29079522c3)
- build: :package: add madge, vitest and integration test scripts [`5b93c82`](https://github.com/thkruz/ootk/commit/5b93c82a9860f2ca13efd4de667f47ef5d210eb1)
- feat: :sparkles: Integrate astronomy-engine for star position [`b8f940a`](https://github.com/thkruz/ootk/commit/b8f940aed765a5ba755eb126e20f08c09ad46d54)
- refactor(conjunction): :sparkles: remove file extensions from imports [`4df0ad8`](https://github.com/thkruz/ootk/commit/4df0ad88e1b826cdae50fcbbec7c66ca49ad6bd8)
- fix: :bug: resolve circular dependencies in operations module [`bffe544`](https://github.com/thkruz/ootk/commit/bffe544c757cda090fbc9f02d13d09ea085dbca0)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from exports [`2f1856b`](https://github.com/thkruz/ootk/commit/2f1856bbf012fc0c99d6f79569ff2f553a396e0c)
- fix: :bug: initialize Float64Arrays with coeffs length [`66565ce`](https://github.com/thkruz/ootk/commit/66565ce96e9e863c89e499eaab1f95aa73897e9c)
- refactor: :recycle: rename astronomicalUnit to KM_PER_AU and update usages in Sun & SolarRadiationPressure [`6bc4943`](https://github.com/thkruz/ootk/commit/6bc494365e8302c92b681456a0a22b090f8edf2b)
- feat(Satellite): :sparkles: add fromOmm method for satellite creation [`6dfb390`](https://github.com/thkruz/ootk/commit/6dfb39027b67875ccaf8987da49218f2a17113d6)
- chore(build): :wrench: bundle astronomy-engine and add CJS output [`1ed5e98`](https://github.com/thkruz/ootk/commit/1ed5e98fcdff33228e06a00016a6f292863695d3)
- test(create-sample-covariance-from-tle): :white_check_mark: add test for realistic covariance creation [`8e7806e`](https://github.com/thkruz/ootk/commit/8e7806e24e0b5594c1b8fa7a633d4515d2d2b67f)
- fix(sgp4): :bug: handle decayed satellites in Sgp4 class [`c4b985a`](https://github.com/thkruz/ootk/commit/c4b985af00f74ec04bb8ccd1c8168384d28b011d)
- test(probability): :white_check_mark: adjust relative velocity and position for encounter plane [`9e112b0`](https://github.com/thkruz/ootk/commit/9e112b05d9570e876c661a914c6e22b194076adc)
- refactor: :recycle: Correct export test for CelestialBody [`ceb0c58`](https://github.com/thkruz/ootk/commit/ceb0c58af29369d10485ff2a4db9d98d1a1aa685)
- refactor(GaussIOD): reorganize import statements for better clarity [`842b458`](https://github.com/thkruz/ootk/commit/842b458b309cfbc78eafb162359b4a8d2c499cc9)
- test(FormatTle): :white_check_mark: update test expectations for new TLE formatting [`a522f08`](https://github.com/thkruz/ootk/commit/a522f0803334f6cd6107335b80217cb9f45ac228)
- feat(optimize): :sparkles: add index file to export optimization modules [`64485c2`](https://github.com/thkruz/ootk/commit/64485c2a6e2a5e3b60c9f1ba1c16174e6c7bcccf)
- refactor(functions): :sparkles: optimize log10, array2d, and distance calculations [`0c4dc65`](https://github.com/thkruz/ootk/commit/0c4dc6540d5e6d534933705c6a8a70fe3d2b8566)
- chore(ootk): bump @typescript-eslint/eslint-plugin & parser to ^8.46.2 and refresh package-lock.json [`e340ccc`](https://github.com/thkruz/ootk/commit/e340ccc84207b744e0ef1623c6f1a542fd07b5d8)
- fix(Tle): :bug: handle '0' as valid BSTAR symbol [`7dded61`](https://github.com/thkruz/ootk/commit/7dded6167597678d2a749954f4416b2283008928)
- refactor: :recycle: update tsconfig to exclude test files [`4b06dad`](https://github.com/thkruz/ootk/commit/4b06dad3133435a60562d61b22c1bf7e03776d4c)
- fix(ootk): add missing SpaceObjectType string mappings for terrestrial/gas/ice/dwarf planets and moon [`9b49f2f`](https://github.com/thkruz/ootk/commit/9b49f2f09862d4fa9bc324c913f61dea22698873)
- test: :wrench: increase timeout for ConjunctionAssessment high-fidelity tests [`7e1e498`](https://github.com/thkruz/ootk/commit/7e1e4989c2ca8a9f84cba199fc7d67c691f3bd0a)
- chore: :wrench: update .gitignore to include new files [`d8a565a`](https://github.com/thkruz/ootk/commit/d8a565a8fb9ee4e21d6a28ba92f004ac5ac6a9a1)
- chore: :wrench: update version to 6.0.0-rc.4 [`ae88268`](https://github.com/thkruz/ootk/commit/ae8826827e56168b90c162b1ef9cd86a01202e08)
- refactor(main): :sparkles: remove unnecessary file extensions from exports [`6467bfa`](https://github.com/thkruz/ootk/commit/6467bfa913cf13ce0a1e7e8573ba3efc913e58f8)
- chore(package): update version to 6.0.0-rc.2 [`6316048`](https://github.com/thkruz/ootk/commit/63160480d8c06913fa50cd5f78e9811ba530cf56)
- chore(.gitignore): :wrench: add .dev.vars to ignore list [`355e740`](https://github.com/thkruz/ootk/commit/355e740a6179e78e267cbbd16527b2e4bb86a51c)
- feat(orbit-determination): :sparkles: add maxIter option to SolveOptions [`2571b7b`](https://github.com/thkruz/ootk/commit/2571b7bceabfe3b9c7584bbf54ae4e217093bf77)
- fix(Tle): :bug: handle additional BSTAR exponent symbols [`2b31e4f`](https://github.com/thkruz/ootk/commit/2b31e4fc097582ee8644ebec50b4c20ef4e41932)
- chore(package): :wrench: bump version to 6.0.3 [`56e6b13`](https://github.com/thkruz/ootk/commit/56e6b1354b7f1c12755e0833c80af25531b5cbc3)
- test(FormatTle): :white_check_mark: fix line 2 expected value for new formatting [`198faa0`](https://github.com/thkruz/ootk/commit/198faa0b11051ed5965e157e475f6f5a6b54bc43)
- chore(package): :wrench: bump version to 6.0.2 [`9573455`](https://github.com/thkruz/ootk/commit/9573455557ac8e0782ad08f7337eb543449016ae)
- chore(package): :wrench: bump version to 6.0.1 [`9b88b46`](https://github.com/thkruz/ootk/commit/9b88b461440f250be487e41d75942a528ececa8b)
- chore(gitignore): :wastebasket: fix path format for propagator accuracy summary file [`b8ff3b3`](https://github.com/thkruz/ootk/commit/b8ff3b364329cbcf72f96f1d9560952989151776)
- chore: :wrench: update repository URL format in package.json [`d38f1c5`](https://github.com/thkruz/ootk/commit/d38f1c5328d75f6b7044adf301ea42bb9d5d15d6)
- chore: :wrench: update version to 6.0.0-rc.5 in package.json [`52c65a2`](https://github.com/thkruz/ootk/commit/52c65a2b0ec901f915fc91ea104ac4b92e73426b)
- fix: :bug: resolve circular dependency in Earth class [`be38190`](https://github.com/thkruz/ootk/commit/be38190bf6b1cd58953b725760d6d3dbeebe891a)
- chore: :wrench: update coveragePathIgnorePatterns in jest config [`c275e6b`](https://github.com/thkruz/ootk/commit/c275e6b74b8aee1d18e1f44097051180e1a59299)
- chore: :truck: update import path for transformsData [`b022166`](https://github.com/thkruz/ootk/commit/b0221668108cac5cf0372687d7044a91a21bbcda)
- refactor(orbit-determination): :recycle: move CostFunction import to internal directory [`a3e00b1`](https://github.com/thkruz/ootk/commit/a3e00b11ae2d301b9ef8e89a832661ca432821be)
- refactor(conjunction): :sparkles: rename parameter for clarity in initializeCovarianceSamples [`50e2da8`](https://github.com/thkruz/ootk/commit/50e2da8fd1f7996c7fffb9d28beff33da2fb0a0a)
- chore(package): update version to 6.0.0-rc.3 [`02aa5b3`](https://github.com/thkruz/ootk/commit/02aa5b39cbd7570f9c494ab0d4b85b1312c7818f)
- test(integration): :white_check_mark: update export snapshot for new OMM exports [`63e06e4`](https://github.com/thkruz/ootk/commit/63e06e42b762aa154a7d37fe31d476484c093db3)
- fix: :bug: export PayloadStatus from types module [`247323a`](https://github.com/thkruz/ootk/commit/247323aefb79bbf613993502275c3130ad54d049)
- chore: :wrench: add .npmrc to .gitignore [`6b4dfe7`](https://github.com/thkruz/ootk/commit/6b4dfe7f40d5c07d1cbcc9f848dd4255f2fa2fbf)
- test: :wrench: exclude integration tests from Jest [`08fc0ed`](https://github.com/thkruz/ootk/commit/08fc0edd53494a6a176d810dac62fe73c781fd19)
- refactor: :truck: rename all iod tests to match main files [`9272b24`](https://github.com/thkruz/ootk/commit/9272b24fc983c132b850607880aa770789091f19)
- docs: update CHANGELOG (add v5.1.1 entries and reorder v4/v5 sections) [`e4a0574`](https://github.com/thkruz/ootk/commit/e4a057462d523a7eb40fff5fc6eaecb231ec15bf)

#### [v6.0.3](https://github.com/thkruz/ootk/compare/v6.0.2...v6.0.3)

> 29 November 2025 

- docs: add comprehensive advanced features guide [`#41`](https://github.com/thkruz/ootk/pull/41)
- docs: add comprehensive user guide and getting started documentation [`#39`](https://github.com/thkruz/ootk/pull/39)
- feat: add high accuracy conjunction assessment workflow [`#37`](https://github.com/thkruz/ootk/pull/37)
- feat: add comprehensive examples for library features [`#38`](https://github.com/thkruz/ootk/pull/38)
- Lambert Satellite Integration [`#36`](https://github.com/thkruz/ootk/pull/36)
- test: :camera_flash: update snapshots to deal with floating point errors [`8aaa72b`](https://github.com/thkruz/ootk/commit/8aaa72bd12414260661578bdbebdc2880a7cfd2a)
- refactor: :recycle: update and modernize body module to use astronomy-engine [`f667a99`](https://github.com/thkruz/ootk/commit/f667a9936bde0d91f7375626eb099def3ab6675a)
- feat: :sparkles: Add CDM types and parsing/exporting logic [`b62ace8`](https://github.com/thkruz/ootk/commit/b62ace8382887f246f0ae8d8d32b9832305d52bd)
- test: :sparkles: add integration tests for core functionality [`c5f2baa`](https://github.com/thkruz/ootk/commit/c5f2baa6edfd93c83698750c9870d68a86c53fd7)
- refactor: :recycle: complete phase 1A of objects module refactor [`ab64d69`](https://github.com/thkruz/ootk/commit/ab64d69ed200cb8c04ba944ec507c57ac07437aa)
- feat: :sparkles: Add communication devices and tests [`4ddfd84`](https://github.com/thkruz/ootk/commit/4ddfd842e7b53552c803d69bb9a6dc43d8a7395b)
- feat: :sparkles: Add OEM parsing and data structures [`6420500`](https://github.com/thkruz/ootk/commit/64205004006524f4fa8cbc40f721630247de518d)
- feat: :sparkles: add PassiveRFSensor and PhasedArrayRadar classes [`3aa9e1f`](https://github.com/thkruz/ootk/commit/3aa9e1f109041c9fde64408e4f14deaaf855d6ce)
- test: :rocket: add LambertIOD test suite for orbit determination [`9d1d061`](https://github.com/thkruz/ootk/commit/9d1d0615c9f9366679078866c9878ed36296e648)
- refactor: :recycle: Rename ECF to ECEF in codebase [`b033a34`](https://github.com/thkruz/ootk/commit/b033a347f45c1f547b9e910f2f60f748e402cb92)
- Implement tests for GaussIOD and GoodingIOD; refactor ModifiedGoodingIOD and RungeKuttaAdaptive for improved error handling and integration logic [`4099fe2`](https://github.com/thkruz/ootk/commit/4099fe2966d0f71530c7e3c1b1f671e56415dd6e)
- test: :zap: improve test performance [`4cabf8e`](https://github.com/thkruz/ootk/commit/4cabf8e9cddedd3181b4b8638e5ad1d10c06e52d)
- feat(ootk): :sparkles: add interpolator, maneuver and orbit-design modules [`c9163d7`](https://github.com/thkruz/ootk/commit/c9163d70ec025d2c1042c5079485a425105df750)
- feat: :sparkles: Add ScheduledContact and tests [`ecfdc4a`](https://github.com/thkruz/ootk/commit/ecfdc4a8247393a619ade0fa5851649cae234e12)
- test: :white_check_mark: Add tests for DynamicGroundObject [`0b80eae`](https://github.com/thkruz/ootk/commit/0b80eaeab2599a92d7310c2ae352601d65115d6c)
- test(satellite): :white_check_mark: add unit tests for propagators [`2c262bd`](https://github.com/thkruz/ootk/commit/2c262bd982cf7397920f61be68099e7e3ba03ba1)
- test: :sparkles: add comprehensive tests for Levenberg-MarquardtOD [`4366868`](https://github.com/thkruz/ootk/commit/436686862173313f97a10e7d3da8903322e45bf0)
- docs: add Lambert integration guide and examples [`8149d08`](https://github.com/thkruz/ootk/commit/8149d0842281ca281172a059861c011c418df165)
- docs(time): enhance documentation for time classes and conversions [`a0ba7f7`](https://github.com/thkruz/ootk/commit/a0ba7f7b9fe38919ce7a570b3c2ef63969eb554f)
- feat: :sparkles: Add RepeatGroundTrack and tests [`ea8a151`](https://github.com/thkruz/ootk/commit/ea8a1511edf43ac83d7509f5ef059237a3f93cb5)
- chore(ootk): standardize imports/exports, refine base APIs, bump version [`5bd33d9`](https://github.com/thkruz/ootk/commit/5bd33d9692d0d4e55a43a3b6c887a871517b734b)
- test: :white_check_mark: add integration tests for built package [`c2935fe`](https://github.com/thkruz/ootk/commit/c2935fe96e98ada46624d1577b694adb503d8b69)
- refactor: 🔧 rename private methods for consistency and clarity [`d4bc5dd`](https://github.com/thkruz/ootk/commit/d4bc5dd0d171cf6e5444e4bb005432943d184bf7)
- feat: :sparkles: add AccessCalculator and AccessWindow types [`7279bed`](https://github.com/thkruz/ootk/commit/7279bed55e0d92cb61b38800ffefb41f46327c31)
- test: :camera_flash: update coordinate module snapshots for Vitest [`7f53cbb`](https://github.com/thkruz/ootk/commit/7f53cbbb5e924e3ba1ce51b131efc93834d6f7d2)
- feat(parsers): :sparkles: add OMM parser and types [`645b3e4`](https://github.com/thkruz/ootk/commit/645b3e4f955382e6861fc4eb3556f5c98fb7da8b)
- test: :camera_flash: update coordinate module snapshots for Vitest [`10f7564`](https://github.com/thkruz/ootk/commit/10f756430006a7fdff55b587951e7174898f3868)
- test: :white_check_mark: add tests for interpolators [`b34915c`](https://github.com/thkruz/ootk/commit/b34915c02b6d94bcc595114c210e6df5dce3bb3f)
- feat: :sparkles: Add ConstellationGenerator and tests [`6bac6f1`](https://github.com/thkruz/ootk/commit/6bac6f1df04dc2e3c78b34729f6ae61ef6128acb)
- feat: :sparkles: Add custom error classes for ootk [`c828297`](https://github.com/thkruz/ootk/commit/c828297e26161ba3ce1ffbf7df8bdbc37a06d5cc)
- feat: :sparkles: add VisualizationHelpers and related types [`855fa59`](https://github.com/thkruz/ootk/commit/855fa599205b62bf6fa42a80af9ca046475914b9)
- docs: :memo: add comprehensive coordinate systems guide [`a815ed1`](https://github.com/thkruz/ootk/commit/a815ed143d2dbad9048366595025d68502a5bdd6)
- test: :truck: move tests into __tests__ folders for easier management [`1a00952`](https://github.com/thkruz/ootk/commit/1a0095233c05f67100281bead7bfc06ef9281d52)
- feat: :sparkles: add clone methods for sensor and device classes [`2278f34`](https://github.com/thkruz/ootk/commit/2278f349f8b42b40a013dd49e4f329d36b53ead7)
- feat: :sparkles: add OrbitFinder class for satellite orbits [`45332cc`](https://github.com/thkruz/ootk/commit/45332cc7df8c49ba795bf18860a04b2edf0702ff)
- test(integration): :white_check_mark: add pre-publish integration tests [`bc9add5`](https://github.com/thkruz/ootk/commit/bc9add5692316841b0b65b4716648c3055af4b4c)
- feat: :sparkles: add SunStatus enum for illumination states [`164227c`](https://github.com/thkruz/ootk/commit/164227c69981f1c2d09e38660f07525cc3a2df76)
- feat: :sparkles: Add HorizonsParser and tests [`f85a890`](https://github.com/thkruz/ootk/commit/f85a890266945a8e79855db73554aa5cd4328885)
- test: :camera_flash: update operations module snapshots for Vitest [`7718864`](https://github.com/thkruz/ootk/commit/77188645038d0e2f6a7201ae3d51b551ceed9282)
- test: :camera_flash: update operations module snapshots for Vitest [`2df04b5`](https://github.com/thkruz/ootk/commit/2df04b5dcd4809d21ad0efbac39c6a75188fb7f5)
- refactor: :recycle: change sensor and object IDs to numbers [`21ef8e3`](https://github.com/thkruz/ootk/commit/21ef8e3925728f3801c4be03c91a2aff082969a6)
- build: :arrow_up: upgrade all dependencies to most current [`19fb70c`](https://github.com/thkruz/ootk/commit/19fb70c9927226f47f709d0877bfbd5cdca019b6)
- feat(parsers): :sparkles: add OdmExporter and export options [`4188e41`](https://github.com/thkruz/ootk/commit/4188e41e9fd4e1b1e42808d0de4a14daa0d4f712)
- test(create-covariance-from-tle): :sparkles: add tests for covariance creation from TLE [`a2f0e8d`](https://github.com/thkruz/ootk/commit/a2f0e8dd6a17f475e96fe87b5618623afeadfe29)
- docs: :memo: update copyright year to 2025-2026 [`83cccfb`](https://github.com/thkruz/ootk/commit/83cccfb1503c49291d9adcf71f70bf1a8226f0b2)
- feat(ootk): :satellite: add NASA JPL Horizons client + constants/interfaces; extend SpaceObjectType with planetary/moon types and update tsconfig lib [`b0cf306`](https://github.com/thkruz/ootk/commit/b0cf30698808a9d96f5c05e06d8f28320057d15e)
- remove: :fire: delete Horizons API client and constants [`c1bdf42`](https://github.com/thkruz/ootk/commit/c1bdf423f4ffc0e4c2ecdec1032242aa8d738990)
- test(sgp4): :white_check_mark: add unit tests for Sgp4Propagator functionality [`9e76fa6`](https://github.com/thkruz/ootk/commit/9e76fa6c8b428550d88f4f541e4293430401b53a)
- test(OmmParser): :white_check_mark: add unit tests for OMM parsing [`e238a56`](https://github.com/thkruz/ootk/commit/e238a56c0c50d7a43552bda501b76ae4689b160b)
- test(propagator): :white_check_mark: add unit tests for MockPropagator and RungeKutta4Propagator [`24e6c04`](https://github.com/thkruz/ootk/commit/24e6c048ddd37e5a4ba033af46c390fa26cfb191)
- docs(readme): :sparkles: add comprehensive documentation for orbit determination algorithms [`006de56`](https://github.com/thkruz/ootk/commit/006de568a0e05c1617c1e1585cd605410c55a5e9)
- docs(readme): :sparkles: add README for optimize module with examples [`97e4360`](https://github.com/thkruz/ootk/commit/97e4360fec0f61467b0412719fc8a174d5f84674)
- docs: :memo: update documentation for coordinate transformations [`eb7dd1d`](https://github.com/thkruz/ootk/commit/eb7dd1db676ae299fc5fe6ec918e4586cd677d73)
- test: :white_check_mark: add tests for optimization algorithms [`3892df5`](https://github.com/thkruz/ootk/commit/3892df59f66828d48e0ea15f1d374cbdd5abcc06)
- feat: :sparkles: add history tracking to Satellite class [`6aef063`](https://github.com/thkruz/ootk/commit/6aef063c610974810f3ff8568ef71a633b8fc643)
- test(FormatTle): :white_check_mark: add CelesTrak stations validation tests [`bb4230c`](https://github.com/thkruz/ootk/commit/bb4230c659cd2c8473a71acecec85ac498515d37)
- test(kepler): :white_check_mark: add comprehensive tests for KeplerPropagator [`5d493ee`](https://github.com/thkruz/ootk/commit/5d493ee4c1b2b75756cecb5589d4fcc7d531ba99)
- feat: :sparkles: make lat, lon, alt properties readonly [`f1f2057`](https://github.com/thkruz/ootk/commit/f1f2057655ac8c475ab3bd47f0695594d865fa61)
- docs(readme): :memo: add detailed documentation for orbital propagators [`d9ff134`](https://github.com/thkruz/ootk/commit/d9ff1349623be2170cde04f812d232e7371a80b4)
- test: :camera_flash: update observation module snapshots for Vitest [`eb4f13a`](https://github.com/thkruz/ootk/commit/eb4f13a074c16d0b78358c8bca0a63b28eb3229a)
- test: :camera_flash: update observation module snapshots for Vitest [`6d99dde`](https://github.com/thkruz/ootk/commit/6d99dde7cbe118ac2ee39f9322e4565045934001)
- feat: :sparkles: implement RAE methods in SpaceObject class [`daebe13`](https://github.com/thkruz/ootk/commit/daebe138ac5137d352bcac61c2944d49c79df101)
- refactor(simplex): :recycle: move SimplexEntry to internal directory [`a8945de`](https://github.com/thkruz/ootk/commit/a8945de074527ceaaa1bd3e37b424ad007cffe0b)
- refactor(smoothing): :recycle: convert ExponentialSmoothing class to functions [`6386c64`](https://github.com/thkruz/ootk/commit/6386c647bf1bc28bfb9a6000005171ff840d345a)
- test: :white_check_mark: add tests for Hill class methods [`aeca4c5`](https://github.com/thkruz/ootk/commit/aeca4c5c6a5c083568aec7503af681d97ef7153d)
- docs(golden-section): :memo: enhance documentation and examples for optimizer [`5fe3a53`](https://github.com/thkruz/ootk/commit/5fe3a53671f774d7765b53327f6e954c389eea1e)
- test: :camera_flash: update time module snapshots for Vitest [`2e0d369`](https://github.com/thkruz/ootk/commit/2e0d369f0945453d92825ba7e7f4eb152780bdd3)
- feat: :sparkles: add validation errors for sensor parent checks [`9dc1673`](https://github.com/thkruz/ootk/commit/9dc1673a9600a64242a6b04c66e6f8cbf29f35f0)
- test: :camera_flash: update time module snapshots for Vitest [`72e33f2`](https://github.com/thkruz/ootk/commit/72e33f24f939434c9940886dc2ae5529aa120317)
- feat: :sparkles: enhance visibility checks for Transmitter [`f1eb38c`](https://github.com/thkruz/ootk/commit/f1eb38c0e7f9b646720760dc0e60abefe4dfc714)
- feat: :sparkles: add history tracking and cloning options [`2cdb3c5`](https://github.com/thkruz/ootk/commit/2cdb3c5877af6208c277733f18a9562518d6b1f8)
- refactor: :recycle: replace EciVec3 with TemeVec3 types [`69e4d53`](https://github.com/thkruz/ootk/commit/69e4d53611df9a99986c589ec2505c7c30cb2bc4)
- refactor: :recycle: streamline imports and enhance AccessWindow [`a0fa846`](https://github.com/thkruz/ootk/commit/a0fa8464004b1e330d624b20b7218c1609346f47)
- refactor(polynomial-regression): :recycle: move PolynomicalRegressionResult to internal directory [`87f200b`](https://github.com/thkruz/ootk/commit/87f200b2554b7cc6724eea49f47f6755b8626a8a)
- docs: :memo: add examples for SunBody, Satellite, and Sensor [`6be84fe`](https://github.com/thkruz/ootk/commit/6be84fec69bc99ab77234928882a002787b00564)
- docs(simple-linear-regression): :memo: enhance class documentation and examples [`68e1cab`](https://github.com/thkruz/ootk/commit/68e1cabd83297f188f92743e4483edda06d98c71)
- docs(polynomial-regression): :memo: enhance documentation and examples for optimizer [`9a0b207`](https://github.com/thkruz/ootk/commit/9a0b20765b6202724fa11c7c0f011ab86ec30aa5)
- build: :building_construction: migrate to tsup for ESM builds [`1cf04cb`](https://github.com/thkruz/ootk/commit/1cf04cb38d38671b35dbff7a80042de5b42cbdd8)
- refactor(objects): :recycle: remove PropagatorType from ObjectTypes [`74f3f8b`](https://github.com/thkruz/ootk/commit/74f3f8b3a16e4c4f8e02737f4dd6e15bca4fad98)
- test(Tle): :white_check_mark: add tests for meanMoDev1 and bstar parsing [`506a2d8`](https://github.com/thkruz/ootk/commit/506a2d81b5e95c0e5065d0fcbf7ee5056ec91345)
- test: :white_check_mark: migrate test files from Jest to Vitest [`a1f10c7`](https://github.com/thkruz/ootk/commit/a1f10c7f828d4581eecf67aff0f6eaeda5c63003)
- test: :truck: move tests into __tests__ folders for easier management [`38e834a`](https://github.com/thkruz/ootk/commit/38e834a25e1533f06408b4e080930cf5f94fdd23)
- refactor: :recycle: update SpaceObject to use TEME frame [`e15fc3b`](https://github.com/thkruz/ootk/commit/e15fc3b3baa58bcd4e7d901e22f48b8593c81a59)
- refactor(orbit_determination): improve GoodingIOD and ModifiedGoodingIOD structure [`c8a4587`](https://github.com/thkruz/ootk/commit/c8a45877fc063099fac74b997277ca7a2a0f49b3)
- build: :wrench: migrate from Jest to Vitest [`420630a`](https://github.com/thkruz/ootk/commit/420630a3663e1e7ad70c8943df302903dc3f2f31)
- test: :white_check_mark: add tests for ephemerisManeuver [`3c9b1d4`](https://github.com/thkruz/ootk/commit/3c9b1d439dcab82ce516cec6194f56e5e7e9616b)
- feat: :sparkles: add angle calculations for satellites and Sun [`3c1cb5a`](https://github.com/thkruz/ootk/commit/3c1cb5a354d1af97283789ce57897b1e1090eaed)
- chore(gitignore): :sparkles: add CLAUDE.md to .gitignore [`6a8a3e7`](https://github.com/thkruz/ootk/commit/6a8a3e7c56e1746f3e23516d6ef35158afcc4e30)
- build: :wrench: add ESM import path fixer for dist output [`dd28aa5`](https://github.com/thkruz/ootk/commit/dd28aa500c73c733168f99ba15ab2d91aa6cc50a)
- feat(FormatTle): :sparkles: enhance TLE generation with new formatting [`ba10fd0`](https://github.com/thkruz/ootk/commit/ba10fd0792ff4d5ce762508f7849b16ea9707265)
- test: :white_check_mark: add tests for ModifiedGoodingIOD [`fbcf52d`](https://github.com/thkruz/ootk/commit/fbcf52d106b332a1eecd81b1b10949acd2a3d10d)
- refactor(conjunction): :recylce: update ConjunctionEvent constructor to use params object [`426f02f`](https://github.com/thkruz/ootk/commit/426f02fa8e3de0a6a3cf5c5ab045998888d904a6)
- test: :white_check_mark: add integration test infrastructure with Vitest [`2ebf579`](https://github.com/thkruz/ootk/commit/2ebf5797984b2bb1ee159258e34550b05b0c1fda)
- test: :camera_flash: update utils module snapshots for Vitest [`3034ddf`](https://github.com/thkruz/ootk/commit/3034ddf368c00b273fcba2332f8ff07b7e85699b)
- test: :white_check_mark: add unit tests for conversions [`ebcec5b`](https://github.com/thkruz/ootk/commit/ebcec5bf4ecef6b4fd1a739b9065c8efe24f6d7e)
- feat: :sparkles: add interpolator and maneuver modules [`17c1af6`](https://github.com/thkruz/ootk/commit/17c1af68583648f45e815ebab261d44361d76b8d)
- style: :art: fix indentation and license header in source files [`ba6a437`](https://github.com/thkruz/ootk/commit/ba6a437eddda7f6ff543c053ce9b939cc37e2593)
- test: :camera_flash: update utils module snapshots for Vitest [`94fd1fe`](https://github.com/thkruz/ootk/commit/94fd1fec908ca4dfbc812ba9c60b4b0502dbb293)
- refactor(chebyshev): :recycle: improve documentation and method naming [`d40d8e0`](https://github.com/thkruz/ootk/commit/d40d8e0318e6134cd78c717c17e7a8348cec948a)
- chore(gitignore): :wastebasket: update .gitignore to include propagator accuracy summary file [`1673dc2`](https://github.com/thkruz/ootk/commit/1673dc29f55ecccf92b8cbccdd7cb44100f89644)
- test(propagator): :white_check_mark: add SP3 accuracy comparison results [`5bcc040`](https://github.com/thkruz/ootk/commit/5bcc04091c9b6bc65f40ef69d780106abecfef26)
- docs: :memo: update documentation [`208253c`](https://github.com/thkruz/ootk/commit/208253cf99ddecd2cf81449b253d1c67927af160)
- feat(Satellite): :sparkles: update OMM parsing to use Number [`0d37c26`](https://github.com/thkruz/ootk/commit/0d37c2652a83118605628ef4b667986cf324d5e8)
- feat(OmmParser): :sparkles: add JSON parsing for CelesTrak OMM [`9da31e3`](https://github.com/thkruz/ootk/commit/9da31e3a291ea744b16a3ea641869ff7d6ef08be)
- refactor(conjunction): :sparkles: reorganize imports and improve covariance handling [`d3c0743`](https://github.com/thkruz/ootk/commit/d3c07435db0888216cbfb6d2dc660c11b0d9982a)
- feat(numerical-propagator): :sparkles: add NumericalPropagatorOptions interface [`c23666f`](https://github.com/thkruz/ootk/commit/c23666fcf05fa033e47a0d8b2ec9ba9b0d806e69)
- test: :camera_flash: update transforms module snapshots for Vitest [`0d086dc`](https://github.com/thkruz/ootk/commit/0d086dcf25d4fd96c1a6e45916cbcd8b22d6c0c2)
- test: :camera_flash: update transforms module snapshots for Vitest [`5e28592`](https://github.com/thkruz/ootk/commit/5e28592f637ea52a3e7f45bdfda12443f5b6164f)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from imports [`5457a4c`](https://github.com/thkruz/ootk/commit/5457a4c4e9580b86d34d3d471a9774f99fbbfe37)
- refactor(downhill-simplex): :recycle: improve method naming and documentation [`5f54b43`](https://github.com/thkruz/ootk/commit/5f54b432b0bd926d7036b6fbd284fcca3ca1538d)
- refactor: :recycle: update sensor imports and exports [`97fea98`](https://github.com/thkruz/ootk/commit/97fea984e2f76de67a5d7b8a8b5e592c9c0b7a07)
- feat(OmmFormat): :sparkles: update data format to support numeric types [`afecc3f`](https://github.com/thkruz/ootk/commit/afecc3f97e3c8e4774063c0460b7bd3ae7eb0901)
- ci: :construction_worker: add circular-check and integration test jobs [`a5def79`](https://github.com/thkruz/ootk/commit/a5def79cc7f4b2ccfb9f35a0326af6e12396b0d7)
- test: :camera_flash: update body module snapshots for Vitest [`acf4527`](https://github.com/thkruz/ootk/commit/acf45273b8fb08374dda2156db9eab70eff10878)
- test: :camera_flash: update body module snapshots for Vitest [`a519e63`](https://github.com/thkruz/ootk/commit/a519e63c3121ceb8db5c87b666c6822fa8062760)
- feat(enums): :sparkles: add PropagatorType enum with implementations [`54b7b46`](https://github.com/thkruz/ootk/commit/54b7b46662e85befb7c1b108486f057c921e2e81)
- feat: :sparkles: add fromPosVel method for RIC coordinates [`e6aeb91`](https://github.com/thkruz/ootk/commit/e6aeb91d7d67b8f1e6b15a251597325e25cc0292)
- refactor: :recycle: simplify imports in multiple files [`227b241`](https://github.com/thkruz/ootk/commit/227b2418e625e95ad1ffdc7c833a9043101e5815)
- test(body): update Moon snapshots for getMoonTimes (including timezone adjustment) and rae [`2538834`](https://github.com/thkruz/ootk/commit/25388341ff11cfe825d2993f6359972b1ca43ef4)
- fix: :bug: resolve circular dependency in types.ts [`29d3f5d`](https://github.com/thkruz/ootk/commit/29d3f5d2be17206c7297770e2f5fdc51d49192b4)
- fix(FormatTle): :bug: fix TLE formatting to match NORAD/CelesTrak conventions [`d34218d`](https://github.com/thkruz/ootk/commit/d34218d7f1251f7436e3ed7560587c4e3b26d1c0)
- feat: :sparkles: add additional star parameters to interface [`270f08d`](https://github.com/thkruz/ootk/commit/270f08d2a16ef94ce040cbecf1aca4582475908c)
- feat: :sparkles: add PayloadStatus type [`c4b4d46`](https://github.com/thkruz/ootk/commit/c4b4d461b6b9a17b00363a54125994b8ea488fde)
- fix: :bug: replace @src/ path alias with relative imports [`e59187d`](https://github.com/thkruz/ootk/commit/e59187d2f67f92975358779744903d161685ddbf)
- refactor: :recycle: Update sun position methods in force classes [`cc75b73`](https://github.com/thkruz/ootk/commit/cc75b7349c05734388c8601e482b071c7bba003e)
- fix(package): :bug: fix license typo and configure dual ESM/CJS exports [`57de37b`](https://github.com/thkruz/ootk/commit/57de37ba1bfec6e138c897cd9b799ecd3e6a7e19)
- test: :sparkles: add tests for factorial function with edge cases [`1f7e2f2`](https://github.com/thkruz/ootk/commit/1f7e2f21d6b47f82601565096c13583aa05b3eac)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`8c40159`](https://github.com/thkruz/ootk/commit/8c40159c002de5aa3fcd387d24626a7a9ec8b67c)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`b8addb6`](https://github.com/thkruz/ootk/commit/b8addb66ab3be630ea774def85a8d6dccdbdb085)
- refactor: :recycle: clean up exports in index.ts [`b1cae93`](https://github.com/thkruz/ootk/commit/b1cae93f0617e9db4af2dada989629de52aeb8a1)
- fix: :bug: correct maneuver filtering logic in propagator [`269afd8`](https://github.com/thkruz/ootk/commit/269afd80cc92cfa8b5639d13cd126cd2a9ebf367)
- build: :wrench: add madge configuration for circular dependency detection [`4432c75`](https://github.com/thkruz/ootk/commit/4432c75a4caa1d5afee3d458a144963e0314db38)
- feat(TleParams): :sparkles: add additional satellite parameters [`2734276`](https://github.com/thkruz/ootk/commit/27342760b13e97382ae090d8450733c539df09b4)
- chore(ci): :wrench: add Node 18 to test matrix [`5ad6593`](https://github.com/thkruz/ootk/commit/5ad65937b4f929233ca1b52dd427f0b9c1a611a0)
- build: :package: add madge, vitest and integration test scripts [`7f9fafa`](https://github.com/thkruz/ootk/commit/7f9fafac8b9fc629c1103366228ebb3c57997800)
- feat: :sparkles: Integrate astronomy-engine for star position [`51656b8`](https://github.com/thkruz/ootk/commit/51656b8ab91cef6fc65b9e3009c861d7e8779e54)
- refactor(conjunction): :sparkles: remove file extensions from imports [`b056e72`](https://github.com/thkruz/ootk/commit/b056e7213adeffe53d33618545d48aaf09701b07)
- fix: :bug: resolve circular dependencies in operations module [`68d23ad`](https://github.com/thkruz/ootk/commit/68d23ad94f4f3f9036df321d6306a847b7d58b24)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from exports [`aa83689`](https://github.com/thkruz/ootk/commit/aa836891c3a669850848b2136ddd9fd390b34308)
- fix: :bug: initialize Float64Arrays with coeffs length [`03458d4`](https://github.com/thkruz/ootk/commit/03458d49a847659957fe43e1b1be46737ae5510c)
- refactor: :recycle: rename astronomicalUnit to KM_PER_AU and update usages in Sun & SolarRadiationPressure [`b03abb4`](https://github.com/thkruz/ootk/commit/b03abb49b0db885cba0b1e7859172090d0e50cf6)
- feat(Satellite): :sparkles: add fromOmm method for satellite creation [`a8f46fe`](https://github.com/thkruz/ootk/commit/a8f46fe7864bfc9a97e0a00656eb3f2534920ea2)
- chore(build): :wrench: bundle astronomy-engine and add CJS output [`f853673`](https://github.com/thkruz/ootk/commit/f8536730f6987faf8af1d79470b3a8bd0d267de6)
- test(create-sample-covariance-from-tle): :white_check_mark: add test for realistic covariance creation [`f8461b9`](https://github.com/thkruz/ootk/commit/f8461b9a4417c1741d116eca0a76f45d12677486)
- fix(sgp4): :bug: handle decayed satellites in Sgp4 class [`ad58b63`](https://github.com/thkruz/ootk/commit/ad58b6322dcfe9567ce17440f71669b87ef36904)
- test(probability): :white_check_mark: adjust relative velocity and position for encounter plane [`8c27236`](https://github.com/thkruz/ootk/commit/8c2723666e0f1c69ca5fa6d3d3affe48da18cc0f)
- refactor: :recycle: Correct export test for CelestialBody [`dcd353f`](https://github.com/thkruz/ootk/commit/dcd353f1fa2122c1e8efa6381d2df4ad22fc7827)
- refactor(GaussIOD): reorganize import statements for better clarity [`e280ebf`](https://github.com/thkruz/ootk/commit/e280ebf2de38ad967997a55153c9568c6ed3fc89)
- test(FormatTle): :white_check_mark: update test expectations for new TLE formatting [`bcb907b`](https://github.com/thkruz/ootk/commit/bcb907b64ad11c8c81d0cc26d1219ceac022c4bb)
- feat(optimize): :sparkles: add index file to export optimization modules [`bd14b0b`](https://github.com/thkruz/ootk/commit/bd14b0bf58e965767d0563e07c29df9897513a3a)
- refactor(functions): :sparkles: optimize log10, array2d, and distance calculations [`0416ea7`](https://github.com/thkruz/ootk/commit/0416ea7a18dc36faed17fc59cb4ae9d67100ee99)
- chore(ootk): bump @typescript-eslint/eslint-plugin & parser to ^8.46.2 and refresh package-lock.json [`a06b0e1`](https://github.com/thkruz/ootk/commit/a06b0e1a29b7aa5394e9be108eb85eccf98629f4)
- fix(Tle): :bug: handle '0' as valid BSTAR symbol [`6cda026`](https://github.com/thkruz/ootk/commit/6cda026fd74c99d6b2d2f4538b2037e0e8bf2667)
- refactor: :recycle: update tsconfig to exclude test files [`c245aab`](https://github.com/thkruz/ootk/commit/c245aab7776ad1d0141551f96e4b8e3779875c75)
- fix(ootk): add missing SpaceObjectType string mappings for terrestrial/gas/ice/dwarf planets and moon [`803fd3e`](https://github.com/thkruz/ootk/commit/803fd3e6fe68c636072d19a5e2a1e1f2f51e5d18)
- test: :wrench: increase timeout for ConjunctionAssessment high-fidelity tests [`d6a800b`](https://github.com/thkruz/ootk/commit/d6a800b43562e1046b7e3d79f8849d6e4b3759ac)
- chore: :wrench: update .gitignore to include new files [`153db9d`](https://github.com/thkruz/ootk/commit/153db9d6445d2177e3f9b29b41601af4f941f095)
- chore: :wrench: update version to 6.0.0-rc.4 [`67ace98`](https://github.com/thkruz/ootk/commit/67ace987b4501c2f8289b4a89250cd1e288e2c1b)
- refactor(main): :sparkles: remove unnecessary file extensions from exports [`3fb1f57`](https://github.com/thkruz/ootk/commit/3fb1f57cc9d625c4401cea4b95f30c5d90f6e4a5)
- chore(package): update version to 6.0.0-rc.2 [`147846c`](https://github.com/thkruz/ootk/commit/147846c02d322377fb273408a5844426bf0eee82)
- chore(.gitignore): :wrench: add .dev.vars to ignore list [`87f7bdf`](https://github.com/thkruz/ootk/commit/87f7bdfa3a43bc54c7f0a6ed6a7e8caabeef13f6)
- feat(orbit-determination): :sparkles: add maxIter option to SolveOptions [`6c3776d`](https://github.com/thkruz/ootk/commit/6c3776dd110656230e59da8f522f06d0b99b666e)
- chore(package): :wrench: bump version to 6.0.3 [`be31bfa`](https://github.com/thkruz/ootk/commit/be31bfa79a7a431bb53e65400de3cc479f82ff92)
- test(FormatTle): :white_check_mark: fix line 2 expected value for new formatting [`e607f21`](https://github.com/thkruz/ootk/commit/e607f215e430f5efcc0a7e5de5fbf218cdb5b3b2)
- chore(package): :wrench: bump version to 6.0.2 [`9e109d1`](https://github.com/thkruz/ootk/commit/9e109d1edb40d9147c0253ff86424a3323707e9d)
- chore(package): :wrench: bump version to 6.0.1 [`e116431`](https://github.com/thkruz/ootk/commit/e1164313e86d5a22bd2d55a9fbd21bbd405837e6)
- chore(gitignore): :wastebasket: fix path format for propagator accuracy summary file [`ad1976c`](https://github.com/thkruz/ootk/commit/ad1976c97ca82327d5391aff5b455c40bb41e22b)
- chore: :wrench: update repository URL format in package.json [`07e3f69`](https://github.com/thkruz/ootk/commit/07e3f694b9c4085a77b26cc3ea170fd9cd94559e)
- chore: :wrench: update version to 6.0.0-rc.5 in package.json [`8b6ee64`](https://github.com/thkruz/ootk/commit/8b6ee64f26bb82f588a0d88a1bd3c3dd66d00c3b)
- fix: :bug: resolve circular dependency in Earth class [`0737a62`](https://github.com/thkruz/ootk/commit/0737a629f9c054822b49bc25a7c4813114f8542a)
- chore: :wrench: update coveragePathIgnorePatterns in jest config [`a4a045a`](https://github.com/thkruz/ootk/commit/a4a045a0e29c23b870564b3610e5dda18191e836)
- chore: :truck: update import path for transformsData [`8b1d1c5`](https://github.com/thkruz/ootk/commit/8b1d1c5358cd06f86d0cfe077546729d8ce8dc15)
- refactor(orbit-determination): :recycle: move CostFunction import to internal directory [`f41be5c`](https://github.com/thkruz/ootk/commit/f41be5c9c3c6b678b36fd6b3cd9057dbcad6f6dd)
- refactor(conjunction): :sparkles: rename parameter for clarity in initializeCovarianceSamples [`4a1a8e5`](https://github.com/thkruz/ootk/commit/4a1a8e52dfc0e675eb19c51e1e71427c72ba4989)
- chore(package): update version to 6.0.0-rc.3 [`af58805`](https://github.com/thkruz/ootk/commit/af58805776560ce516eac33b635cd418ebbf0cfd)
- test(integration): :white_check_mark: update export snapshot for new OMM exports [`e0c91b6`](https://github.com/thkruz/ootk/commit/e0c91b6a17988ea8e3fb36cb24edd2230bf2b846)
- fix: :bug: export PayloadStatus from types module [`b20e034`](https://github.com/thkruz/ootk/commit/b20e034dcde352fdc8b38b26b1dca059a6684952)
- chore: :wrench: add .npmrc to .gitignore [`5150253`](https://github.com/thkruz/ootk/commit/5150253f086824da703a10f10f28f60810b00fb2)
- test: :wrench: exclude integration tests from Jest [`3216d44`](https://github.com/thkruz/ootk/commit/3216d442acdf888de650088b10a825ef219ed8be)
- refactor: :truck: rename all iod tests to match main files [`0cfcc56`](https://github.com/thkruz/ootk/commit/0cfcc567ab92753fe12ac2ebaa0d7897a5595a03)
- docs: update CHANGELOG (add v5.1.1 entries and reorder v4/v5 sections) [`fbace9b`](https://github.com/thkruz/ootk/commit/fbace9bc62194632cdd81086b9c6420727361994)

#### [v6.0.2](https://github.com/thkruz/ootk/compare/v6.0.1...v6.0.2)

> 13 March 2026 

- feat(FormatTle): :sparkles: enhance TLE generation with new formatting [`c7cc06f`](https://github.com/thkruz/ootk/commit/c7cc06fb7b3470937f43ef79c175a7d07297b961)
- feat(Satellite): :sparkles: update OMM parsing to use Number [`8e5357c`](https://github.com/thkruz/ootk/commit/8e5357c784ad57bf15997af627a6f5ca9536bb87)
- feat(OmmParser): :sparkles: add JSON parsing for CelesTrak OMM [`42587bc`](https://github.com/thkruz/ootk/commit/42587bcbacbef5942f3a6a6bae9cf9d9efa09a8f)
- feat(OmmFormat): :sparkles: update data format to support numeric types [`1a051ff`](https://github.com/thkruz/ootk/commit/1a051ffe7e517adbc895678bc0378dc9530491c9)
- feat(TleParams): :sparkles: add additional satellite parameters [`e3e4ef8`](https://github.com/thkruz/ootk/commit/e3e4ef87c94275e42c13c0beedd390e70a655031)
- chore(package): :wrench: bump version to 6.0.2 [`9573455`](https://github.com/thkruz/ootk/commit/9573455557ac8e0782ad08f7337eb543449016ae)
- test(integration): :white_check_mark: update export snapshot for new OMM exports [`63e06e4`](https://github.com/thkruz/ootk/commit/63e06e42b762aa154a7d37fe31d476484c093db3)

#### [v6.0.1](https://github.com/thkruz/ootk/compare/v6.0.0...v6.0.1)

> 12 March 2026 

- feat(parsers): :sparkles: add OMM parser and types [`253b1c2`](https://github.com/thkruz/ootk/commit/253b1c2208325997b2fa9ef19a79363b36c506fe)
- test(OmmParser): :white_check_mark: add unit tests for OMM parsing [`057a7fd`](https://github.com/thkruz/ootk/commit/057a7fde4925f81dbb1beb2784a83bd8f50eb415)
- test(Tle): :white_check_mark: add tests for meanMoDev1 and bstar parsing [`13ee240`](https://github.com/thkruz/ootk/commit/13ee240644b242123e0780557721d18247ae4ee9)
- chore(gitignore): :wastebasket: update .gitignore to include propagator accuracy summary file [`a87119c`](https://github.com/thkruz/ootk/commit/a87119c2f3624c157abda186c4754cbb81493239)
- feat(Satellite): :sparkles: add fromOmm method for satellite creation [`6dfb390`](https://github.com/thkruz/ootk/commit/6dfb39027b67875ccaf8987da49218f2a17113d6)
- fix(Tle): :bug: handle '0' as valid BSTAR symbol [`7dded61`](https://github.com/thkruz/ootk/commit/7dded6167597678d2a749954f4416b2283008928)
- chore(package): :wrench: bump version to 6.0.1 [`9b88b46`](https://github.com/thkruz/ootk/commit/9b88b461440f250be487e41d75942a528ececa8b)
- chore(gitignore): :wastebasket: fix path format for propagator accuracy summary file [`b8ff3b3`](https://github.com/thkruz/ootk/commit/b8ff3b364329cbcf72f96f1d9560952989151776)

### [v6.0.0](https://github.com/thkruz/ootk/compare/v5.1.1...v6.0.0)

> 29 November 2025 

- docs: add comprehensive advanced features guide [`#41`](https://github.com/thkruz/ootk/pull/41)
- docs: add comprehensive user guide and getting started documentation [`#39`](https://github.com/thkruz/ootk/pull/39)
- feat: add high accuracy conjunction assessment workflow [`#37`](https://github.com/thkruz/ootk/pull/37)
- feat: add comprehensive examples for library features [`#38`](https://github.com/thkruz/ootk/pull/38)
- Lambert Satellite Integration [`#36`](https://github.com/thkruz/ootk/pull/36)
- Development [`#35`](https://github.com/thkruz/ootk/pull/35)
- test: :camera_flash: update snapshots to deal with floating point errors [`9ee23a1`](https://github.com/thkruz/ootk/commit/9ee23a1d10977db13142cea65e4d2405ef3a5573)
- refactor: :recycle: update and modernize body module to use astronomy-engine [`a56c10c`](https://github.com/thkruz/ootk/commit/a56c10cbd7abe03a4c78cad8fc6aa488fef53298)
- feat: :sparkles: Add CDM types and parsing/exporting logic [`85ddedd`](https://github.com/thkruz/ootk/commit/85ddedd2b373b3f27a5657f9e7eee7607e304d41)
- test: :sparkles: add integration tests for core functionality [`f8c380c`](https://github.com/thkruz/ootk/commit/f8c380c36322b4a6bfbe09b36989d2c93bc5b0f5)
- refactor: :recycle: complete phase 1A of objects module refactor [`0f75b33`](https://github.com/thkruz/ootk/commit/0f75b33f603b1e710e63c2084806f415d737c4c1)
- feat: :sparkles: Add communication devices and tests [`e840337`](https://github.com/thkruz/ootk/commit/e840337e90feff225af9243e654802c4981d01e9)
- feat: :sparkles: Add OEM parsing and data structures [`c0967d1`](https://github.com/thkruz/ootk/commit/c0967d1efe1c788dd3628ddf41ad3e3e57a1a8e7)
- feat: :sparkles: add PassiveRFSensor and PhasedArrayRadar classes [`935a778`](https://github.com/thkruz/ootk/commit/935a77826c5bc2033609f2136fd81eaeda84b543)
- test: :rocket: add LambertIOD test suite for orbit determination [`c26343b`](https://github.com/thkruz/ootk/commit/c26343b7cf581568f28ec6d49aefb0e146fd11d7)
- refactor: :recycle: Rename ECF to ECEF in codebase [`0ef09ea`](https://github.com/thkruz/ootk/commit/0ef09ea91930eb5eb235732a3e2069523ed06346)
- Implement tests for GaussIOD and GoodingIOD; refactor ModifiedGoodingIOD and RungeKuttaAdaptive for improved error handling and integration logic [`5da537b`](https://github.com/thkruz/ootk/commit/5da537b9c82cecdfddc4284f805a927ca9cd043b)
- test: :zap: improve test performance [`cd82439`](https://github.com/thkruz/ootk/commit/cd8243917a413aeabe2542657e93b0e595b3c58e)
- feat(ootk): :sparkles: add interpolator, maneuver and orbit-design modules [`dd8e395`](https://github.com/thkruz/ootk/commit/dd8e395a90ce63338b1e97edab863932d998c2dc)
- feat: :sparkles: Add ScheduledContact and tests [`fa11c93`](https://github.com/thkruz/ootk/commit/fa11c93687c2cc0687bd473b21efe699fa9581ec)
- test: :white_check_mark: Add tests for DynamicGroundObject [`e35c4a9`](https://github.com/thkruz/ootk/commit/e35c4a99d997436bf0148999f7cd1e7ab9c357f1)
- test(satellite): :white_check_mark: add unit tests for propagators [`d7ef3b5`](https://github.com/thkruz/ootk/commit/d7ef3b5322e0fe848823fa0b8e0054aac76adcf7)
- test: :sparkles: add comprehensive tests for Levenberg-MarquardtOD [`c9d458a`](https://github.com/thkruz/ootk/commit/c9d458af8f27c587bce68e4108a1f4633e9fa18e)
- docs: add Lambert integration guide and examples [`eb83cf5`](https://github.com/thkruz/ootk/commit/eb83cf50fa19e2115be0577938e4c7594391d10c)
- docs(time): enhance documentation for time classes and conversions [`6dd3c5e`](https://github.com/thkruz/ootk/commit/6dd3c5ead6f431cf6ea1b2c790c2f14fcc012a88)
- feat: :sparkles: Add RepeatGroundTrack and tests [`4541925`](https://github.com/thkruz/ootk/commit/4541925c44d77b0aef1501cba620cfbb759b9cfb)
- chore(ootk): standardize imports/exports, refine base APIs, bump version [`8a6a365`](https://github.com/thkruz/ootk/commit/8a6a3656ce392f3a9663693046097e7b5eacb648)
- test: :white_check_mark: add integration tests for built package [`688f339`](https://github.com/thkruz/ootk/commit/688f339f4881190debee54507edb302ddbce080d)
- refactor: 🔧 rename private methods for consistency and clarity [`34d28e0`](https://github.com/thkruz/ootk/commit/34d28e04a1a8aa54deeeaa2d0cc1e756cc9bd33c)
- feat: :sparkles: add AccessCalculator and AccessWindow types [`32abe79`](https://github.com/thkruz/ootk/commit/32abe795021435356c2a2910e0d7e5894e11ee5d)
- test: :camera_flash: update coordinate module snapshots for Vitest [`5135e7e`](https://github.com/thkruz/ootk/commit/5135e7e36cc0f7c8bd2209e08578b50c9eaaebc3)
- test: :camera_flash: update coordinate module snapshots for Vitest [`c35f910`](https://github.com/thkruz/ootk/commit/c35f910da78215889c22daced8bb1db8f849e12d)
- test: :white_check_mark: add tests for interpolators [`43e9aad`](https://github.com/thkruz/ootk/commit/43e9aadb3593c811518652b2c9a6503431edfa08)
- feat: :sparkles: Add ConstellationGenerator and tests [`c50d16f`](https://github.com/thkruz/ootk/commit/c50d16f5b6fe1c43364a9561abd43c4551894249)
- feat: :sparkles: Add custom error classes for ootk [`79baa37`](https://github.com/thkruz/ootk/commit/79baa377dd288d175c6eaee3769076ca70ea5099)
- feat: :sparkles: add VisualizationHelpers and related types [`278e8bd`](https://github.com/thkruz/ootk/commit/278e8bd513b0f84d83b535f79adcff929badafff)
- docs: :memo: add comprehensive coordinate systems guide [`24bfedd`](https://github.com/thkruz/ootk/commit/24bfedd71c5517cd99f3cb97c2487379d3308c37)
- test: :truck: move tests into __tests__ folders for easier management [`bd907d8`](https://github.com/thkruz/ootk/commit/bd907d80bcf91842cf673bfe1d6fd59cabecfbdd)
- feat: :sparkles: add clone methods for sensor and device classes [`51cbb97`](https://github.com/thkruz/ootk/commit/51cbb977db928a623f3b7741b399443714a42c28)
- feat: :sparkles: add OrbitFinder class for satellite orbits [`448eef9`](https://github.com/thkruz/ootk/commit/448eef9f5dc16aeca45eca6e7c6cc1e3ffdde2c7)
- test(integration): :white_check_mark: add pre-publish integration tests [`f50e22a`](https://github.com/thkruz/ootk/commit/f50e22a6b33213ba9daba13d1e9f196e2261bebe)
- feat: :sparkles: add SunStatus enum for illumination states [`97c188b`](https://github.com/thkruz/ootk/commit/97c188b31679e9f2b5cb904477f085665337a0fd)
- feat: :sparkles: Add HorizonsParser and tests [`d808d1e`](https://github.com/thkruz/ootk/commit/d808d1eaed2fc03d8db4596686a8d7dfec822d42)
- test: :camera_flash: update operations module snapshots for Vitest [`0547cc3`](https://github.com/thkruz/ootk/commit/0547cc3b92c63d64a3efd28c022df2656a8292ed)
- test: :camera_flash: update operations module snapshots for Vitest [`725d6ea`](https://github.com/thkruz/ootk/commit/725d6ea72e12cd6d0a7e1fea7ab9f3f2a100e61b)
- refactor: :recycle: change sensor and object IDs to numbers [`d69137b`](https://github.com/thkruz/ootk/commit/d69137b2e41f4bd204f1fc8ee0a18533449216ea)
- build: :arrow_up: upgrade all dependencies to most current [`fedc88b`](https://github.com/thkruz/ootk/commit/fedc88bdbbe3acd087509e5e33b4d62bbbaf7e05)
- feat(parsers): :sparkles: add OdmExporter and export options [`dc43ffc`](https://github.com/thkruz/ootk/commit/dc43ffc641aac466a2a3700dbd714988df989209)
- test(create-covariance-from-tle): :sparkles: add tests for covariance creation from TLE [`6ace6b2`](https://github.com/thkruz/ootk/commit/6ace6b21197790ce75e067a2243728dd843231cd)
- docs: :memo: update copyright year to 2025-2026 [`0cceb50`](https://github.com/thkruz/ootk/commit/0cceb50c1878f0e04a148da529ae0b5850fd83ab)
- feat(ootk): :satellite: add NASA JPL Horizons client + constants/interfaces; extend SpaceObjectType with planetary/moon types and update tsconfig lib [`76ed1f7`](https://github.com/thkruz/ootk/commit/76ed1f7e05c37cc1cde69887acea2a6153275c4f)
- remove: :fire: delete Horizons API client and constants [`18aed53`](https://github.com/thkruz/ootk/commit/18aed53fa6b114095d20a9c214a66a9f6afc482e)
- test(sgp4): :white_check_mark: add unit tests for Sgp4Propagator functionality [`038c912`](https://github.com/thkruz/ootk/commit/038c9128d705507acbe7638da00fe03464d92539)
- test(propagator): :white_check_mark: add unit tests for MockPropagator and RungeKutta4Propagator [`84aef88`](https://github.com/thkruz/ootk/commit/84aef88855c43960549dc51d45bc10056c3b978c)
- docs(readme): :sparkles: add comprehensive documentation for orbit determination algorithms [`8ed7178`](https://github.com/thkruz/ootk/commit/8ed7178536e3894a96e932a6a9d3c783a30f4097)
- docs(readme): :sparkles: add README for optimize module with examples [`491bbed`](https://github.com/thkruz/ootk/commit/491bbedff9a0a6ec257ad3d7c626de99fa584567)
- docs: :memo: update documentation for coordinate transformations [`b37ba1b`](https://github.com/thkruz/ootk/commit/b37ba1b13adf7269fe90ba242f34f2a6a333af58)
- test: :white_check_mark: add tests for optimization algorithms [`78199f4`](https://github.com/thkruz/ootk/commit/78199f46933af9497340c3d29a4723d8a46cf1d2)
- feat: :sparkles: add history tracking to Satellite class [`5ab6b1e`](https://github.com/thkruz/ootk/commit/5ab6b1e2bb0d4133e65d7d27c2ec1ba876c9eccc)
- test(kepler): :white_check_mark: add comprehensive tests for KeplerPropagator [`cc61975`](https://github.com/thkruz/ootk/commit/cc61975031e58ed91a38fedfc6f61e45d44b200a)
- feat: :sparkles: make lat, lon, alt properties readonly [`f3ad72c`](https://github.com/thkruz/ootk/commit/f3ad72c9e7a2ed0c831e8f491a146bbf63599952)
- docs(readme): :memo: add detailed documentation for orbital propagators [`6f033f2`](https://github.com/thkruz/ootk/commit/6f033f26caa9d46b09e74310ab656ec320b23a44)
- test: :camera_flash: update observation module snapshots for Vitest [`cc1d7d5`](https://github.com/thkruz/ootk/commit/cc1d7d5869654d7576f9e21452f7ec859d9a16ba)
- test: :camera_flash: update observation module snapshots for Vitest [`26e205b`](https://github.com/thkruz/ootk/commit/26e205bac9152eaa0a4fe019bb4ab10ce3166018)
- feat: :sparkles: implement RAE methods in SpaceObject class [`2f00d20`](https://github.com/thkruz/ootk/commit/2f00d20109d3cae549bf1c2d8e12a922da1ebe5d)
- refactor(simplex): :recycle: move SimplexEntry to internal directory [`0680b95`](https://github.com/thkruz/ootk/commit/0680b951724845c032030b26baa0136329f11474)
- refactor(smoothing): :recycle: convert ExponentialSmoothing class to functions [`e0c978b`](https://github.com/thkruz/ootk/commit/e0c978b6c38811a8b8675bafb54c06ef0725b349)
- test: :white_check_mark: add tests for Hill class methods [`475acc3`](https://github.com/thkruz/ootk/commit/475acc3334dbba4717d7f250d4fffff3e3c14a65)
- docs(golden-section): :memo: enhance documentation and examples for optimizer [`b627eaf`](https://github.com/thkruz/ootk/commit/b627eaf6fa6a00ceceb3b28d10756cbf3498a383)
- test: :camera_flash: update time module snapshots for Vitest [`1f427ff`](https://github.com/thkruz/ootk/commit/1f427ff3b6d082bdc9bdf0d9e72e550e02ef804d)
- feat: :sparkles: add validation errors for sensor parent checks [`824c8bf`](https://github.com/thkruz/ootk/commit/824c8bf41348ccdd68928301de0e5bc350721058)
- test: :camera_flash: update time module snapshots for Vitest [`aa0313b`](https://github.com/thkruz/ootk/commit/aa0313ba8264a3864abe439d8df4180841d03e95)
- feat: :sparkles: enhance visibility checks for Transmitter [`1701853`](https://github.com/thkruz/ootk/commit/1701853a8ec4f0cf26ae6432ec7134f6b1b8ec98)
- feat: :sparkles: add history tracking and cloning options [`261dc52`](https://github.com/thkruz/ootk/commit/261dc52c98dd18c9c2a598a327c51e14f5feb84d)
- refactor: :recycle: replace EciVec3 with TemeVec3 types [`00e3af3`](https://github.com/thkruz/ootk/commit/00e3af33ddcbdebf57c3b771c9ae1af649e3b190)
- refactor: :recycle: streamline imports and enhance AccessWindow [`6a71aec`](https://github.com/thkruz/ootk/commit/6a71aec8504b9f797cfe7a1f5c1afc80f00ee6d2)
- refactor(polynomial-regression): :recycle: move PolynomicalRegressionResult to internal directory [`c6a7fd5`](https://github.com/thkruz/ootk/commit/c6a7fd5eb88b4b0b05113ecc33ee017399ddcc3e)
- docs: :memo: add examples for SunBody, Satellite, and Sensor [`f4a1c9e`](https://github.com/thkruz/ootk/commit/f4a1c9e0681b34e8f8d409a15bd2d0bd390ef2e4)
- docs(simple-linear-regression): :memo: enhance class documentation and examples [`23ce52f`](https://github.com/thkruz/ootk/commit/23ce52f1ab650db9654f4faae254fbe6ad9215d6)
- docs(polynomial-regression): :memo: enhance documentation and examples for optimizer [`9f8c019`](https://github.com/thkruz/ootk/commit/9f8c019666aea11e1e2a2f63343142f67ba727ec)
- build: :building_construction: migrate to tsup for ESM builds [`5b505cd`](https://github.com/thkruz/ootk/commit/5b505cd15c1218b45d8072fcae42de2f95732da9)
- refactor(objects): :recycle: remove PropagatorType from ObjectTypes [`98d4d8f`](https://github.com/thkruz/ootk/commit/98d4d8ff5ae42e48be4e369a77ba34e95a0e6dd5)
- test: :white_check_mark: migrate test files from Jest to Vitest [`3bdcf24`](https://github.com/thkruz/ootk/commit/3bdcf24f746833a03aa8acc076e080babe8aaa7c)
- test: :truck: move tests into __tests__ folders for easier management [`507cb3d`](https://github.com/thkruz/ootk/commit/507cb3d2a2081c538506568ede11e98707836de8)
- refactor: :recycle: update SpaceObject to use TEME frame [`1b046f9`](https://github.com/thkruz/ootk/commit/1b046f9b9ddb030f38758f1ca7de1c92fa07365c)
- refactor(orbit_determination): improve GoodingIOD and ModifiedGoodingIOD structure [`993a790`](https://github.com/thkruz/ootk/commit/993a79065cabb4b8b562b4bf0c45436b25265d3a)
- build: :wrench: migrate from Jest to Vitest [`4138c43`](https://github.com/thkruz/ootk/commit/4138c4380bcd6c97bfeafe66078551f8eb3f8111)
- test: :white_check_mark: add tests for ephemerisManeuver [`3b8e24f`](https://github.com/thkruz/ootk/commit/3b8e24ff9916bdb1a7ff04a3baa1986ae80d2a75)
- feat: :sparkles: add angle calculations for satellites and Sun [`5d2fc8a`](https://github.com/thkruz/ootk/commit/5d2fc8affc7af755c377638e835e2aede6289dde)
- chore(gitignore): :sparkles: add CLAUDE.md to .gitignore [`3b32de8`](https://github.com/thkruz/ootk/commit/3b32de845f568b88893d4cc2db6a5d2740a9829f)
- build: :wrench: add ESM import path fixer for dist output [`07be71c`](https://github.com/thkruz/ootk/commit/07be71c7b14140bb8f93a364afe63f0111ce2596)
- test: :white_check_mark: add tests for ModifiedGoodingIOD [`3795c53`](https://github.com/thkruz/ootk/commit/3795c531c4fe4f968eb64fa3d0d959bfcbc79799)
- refactor(conjunction): :recylce: update ConjunctionEvent constructor to use params object [`284dc02`](https://github.com/thkruz/ootk/commit/284dc02b6573ef7be66fa9721c47539d3bb5dfe7)
- test: :white_check_mark: add integration test infrastructure with Vitest [`0431ecc`](https://github.com/thkruz/ootk/commit/0431eccd2c9b19b4724ba8dc816d0397aae7a1d6)
- test: :camera_flash: update utils module snapshots for Vitest [`76daf1e`](https://github.com/thkruz/ootk/commit/76daf1ea2c9d1a8e5801cb35e6e7cf675d1d4a0d)
- test: :white_check_mark: add unit tests for conversions [`ec789f4`](https://github.com/thkruz/ootk/commit/ec789f4b9e786559b3807afdf8fda6f7a28fdc23)
- feat: :sparkles: add interpolator and maneuver modules [`6f94279`](https://github.com/thkruz/ootk/commit/6f94279d25a2f17c7743e990f5ac62110af8707d)
- style: :art: fix indentation and license header in source files [`d43bdb7`](https://github.com/thkruz/ootk/commit/d43bdb70b7df5b911c623739da4aa319dc3168d8)
- test: :camera_flash: update utils module snapshots for Vitest [`f7930db`](https://github.com/thkruz/ootk/commit/f7930db9a19e6f55fc190fd891572b62a2aa9753)
- refactor(chebyshev): :recycle: improve documentation and method naming [`007d17e`](https://github.com/thkruz/ootk/commit/007d17e271119593b21292bf3fc1a3a0efdd6899)
- test(propagator): :white_check_mark: add SP3 accuracy comparison results [`d06617c`](https://github.com/thkruz/ootk/commit/d06617ce6b5311b720a55c157ee261ec30a0197b)
- docs: :memo: update documentation [`fa530aa`](https://github.com/thkruz/ootk/commit/fa530aaec393a40b518549ef2bbd1b234c8c60e6)
- refactor(conjunction): :sparkles: reorganize imports and improve covariance handling [`e1a0d28`](https://github.com/thkruz/ootk/commit/e1a0d28e5cdeb9253d35fe559658b21f73c8bc5b)
- feat(numerical-propagator): :sparkles: add NumericalPropagatorOptions interface [`5723c02`](https://github.com/thkruz/ootk/commit/5723c020791f1bec0e920e088ac106f84d7b4854)
- test: :camera_flash: update transforms module snapshots for Vitest [`16ac8a4`](https://github.com/thkruz/ootk/commit/16ac8a4cc616d0e9469e4d135913a6ba378f2a24)
- test: :camera_flash: update transforms module snapshots for Vitest [`bf3fecb`](https://github.com/thkruz/ootk/commit/bf3fecbe021bc2502acf1859ea49945f0b9afb2d)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from imports [`04efea0`](https://github.com/thkruz/ootk/commit/04efea0bf93c96d4239367553488bca90c11755e)
- refactor(downhill-simplex): :recycle: improve method naming and documentation [`acfb462`](https://github.com/thkruz/ootk/commit/acfb4621fe29816a5a3baeb06351050a7494ad3d)
- refactor: :recycle: update sensor imports and exports [`33d40e4`](https://github.com/thkruz/ootk/commit/33d40e4c5b0469d5422d8953060b7ffec4e63ae2)
- ci: :construction_worker: add circular-check and integration test jobs [`bf9fa35`](https://github.com/thkruz/ootk/commit/bf9fa3502a321828233437bdf772fd4cdb98fc5e)
- test: :camera_flash: update body module snapshots for Vitest [`b3ff8e4`](https://github.com/thkruz/ootk/commit/b3ff8e402ffb000f8ae94ff77cc58a2d23c9e73c)
- test: :camera_flash: update body module snapshots for Vitest [`7589ca4`](https://github.com/thkruz/ootk/commit/7589ca487eab7294121ddcddd2f2e307ed43d6f2)
- feat(enums): :sparkles: add PropagatorType enum with implementations [`20fd9f6`](https://github.com/thkruz/ootk/commit/20fd9f6230639d702124fdc8c087fbdb5c8b800e)
- feat: :sparkles: add fromPosVel method for RIC coordinates [`93b0e68`](https://github.com/thkruz/ootk/commit/93b0e68907f3f225f3a20977ffabcbab6af345b6)
- refactor: :recycle: simplify imports in multiple files [`cf97616`](https://github.com/thkruz/ootk/commit/cf97616e967f16e7e351abe8396023d960d9af3e)
- test(body): update Moon snapshots for getMoonTimes (including timezone adjustment) and rae [`7612eca`](https://github.com/thkruz/ootk/commit/7612eca02a77dc5d53ddb56a2e5def4c6383cab5)
- fix: :bug: resolve circular dependency in types.ts [`9b9dc88`](https://github.com/thkruz/ootk/commit/9b9dc88012a2efb2d32458bf8d2ac63797f45a81)
- feat: :sparkles: add additional star parameters to interface [`6bf1f21`](https://github.com/thkruz/ootk/commit/6bf1f215557efd5ec49bfcf3e085dba3b572541e)
- feat: :sparkles: add PayloadStatus type [`e691a5d`](https://github.com/thkruz/ootk/commit/e691a5db862cb9141a07a38d29ab8e5e0b7bf203)
- fix: :bug: replace @src/ path alias with relative imports [`3169ba5`](https://github.com/thkruz/ootk/commit/3169ba5cf62cc2f78e6baac5571f570ae38ea476)
- refactor: :recycle: Update sun position methods in force classes [`13dc9c0`](https://github.com/thkruz/ootk/commit/13dc9c02925a231ac724694cec8517951369a34d)
- fix(package): :bug: fix license typo and configure dual ESM/CJS exports [`ba956a8`](https://github.com/thkruz/ootk/commit/ba956a80b5370d724ce0582ab8794d79cff03fc6)
- test: :sparkles: add tests for factorial function with edge cases [`aec8e93`](https://github.com/thkruz/ootk/commit/aec8e9333fc6ca9b300afb3ee6f7861b9d0961ef)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`9bce358`](https://github.com/thkruz/ootk/commit/9bce3588b48cf3d8ed420574ab9fdf5bfa8c1b91)
- test: :camera_flash: update sgp4 module snapshots for Vitest [`af2b4e2`](https://github.com/thkruz/ootk/commit/af2b4e2fa7cb80a11a2bd1ec0ed63ec23b48a954)
- refactor: :recycle: clean up exports in index.ts [`ee556b2`](https://github.com/thkruz/ootk/commit/ee556b2cd8fb60d818f73c8e6e6c0d913b273cc4)
- fix: :bug: correct maneuver filtering logic in propagator [`6dd0d1a`](https://github.com/thkruz/ootk/commit/6dd0d1ab2c7d9c8a36877ed0d729e5269175ef96)
- build: :wrench: add madge configuration for circular dependency detection [`c164f92`](https://github.com/thkruz/ootk/commit/c164f9206ea499ededeadcc0062850a262204c24)
- chore(ci): :wrench: add Node 18 to test matrix [`a851aec`](https://github.com/thkruz/ootk/commit/a851aecad7be4df3f5aa1daf96533c29079522c3)
- build: :package: add madge, vitest and integration test scripts [`5b93c82`](https://github.com/thkruz/ootk/commit/5b93c82a9860f2ca13efd4de667f47ef5d210eb1)
- feat: :sparkles: Integrate astronomy-engine for star position [`b8f940a`](https://github.com/thkruz/ootk/commit/b8f940aed765a5ba755eb126e20f08c09ad46d54)
- refactor(conjunction): :sparkles: remove file extensions from imports [`4df0ad8`](https://github.com/thkruz/ootk/commit/4df0ad88e1b826cdae50fcbbec7c66ca49ad6bd8)
- fix: :bug: resolve circular dependencies in operations module [`bffe544`](https://github.com/thkruz/ootk/commit/bffe544c757cda090fbc9f02d13d09ea085dbca0)
- refactor(conjunction): :sparkles: remove unnecessary file extensions from exports [`2f1856b`](https://github.com/thkruz/ootk/commit/2f1856bbf012fc0c99d6f79569ff2f553a396e0c)
- fix: :bug: initialize Float64Arrays with coeffs length [`66565ce`](https://github.com/thkruz/ootk/commit/66565ce96e9e863c89e499eaab1f95aa73897e9c)
- refactor: :recycle: rename astronomicalUnit to KM_PER_AU and update usages in Sun & SolarRadiationPressure [`6bc4943`](https://github.com/thkruz/ootk/commit/6bc494365e8302c92b681456a0a22b090f8edf2b)
- chore(build): :wrench: bundle astronomy-engine and add CJS output [`1ed5e98`](https://github.com/thkruz/ootk/commit/1ed5e98fcdff33228e06a00016a6f292863695d3)
- test(create-sample-covariance-from-tle): :white_check_mark: add test for realistic covariance creation [`8e7806e`](https://github.com/thkruz/ootk/commit/8e7806e24e0b5594c1b8fa7a633d4515d2d2b67f)
- fix(sgp4): :bug: handle decayed satellites in Sgp4 class [`c4b985a`](https://github.com/thkruz/ootk/commit/c4b985af00f74ec04bb8ccd1c8168384d28b011d)
- test(probability): :white_check_mark: adjust relative velocity and position for encounter plane [`9e112b0`](https://github.com/thkruz/ootk/commit/9e112b05d9570e876c661a914c6e22b194076adc)
- refactor: :recycle: Correct export test for CelestialBody [`ceb0c58`](https://github.com/thkruz/ootk/commit/ceb0c58af29369d10485ff2a4db9d98d1a1aa685)
- refactor(GaussIOD): reorganize import statements for better clarity [`842b458`](https://github.com/thkruz/ootk/commit/842b458b309cfbc78eafb162359b4a8d2c499cc9)
- feat(optimize): :sparkles: add index file to export optimization modules [`64485c2`](https://github.com/thkruz/ootk/commit/64485c2a6e2a5e3b60c9f1ba1c16174e6c7bcccf)
- refactor(functions): :sparkles: optimize log10, array2d, and distance calculations [`0c4dc65`](https://github.com/thkruz/ootk/commit/0c4dc6540d5e6d534933705c6a8a70fe3d2b8566)
- chore(ootk): bump @typescript-eslint/eslint-plugin & parser to ^8.46.2 and refresh package-lock.json [`e340ccc`](https://github.com/thkruz/ootk/commit/e340ccc84207b744e0ef1623c6f1a542fd07b5d8)
- refactor: :recycle: update tsconfig to exclude test files [`4b06dad`](https://github.com/thkruz/ootk/commit/4b06dad3133435a60562d61b22c1bf7e03776d4c)
- fix(ootk): add missing SpaceObjectType string mappings for terrestrial/gas/ice/dwarf planets and moon [`9b49f2f`](https://github.com/thkruz/ootk/commit/9b49f2f09862d4fa9bc324c913f61dea22698873)
- test: :wrench: increase timeout for ConjunctionAssessment high-fidelity tests [`7e1e498`](https://github.com/thkruz/ootk/commit/7e1e4989c2ca8a9f84cba199fc7d67c691f3bd0a)
- chore: :wrench: update .gitignore to include new files [`d8a565a`](https://github.com/thkruz/ootk/commit/d8a565a8fb9ee4e21d6a28ba92f004ac5ac6a9a1)
- chore: :wrench: update version to 6.0.0-rc.4 [`ae88268`](https://github.com/thkruz/ootk/commit/ae8826827e56168b90c162b1ef9cd86a01202e08)
- refactor(main): :sparkles: remove unnecessary file extensions from exports [`6467bfa`](https://github.com/thkruz/ootk/commit/6467bfa913cf13ce0a1e7e8573ba3efc913e58f8)
- chore(package): update version to 6.0.0-rc.2 [`6316048`](https://github.com/thkruz/ootk/commit/63160480d8c06913fa50cd5f78e9811ba530cf56)
- chore(.gitignore): :wrench: add .dev.vars to ignore list [`355e740`](https://github.com/thkruz/ootk/commit/355e740a6179e78e267cbbd16527b2e4bb86a51c)
- feat(orbit-determination): :sparkles: add maxIter option to SolveOptions [`2571b7b`](https://github.com/thkruz/ootk/commit/2571b7bceabfe3b9c7584bbf54ae4e217093bf77)
- chore: :wrench: update repository URL format in package.json [`d38f1c5`](https://github.com/thkruz/ootk/commit/d38f1c5328d75f6b7044adf301ea42bb9d5d15d6)
- chore: :wrench: update version to 6.0.0-rc.5 in package.json [`52c65a2`](https://github.com/thkruz/ootk/commit/52c65a2b0ec901f915fc91ea104ac4b92e73426b)
- fix: :bug: resolve circular dependency in Earth class [`be38190`](https://github.com/thkruz/ootk/commit/be38190bf6b1cd58953b725760d6d3dbeebe891a)
- chore: :wrench: update coveragePathIgnorePatterns in jest config [`c275e6b`](https://github.com/thkruz/ootk/commit/c275e6b74b8aee1d18e1f44097051180e1a59299)
- chore: :truck: update import path for transformsData [`b022166`](https://github.com/thkruz/ootk/commit/b0221668108cac5cf0372687d7044a91a21bbcda)
- refactor(orbit-determination): :recycle: move CostFunction import to internal directory [`a3e00b1`](https://github.com/thkruz/ootk/commit/a3e00b11ae2d301b9ef8e89a832661ca432821be)
- refactor(conjunction): :sparkles: rename parameter for clarity in initializeCovarianceSamples [`50e2da8`](https://github.com/thkruz/ootk/commit/50e2da8fd1f7996c7fffb9d28beff33da2fb0a0a)
- chore(package): update version to 6.0.0-rc.3 [`02aa5b3`](https://github.com/thkruz/ootk/commit/02aa5b39cbd7570f9c494ab0d4b85b1312c7818f)
- fix: :bug: export PayloadStatus from types module [`247323a`](https://github.com/thkruz/ootk/commit/247323aefb79bbf613993502275c3130ad54d049)
- chore: :wrench: add .npmrc to .gitignore [`6b4dfe7`](https://github.com/thkruz/ootk/commit/6b4dfe7f40d5c07d1cbcc9f848dd4255f2fa2fbf)
- test: :wrench: exclude integration tests from Jest [`08fc0ed`](https://github.com/thkruz/ootk/commit/08fc0edd53494a6a176d810dac62fe73c781fd19)
- refactor: :truck: rename all iod tests to match main files [`9272b24`](https://github.com/thkruz/ootk/commit/9272b24fc983c132b850607880aa770789091f19)
- docs: update CHANGELOG (add v5.1.1 entries and reorder v4/v5 sections) [`e4a0574`](https://github.com/thkruz/ootk/commit/e4a057462d523a7eb40fff5fc6eaecb231ec15bf)

#### [v5.1.1](https://github.com/thkruz/ootk/compare/v5.1.0...v5.1.1)

> 23 October 2025 

- Development [`#33`](https://github.com/thkruz/ootk/pull/33)
- Version 5 [`#32`](https://github.com/thkruz/ootk/pull/32)
- Develop [`#29`](https://github.com/thkruz/ootk/pull/29)
- Version 4.0.0 [`#24`](https://github.com/thkruz/ootk/pull/24)
- Delete LICENSE [`#25`](https://github.com/thkruz/ootk/pull/25)
- Develop [`#23`](https://github.com/thkruz/ootk/pull/23)
- chore: remove @thkruz handle from file headers; tidy imports/exports and minor formatting [`be21d87`](https://github.com/thkruz/ootk/commit/be21d87f58867b2cdb119502c25b6ae2b71d0940)
- fix: :memo: fix outdated documentation [`0f6c26f`](https://github.com/thkruz/ootk/commit/0f6c26f40edaa5d8fe275b8aa967e5a00188beca)
- Update LICENSE for v4.0.0 [`f9514a0`](https://github.com/thkruz/ootk/commit/f9514a07c4ddbe0f9d8df8679b5c6169d719419a)
- fix: :bug: treat m === 0 as valid by checking explicit null before propagation [`226f0e7`](https://github.com/thkruz/ootk/commit/226f0e7420d79e006a340ff490a3e80c44c457d8)

#### [v5.1.0](https://github.com/thkruz/ootk/compare/v5.0.0...v5.1.0)

> 26 April 2025 

- docs: :page_facing_up: transfer more license to Kruczek Labs LLC [`34178fc`](https://github.com/thkruz/ootk/commit/34178fc90ec6968e6eacb8d7475ddd453df5e540)
- refactor: :recycle: improve naming consistency [`1405f62`](https://github.com/thkruz/ootk/commit/1405f62b8bbf824f8c0f41f5eec6b2d1a2513b36)
- feat: :sparkles: add covariance ellipsoid calculations [`26cdcac`](https://github.com/thkruz/ootk/commit/26cdcac13f5ebfb805ee2760ccd76801e43f96c0)
- docs: :page_facing_up: transfer license to Kruczek Labs LLC [`bdb1494`](https://github.com/thkruz/ootk/commit/bdb14941a52d1c2402f7149408a235fd226c519e)
- refactor: :label: remove unnecessary type assertions [`c1230fb`](https://github.com/thkruz/ootk/commit/c1230fb474c71853928173df711bbbca0866d990)
- docs: :page_facing_up: transfer more license to Kruczek Labs LLC [`65de7fb`](https://github.com/thkruz/ootk/commit/65de7fbeca6827c77a4b5f9e85cd2e300d650219)
- refactor: :label: remove unnecessary type assertions [`e23c679`](https://github.com/thkruz/ootk/commit/e23c679ab6d025511b8783db81724133e3e778d6)
- docs: :page_facing_up: transfer more license to Kruczek Labs LLC [`a9c5d84`](https://github.com/thkruz/ootk/commit/a9c5d84269cdca87006cfec882f50a14ca2f5070)
- refactor: :recycle: improve naming consistency [`f51025b`](https://github.com/thkruz/ootk/commit/f51025be13ed5c938aa331e2cbbe7413c32ad224)
- build: :label: add strict null checks [`82e0761`](https://github.com/thkruz/ootk/commit/82e07616b198f2084b7d7e5d3993e9bd12407a91)
- refactor: :label: remove unnecessary type assertions [`6de14db`](https://github.com/thkruz/ootk/commit/6de14db719910ca5d6b9c241a16c9db59a0921de)
- test: :adhesive_bandage: fix broken tests [`df737f2`](https://github.com/thkruz/ootk/commit/df737f2d47cac43f9056f9c9d0d596daf9080741)
- docs: :memo: update README [`0494f3e`](https://github.com/thkruz/ootk/commit/0494f3e3d455b18ebf105c3becc6ef846b2f9869)
- test: :white_check_mark: fix test [`e533d26`](https://github.com/thkruz/ootk/commit/e533d26442784872bf118c74582d07fff9d3aae9)
- refactor: :label: remove unnecessary type assertions [`7e6b78b`](https://github.com/thkruz/ootk/commit/7e6b78b307aabecf36805919d68c67cb705cde19)
- refactor: :label: remove unnecessary type assertions [`3240407`](https://github.com/thkruz/ootk/commit/3240407d6f21c768da83eaebafcfe6c4df1b7c7b)
- docs: :bookmark: bump version [`ae02a3d`](https://github.com/thkruz/ootk/commit/ae02a3da4b5e6d2767e067c8793d3a097e5f021b)
- refactor: :rotating_light: fix linter issue with line length [`540f8ac`](https://github.com/thkruz/ootk/commit/540f8acdab910df70a3031f7ef3036aeab905ac1)
- refactor: :rotating_light: fix linter issue with line length [`822062f`](https://github.com/thkruz/ootk/commit/822062fde22f140ed489c34bc6265a893424da92)
- docs: :memo: make Celestial vs Star more clear [`499bdb2`](https://github.com/thkruz/ootk/commit/499bdb231ba496c58467ddbb99e7ac961f935755)
- chore: :memo: add todo for later [`022525f`](https://github.com/thkruz/ootk/commit/022525ff38feb8070df4039fb29739f0ed005d5a)
- refactor: :coffin: remove old export [`a4371f8`](https://github.com/thkruz/ootk/commit/a4371f8573ed6c7c008732885555f26b379d5e1a)
- docs: :bulb: remove unnecessary todo [`5e7a51e`](https://github.com/thkruz/ootk/commit/5e7a51ef0b9faaa91767b84c802340fdaceee6b8)

### [v5.0.0](https://github.com/thkruz/ootk/compare/v4.0.9...v5.0.0)

> 25 April 2025 

- feat: :sparkles: merge ootk-core back into ootk [`bcbee46`](https://github.com/thkruz/ootk/commit/bcbee4629de3e454bcd888a488bd6d7639f3ac47)

#### [v4.0.9](https://github.com/thkruz/ootk/compare/v4.0.8...v4.0.9)

> 20 March 2025 

- feat: :sparkles: add launchPad to DetailedSatellite [`648c90a`](https://github.com/thkruz/ootk/commit/648c90af9367b023ca59f38590477d680973e3cc)

#### [v4.0.8](https://github.com/thkruz/ootk/compare/v4.0.7...v4.0.8)

> 20 March 2025 

- build: :arrow_up: bump ootk-core [`be33f7f`](https://github.com/thkruz/ootk/commit/be33f7f915d68421bb895ef2a52c91a42996ce03)

#### [v4.0.7](https://github.com/thkruz/ootk/compare/v4.0.6...v4.0.7)

> 20 March 2025 

- build: :lock: fix security issues [`e3ad7c5`](https://github.com/thkruz/ootk/commit/e3ad7c565ea4062e2927ce6d6c3df8e9b94bea5d)

#### [v4.0.6](https://github.com/thkruz/ootk/compare/v4.0.5...v4.0.6)

> 1 March 2025 

- build: :arrow_up: bump ootk-core [`af78108`](https://github.com/thkruz/ootk/commit/af78108d45fbaab4b2c6c853112ffd08ae5cdb0f)

#### [v4.0.5](https://github.com/thkruz/ootk/compare/v4.0.4...v4.0.5)

> 14 January 2025 

- feat: :sparkles: add status parameter to DetailedSatellite class [`3b1b8c2`](https://github.com/thkruz/ootk/commit/3b1b8c2b30bd9c3d14e7ce70067607a8d1366825)

#### [v4.0.4](https://github.com/thkruz/ootk/compare/v4.0.3...v4.0.4)

> 14 January 2025 

- feat: :sparkles: add PayloadStatus enum [`9828703`](https://github.com/thkruz/ootk/commit/9828703c3eef82676a54d06f5ab3adb40f296660)

#### [v4.0.3](https://github.com/thkruz/ootk/compare/v4.0.2...v4.0.3)

> 31 December 2024 

- fix: :arrow_up: bump ootk-core [`2f0ac47`](https://github.com/thkruz/ootk/commit/2f0ac47d4a9ae18ebd58b72b4db98610b20aa267)

#### [v4.0.2](https://github.com/thkruz/ootk/compare/v4.0.1...v4.0.2)

> 3 August 2024 

- fix: :arrow_up: bump ootk-core [`3c87557`](https://github.com/thkruz/ootk/commit/3c875578298b20a3906cf00e45e5bedf55cfa43f)

#### [v4.0.1](https://github.com/thkruz/ootk/compare/v4.0.0...v4.0.1)

> 25 June 2024 

- build: :arrow_up: bump ootk-core [`2ff598e`](https://github.com/thkruz/ootk/commit/2ff598ec309be005a40335b99eb1b232b646f44b)

### [v4.0.0](https://github.com/thkruz/ootk/compare/v3.0.0...v4.0.0)

> 7 January 2024 

- feat: :truck: split ootk-core functions into new library [`d4982be`](https://github.com/thkruz/ootk/commit/d4982be23ec1318f1e2de6a8ecf7f7fa92594069)
- feat: :sparkles: port functions from pious_squid [`69aaf26`](https://github.com/thkruz/ootk/commit/69aaf26d4d8c99912cc5bf0f1c9ad6e0674b15eb)
- feat: :sparkles: integrate ootk-core v1.0.7 [`101eeb6`](https://github.com/thkruz/ootk/commit/101eeb6a21008ce198832818154fa0442691e4ad)
- refactor: :label: update docs and typing [`92e14a1`](https://github.com/thkruz/ootk/commit/92e14a1ea0c708d7bd91d3a25a0da48d73859ed3)
- feat: :sparkles: merge sun calculations [`7f4146e`](https://github.com/thkruz/ootk/commit/7f4146e2d67793806f2f3e6b69183bff65a41b05)
- feat: :sparkles: update transforms [`c6824a4`](https://github.com/thkruz/ootk/commit/c6824a4f22aab24b5e30a5a733e8af4b42d85ae0)
- refactor: :recycle: refactor to match latest ootk-core [`ae37922`](https://github.com/thkruz/ootk/commit/ae3792283571c69ff0d6406188d0c7219215c56f)
- feat: :sparkles: integration with KeepTrack [`a8cc11d`](https://github.com/thkruz/ootk/commit/a8cc11df0b648e99ec10baaff03ba83addc6f47f)
- docs: :page_facing_up: add license to all major files [`8549064`](https://github.com/thkruz/ootk/commit/8549064fe77001e2501f13d67588cbc0dfd490cb)
- fix: :bug: validate against keeptrack [`702307c`](https://github.com/thkruz/ootk/commit/702307c31deb501d1b0ba3d0c656b7406baed80a)
- feat: :sparkles: Add node support [`7d28c3f`](https://github.com/thkruz/ootk/commit/7d28c3f5de0e3e9d2dd13bbf5cdfd5527f6126a8)
- fix: :bug: fix Satellite class [`20bc194`](https://github.com/thkruz/ootk/commit/20bc19434f97e101c7f555774859a970db1cebd7)
- fix: :bug: fix degrees vs radians issues [`6103597`](https://github.com/thkruz/ootk/commit/61035971e037483cc62f01cf08c397085c746694)
- refactor: :recycle: refactor common celestial equations out of sun and moon [`7f65165`](https://github.com/thkruz/ootk/commit/7f6516525b90019b31520525a9d2adf643ad3fd0)
- test: :bug: fix broken tests [`735e480`](https://github.com/thkruz/ootk/commit/735e480627f85f2dfa7de1bcc8ece32032ad5fd5)
- feat: :sparkles: add forces and propagators [`177c88b`](https://github.com/thkruz/ootk/commit/177c88b308760c08e592d409f106cbfe2b0b98ac)
- refactor: :recycle: update RfSensor to allow multiple faces [`179b486`](https://github.com/thkruz/ootk/commit/179b486bbbd9355569414f9ca7ca82aaa374ca93)
- ci: :construction_worker: update github ci/cd pipeline [`670b252`](https://github.com/thkruz/ootk/commit/670b2526669dbb4478499d6587b4dc729c373745)
- docs: :memo: update documentation [`754e2e1`](https://github.com/thkruz/ootk/commit/754e2e183fdb6930a0192b0452137f99f420fd6d)
- fix: :rotating_light: fix linter errors [`195c5eb`](https://github.com/thkruz/ootk/commit/195c5eb8ebfa68221241d7ceabc6522b8f12bd1b)
- refactor: :recycle: reduce complexity [`de70bda`](https://github.com/thkruz/ootk/commit/de70bda0eefb0bb02bf1e55e81781ee81df80358)
- test: :white_check_mark: add more tests [`27ed272`](https://github.com/thkruz/ootk/commit/27ed27265e35d4575b2e2bb12f50ca8b187f0d96)
- fix: :bug: cleanup integration with ootk-core [`227169e`](https://github.com/thkruz/ootk/commit/227169e3f4191a9f3cf3c58c50d645274e8e1120)
- fix: :bug: fix Vimpel TLEs [`6092a4b`](https://github.com/thkruz/ootk/commit/6092a4b411c1092ee75ed6c34eee499cfa3cefef)
- refactor: :recycle: move derivative from ootk-core [`9a9b50d`](https://github.com/thkruz/ootk/commit/9a9b50d4402b24398d920ae4ef0a76a7d19edabf)
- chore: :fire: remove old files [`797007c`](https://github.com/thkruz/ootk/commit/797007c2c0a89e86c90d964e3a6fc699705c31cd)
- chore: :rotating_light: fix minor linter errors [`1682292`](https://github.com/thkruz/ootk/commit/16822921b96a24f477789b19b02a5363a93f94fb)
- fix: :bug: add fix for vite compiler [`c72bd38`](https://github.com/thkruz/ootk/commit/c72bd38df2be1fef82603e85fd687a2e3f67ca83)
- refactor: :recycle: make rfSensor an extension of DetailedSensor [`add7613`](https://github.com/thkruz/ootk/commit/add7613c9cea3ddf56b5da0accef36b8b866b144)
- build: :arrow_up: bump ootk-core [`9ac1464`](https://github.com/thkruz/ootk/commit/9ac1464338284e6169304e44ceecb9c978543203)
- refactor: :recycle: move freqBand from RfSensor to DetailedSensor [`185cc50`](https://github.com/thkruz/ootk/commit/185cc506482c0e0224ff0392e6bb1bad599d54ec)
- refactor: :label: improved type checking [`7e30df4`](https://github.com/thkruz/ootk/commit/7e30df4f2c481b84ee1843c453af4124988bcfea)
- feat: :sparkles: add detailedsatellite cloning [`63aeb77`](https://github.com/thkruz/ootk/commit/63aeb77d3d24071a1d66e5396b27e8c89fe34198)
- refactor: :recycle: update transforms to allow multiple faces [`53c8877`](https://github.com/thkruz/ootk/commit/53c887730d389b06f18889d4f2170a1e4ac82993)
- docs: :package: update package.json [`b49eddc`](https://github.com/thkruz/ootk/commit/b49eddcc60d0635a1a6f3c13e28aa5a2ae2cf4c3)
- fix: :bug: make vmag and rcs nullable [`0750c9a`](https://github.com/thkruz/ootk/commit/0750c9aebee45bf0cba773b7d09ad91b3d29dbd7)
- build: :bug: fix jest dependencies [`96792e9`](https://github.com/thkruz/ootk/commit/96792e9a9d90c08c23bb81e10beefcc083ae658e)
- build: :arrow_up: bump ootk-core [`efc4aa0`](https://github.com/thkruz/ootk/commit/efc4aa0caf7182afd9fbba7e29a50a8defd16ebe)
- fix: :adhesive_bandage: fix import statements [`e923dde`](https://github.com/thkruz/ootk/commit/e923ddefe856711c8216e006dc7463827960900e)
- feat: :sparkles: add new catalog sources [`9dd4160`](https://github.com/thkruz/ootk/commit/9dd41607da91e4daffd8456f795239e945493a2d)
- test: :white_check_mark: fix test config [`5e5a673`](https://github.com/thkruz/ootk/commit/5e5a6730b67a9b4c448ccc970c80b06c446515d8)
- fix: :bug: fix imports [`de5459d`](https://github.com/thkruz/ootk/commit/de5459dd9c69afcd08b3002af87d661ccdb47bde)
- build: :arrow_up: bump ootk-core [`62f40d2`](https://github.com/thkruz/ootk/commit/62f40d2e8fd629b7dfc55b2c40e52e40cf2069aa)
- fix: :arrow_up: bump ootk-core [`edaafb7`](https://github.com/thkruz/ootk/commit/edaafb7ee1092064addd040d438d100f6b84514b)
- build: :arrow_up: bump ootk-core [`f5152ed`](https://github.com/thkruz/ootk/commit/f5152ed69c98f92e354240dfe36589fad81e1fa6)
- fix: :bug: fix issue with vite [`9b540f9`](https://github.com/thkruz/ootk/commit/9b540f9231076ce8670eb2230321b592d0696b99)
- build: :arrow_up: bump ootk-core [`8d15b97`](https://github.com/thkruz/ootk/commit/8d15b972d7a9dd49a6c2e2773509ac23735da476)
- build: :arrow_up: bump ootk-core [`188513f`](https://github.com/thkruz/ootk/commit/188513fabd9a1f621547769b9624c0dfcddee59d)
- build: :arrow_up: bump ootk-core [`c7c5350`](https://github.com/thkruz/ootk/commit/c7c5350d47d20ffb5453ccfcb490164a00b50a9e)
- build: :arrow_up: bump ootk-core [`d19fd5b`](https://github.com/thkruz/ootk/commit/d19fd5b80b7b223a91c56a64b9564350cd9a90d0)
- fix: :bug: fix enum [`009342f`](https://github.com/thkruz/ootk/commit/009342f15e9f03de98e477c3c7ce1ef7534caa2d)
- test: :white_check_mark: update snapshots [`ca95ad6`](https://github.com/thkruz/ootk/commit/ca95ad65be2de3f818390585a7bc1749ca7bf918)
- fix: :bug: fix bug in how alpha 5 was calculated [`c36cd0c`](https://github.com/thkruz/ootk/commit/c36cd0c6899f4858514f69aeff5095692d812d85)
- refactor: :label: update return type [`1e841de`](https://github.com/thkruz/ootk/commit/1e841de543153aa5a0f7de936c8aaf1c03f65580)
- chore: :technologist: remove prettier recommendation [`def01c6`](https://github.com/thkruz/ootk/commit/def01c647b3a09c799b1c2b47c766afed4368ab3)

### [v3.0.0](https://github.com/thkruz/ootk/compare/v2.0.1...v3.0.0)

> 23 July 2023 

- refactor: :recycle: refactor with better typing and _ suffix for private methods [`4b14b64`](https://github.com/thkruz/ootk/commit/4b14b64290ffe71ed8fbaebd20ca16e8abf2ce4e)
- docs: :label: expand documentation of types [`a517a24`](https://github.com/thkruz/ootk/commit/a517a242f4b35d5a5795ce9032d7672219b0bd1f)
- test: :white_check_mark: add more testing to sensor [`2bef00d`](https://github.com/thkruz/ootk/commit/2bef00d172d23de2a8b5aae73ea385880ac58fb2)
- feat: :sparkles: add transforms for radar coordinate systems [`c836753`](https://github.com/thkruz/ootk/commit/c8367533788760ce2189795ac370812d9377a75a)
- test: :construction_worker: update jest and ts configs [`039b195`](https://github.com/thkruz/ootk/commit/039b195b4c63185345936b47fa57937b4ec458e3)
- build: :package: update package scripts and dependencies [`a4efe23`](https://github.com/thkruz/ootk/commit/a4efe2384b53b1c5d6c95e4a6bea2d585048832c)
- build: :construction_worker: update babel config [`f028e5e`](https://github.com/thkruz/ootk/commit/f028e5ee7b839414fd4d785bb6a04e93619afcb6)
- chore: :art: update prettier config [`6a816c9`](https://github.com/thkruz/ootk/commit/6a816c905b1ec250053ff77ea0e2c88d96233836)
- refactor: :green_heart: improve build [`0f4f74c`](https://github.com/thkruz/ootk/commit/0f4f74cc0daa8453317039936a35d9238c6c6a07)
- feat: :hammer: add dev script for opening lcov [`1d034da`](https://github.com/thkruz/ootk/commit/1d034daa28b713370855482c6a75317921fe6550)
- chore: :rotating_light: update eslint config [`b90e585`](https://github.com/thkruz/ootk/commit/b90e58529144fb34db52a0b085cd2dbc9369d6d1)
- feat: :label: use generics [`2c3a843`](https://github.com/thkruz/ootk/commit/2c3a8435cd14eb43d2ff5ac430b85a516b899b66)
- refactor: :fire: remove assemblyscript references [`9c5a87d`](https://github.com/thkruz/ootk/commit/9c5a87d2455d06f0d36b87ecd31aa644e1d7ab62)

#### [v2.0.1](https://github.com/thkruz/ootk/compare/v2.0.0...v2.0.1)

> 16 May 2023 

- fix: :label: fix incorrect units [`d790d63`](https://github.com/thkruz/ootk/commit/d790d63f3502f9a5b0c793f88ff7cc48d252717d)
- refactor: :rotating_light: hide wasm work [`a372498`](https://github.com/thkruz/ootk/commit/a372498ea1861edf046eee488149b1cfdb2761ac)

### [v2.0.0](https://github.com/thkruz/ootk/compare/v1.8.1...v2.0.0)

> 16 May 2023 

- fix: :label: add strict typing for units [`ff98aa0`](https://github.com/thkruz/ootk/commit/ff98aa09158e2da75ab2f2942639f18f09de21aa)
- feat: :sparkles: add new functions to the sat object [`475df09`](https://github.com/thkruz/ootk/commit/475df09182a09c94497261c35f7904f5810cd2a9)
- fix: :label: mark parameters optional per @weedgrease suggestion [`48cb0de`](https://github.com/thkruz/ootk/commit/48cb0dea834229ec56155d4f2e69ef1c87ed908e)
- refactor: :lock: update dependencies [`a0ce1d5`](https://github.com/thkruz/ootk/commit/a0ce1d5ff296fb3aa728277cd2fee47a355fd250)
- fix: :bug: fix rng vs range usage [`a9917c3`](https://github.com/thkruz/ootk/commit/a9917c3d5314332710f5153762b0fd2b1c49c433)
- refactor: :rotating_light: fix linter error on enum [`097e50b`](https://github.com/thkruz/ootk/commit/097e50b85779feb20671e5725c0b6df437694a22)

#### [v1.8.1](https://github.com/thkruz/ootk/compare/v1.8.0...v1.8.1)

> 24 August 2022 

- fix: :ambulance: fix radians vs degrees in sensor.ts [`d69200f`](https://github.com/thkruz/ootk/commit/d69200ff86beb932235f11fa0fbd86f6b9401ecc)

#### [v1.8.0](https://github.com/thkruz/ootk/compare/v1.7.0...v1.8.0)

> 24 August 2022 

- feat: :sparkles: add getDayOfYear functionality [`46ffa20`](https://github.com/thkruz/ootk/commit/46ffa20e22478a2e1780276fe96321c32aa66a85)

#### [v1.7.0](https://github.com/thkruz/ootk/compare/v1.6.4...v1.7.0)

> 23 August 2022 

- feat: :sparkles: add fov functions to sensor [`90d0d2e`](https://github.com/thkruz/ootk/commit/90d0d2ea20d3796f285d680eac8851fc829cc73a)

#### [v1.6.4](https://github.com/thkruz/ootk/compare/v1.6.3...v1.6.4)

> 22 August 2022 

- docs: :label: fix type label for RaeVec3 [`df0d9dd`](https://github.com/thkruz/ootk/commit/df0d9dd577302b0c57f285ce650a77b325314080)

#### [v1.6.3](https://github.com/thkruz/ootk/compare/v1.6.2...v1.6.3)

> 13 February 2021 

- Develop [`#22`](https://github.com/thkruz/ootk/pull/22)
- Develop [`#21`](https://github.com/thkruz/ootk/pull/21)
- Develop [`#20`](https://github.com/thkruz/ootk/pull/20)
- Develop [`#19`](https://github.com/thkruz/ootk/pull/19)
- Develop [`#18`](https://github.com/thkruz/ootk/pull/18)
- Update README.md [`61827e5`](https://github.com/thkruz/ootk/commit/61827e5aa74d761f64ad907bb919ae3922658127)

#### [v1.6.2](https://github.com/thkruz/ootk/compare/v1.6.1...v1.6.2)

> 22 August 2022 

- fix: :pencil2: fix typo in sez2rae [`509bf07`](https://github.com/thkruz/ootk/commit/509bf0754ef4e5e50a4aa4571af178ffd219ba6b)

#### [v1.6.1](https://github.com/thkruz/ootk/compare/v1.6.0...v1.6.1)

> 12 August 2022 

- docs: :memo: update readme with examples [`4434dd7`](https://github.com/thkruz/ootk/commit/4434dd72c9369e71ef07deaed0370071e23743a2)
- fix: :bug: fix sez2rae returning radians not degrees [`429bab4`](https://github.com/thkruz/ootk/commit/429bab41dd75a659614bbfe229bf6e4c72921c41)

#### [v1.6.0](https://github.com/thkruz/ootk/compare/v1.5.5...v1.6.0)

> 12 August 2022 

- test: :camera_flash: add snapshots of correct position/velocity calculations [`bdf6aa5`](https://github.com/thkruz/ootk/commit/bdf6aa59eff77fa7891719c5283c220d2cf83b6c)
- test: :white_check_mark: add test catalog and test creator [`e785e78`](https://github.com/thkruz/ootk/commit/e785e780c9156482aa6eb8a979885ec6f7ad23ac)
- test: :white_check_mark: add full catalog validation tests [`97cb4c1`](https://github.com/thkruz/ootk/commit/97cb4c1caa9933d206b3807da381c0b83c4fa5ae)
- test: :white_check_mark: add testing from sgp4prop [`de1d87f`](https://github.com/thkruz/ootk/commit/de1d87f3ecb687f1be295545381bb8bfdf195bbe)
- chore: :coffin: remove non-public tests [`c1af668`](https://github.com/thkruz/ootk/commit/c1af66821e9058605e003676292ec7d66e33749e)
- refactor: :label: fix types for moon-math.ts [`41bd18c`](https://github.com/thkruz/ootk/commit/41bd18c04fac9dae9f631b1e391b2deef4df258d)
- docs: :test_tube: add example of bad TLEs [`f2bc0b9`](https://github.com/thkruz/ootk/commit/f2bc0b989d04604f0c1252de2e43e99b462458d9)

#### [v1.5.5](https://github.com/thkruz/ootk/compare/v1.5.4...v1.5.5)

> 8 August 2022 

- fix: :pencil2: fix bug with h vs el [`9affaaf`](https://github.com/thkruz/ootk/commit/9affaafcd35b34c5765161966fdeb06e51182c81)

#### [v1.5.4](https://github.com/thkruz/ootk/compare/v1.5.3...v1.5.4)

> 8 August 2022 

- fix: :bug: correct bug in deep space math [`c7ec9ca`](https://github.com/thkruz/ootk/commit/c7ec9ca017b2ebe0ce41af1c9e7934794e19da3e)

#### [v1.5.3](https://github.com/thkruz/ootk/compare/v1.5.2...v1.5.3)

#### [v1.5.2](https://github.com/thkruz/ootk/compare/v1.5.1...v1.5.2)

> 6 August 2022 

- fix: :bug: fix math for getStarAzEl [`0a0ee9a`](https://github.com/thkruz/ootk/commit/0a0ee9a10dfc9a278e20051b71e2dcd625b49e8a)

#### [v1.5.1](https://github.com/thkruz/ootk/compare/v1.5.0...v1.5.1)

> 6 August 2022 

- build: :label: update build script to include all type data [`ce752f9`](https://github.com/thkruz/ootk/commit/ce752f9edb4ebba3ca65588611cb109d990c3270)

#### [v1.5.0](https://github.com/thkruz/ootk/compare/v1.4.0...v1.5.0)

> 29 July 2022 

- fix: :bug: fix issues with jday calculations in Sgp4 [`7ceb301`](https://github.com/thkruz/ootk/commit/7ceb301b2a7c23d9d6439f4f1e1b801dbacd468c)
- fix: :bug: fix bug with timezone differences [`d796c65`](https://github.com/thkruz/ootk/commit/d796c65ad052c975808b05d3d356537405342b71)

#### [v1.4.0](https://github.com/thkruz/ootk/compare/v1.3.1...v1.4.0)

> 28 July 2022 

- feat: :sparkles: [`e83c0fc`](https://github.com/thkruz/ootk/commit/e83c0fc6083e37ddee0beb3668dd0a7469a69dce)

#### [v1.3.1](https://github.com/thkruz/ootk/compare/v1.3.0...v1.3.1)

> 27 July 2022 

- feat: :sparkles: add getSolarTime [`a812450`](https://github.com/thkruz/ootk/commit/a812450d3bc335e168fc9a2a04630a3ae754316d)

#### [v1.3.0](https://github.com/thkruz/ootk/compare/v1.2.0...v1.3.0)

> 27 July 2022 

- feat: :sparkles: add space objects, sunMath, and moonMath [`e7e9fc3`](https://github.com/thkruz/ootk/commit/e7e9fc390f46e1aaedd47595d7fc0ad9e228b6e9)

#### [v1.2.0](https://github.com/thkruz/ootk/compare/v1.1.0...v1.2.0)

> 26 July 2022 

- feat: :sparkles: add Sat class [`281a9c5`](https://github.com/thkruz/ootk/commit/281a9c57ecaf9472cf305eb5f5d3ab8fe5f39e7b)
- docs: :memo: update changelog [`19b70f8`](https://github.com/thkruz/ootk/commit/19b70f80fb0e5c963f47dccbcf0c5d9451133121)

#### [v1.1.0](https://github.com/thkruz/ootk/compare/v1.0.8...v1.1.0)

> 26 July 2022 

- feat: :sparkles: add TLE parsing utility [`e9acd7c`](https://github.com/thkruz/ootk/commit/e9acd7cda738ef501733808b011d4496bddf05cf)

#### [v1.0.8](https://github.com/thkruz/ootk/compare/v1.0.7...v1.0.8)

> 20 July 2022 

- refactor: :label: export types [`12ce662`](https://github.com/thkruz/ootk/commit/12ce66207406330a27fe3791effd7660ef61349b)

#### [v1.0.7](https://github.com/thkruz/ootk/compare/v1.0.6...v1.0.7)

> 20 July 2022 

- build: :label: include type definition in dist folder [`4114ccd`](https://github.com/thkruz/ootk/commit/4114ccdabe4b1c7d957d017179d7700129643f83)

#### [v1.0.6](https://github.com/thkruz/ootk/compare/v1.0.5...v1.0.6)

> 20 July 2022 

- test: :white_check_mark: improve test coverage [`bfe4f9f`](https://github.com/thkruz/ootk/commit/bfe4f9f093905aab8204667d7917b32684bfb9d1)
- refactor: :rotating_light: fix linter errors [`b85a4b8`](https://github.com/thkruz/ootk/commit/b85a4b85b6f5128a6f13283e24c70376b2f048eb)

#### [v1.0.5](https://github.com/thkruz/ootk/compare/v1.0.4...v1.0.5)

> 20 July 2022 

- build(umd.js): renamed es modules to be .es.js files [`#17`](https://github.com/thkruz/ootk/pull/17)
- Rebase [`#16`](https://github.com/thkruz/ootk/pull/16)
- Multithread [`#15`](https://github.com/thkruz/ootk/pull/15)
- 1.0.4 [`#14`](https://github.com/thkruz/ootk/pull/14)
- refactor: :recycle: consolidate constants and types [`69032ad`](https://github.com/thkruz/ootk/commit/69032adcde7c013b069dc4d58bdb2c88af45d4b5)
- fix(ootk-sgp4): moved variables to local scope for speed vs reduced garbage collection [`5f41d12`](https://github.com/thkruz/ootk/commit/5f41d125c19d217e28a4278041549e5a6d51368b)
- refactor: :recycle: code cleanup [`6d9cc64`](https://github.com/thkruz/ootk/commit/6d9cc649d5c3e4787fdf8e61ccc7192a79ca5d9e)
- feat(ootk-multi): added multithreading class [`774ec62`](https://github.com/thkruz/ootk/commit/774ec62adf67267c2c58d9a4bc275ed806499595)
- refactor: :recycle: use const more often [`27d23e0`](https://github.com/thkruz/ootk/commit/27d23e0791c3dffedd6faca6153ea898504c5331)
- ci: :construction_worker: update ci [`9698423`](https://github.com/thkruz/ootk/commit/96984235de22486c569a29aae7eaa7ff8ecfbf09)
- test(multi.test.js): increased testing coverage of multi module [`e258121`](https://github.com/thkruz/ootk/commit/e2581219d376add019d82dbf8f6b73299b668077)
- fix(ootk-sgp4): moved constants to local scope for speed increase despite memory usage [`11b8c72`](https://github.com/thkruz/ootk/commit/11b8c72e94c1f83259f5db5e966448f091c84f85)
- fix(ootk-multi): improved multithreading algorithm to reduce garbage collection and variable cloning [`f9e5d63`](https://github.com/thkruz/ootk/commit/f9e5d6353ed091f232d885be4546afdca816c3d1)
- ci: :construction_worker: remove useless failing ci test [`b559e16`](https://github.com/thkruz/ootk/commit/b559e16cfe236a0dc93ab3cffcae0506d0efaa2d)
- docs: :memo: update changelog [`2b021f6`](https://github.com/thkruz/ootk/commit/2b021f6bedd1953d40d6b0d6a48442c12c406831)
- test(tests): updated references to .es.js files [`0d2fec2`](https://github.com/thkruz/ootk/commit/0d2fec262776b511d3b5f0e9f756456329f9a590)
- ci: :construction_worker: use node 17 in ci [`383d55d`](https://github.com/thkruz/ootk/commit/383d55d44a2cdec5808d32dbc57241035572a0b0)
- feat(ootk-utils): added createVec method [`0c87700`](https://github.com/thkruz/ootk/commit/0c87700bdf15aaab33e7ca4b44b6b885cd545530)
- ci: :pencil2: fix typo in ci script [`841ae40`](https://github.com/thkruz/ootk/commit/841ae40a41a8a55ab3d10adc8c5b76f38157121b)

#### [v1.0.4](https://github.com/thkruz/ootk/compare/v1.0.3...v1.0.4)

> 13 January 2021 

- build(tsconfig.json): enabled sourceMap [`#13`](https://github.com/thkruz/ootk/pull/13)
- Develop [`#12`](https://github.com/thkruz/ootk/pull/12)
- Develop [`#11`](https://github.com/thkruz/ootk/pull/11)
- Develop [`#10`](https://github.com/thkruz/ootk/pull/10)
- docs(readme): added build size to the readme [`#5`](https://github.com/thkruz/ootk/pull/5)
- Develop [`#4`](https://github.com/thkruz/ootk/pull/4)
- Update issue templates [`039baa7`](https://github.com/thkruz/ootk/commit/039baa7f361869691343dd9522102e596c2ef2b4)
- ci(ootk): renamed all .es.js files to .js [`d20e7a9`](https://github.com/thkruz/ootk/commit/d20e7a96bd962df2c14dbba499b8c32ee703a036)
- ci(codecov.yml): added codecov.yml to fix missing code coverage on .es.js files [`821a1bf`](https://github.com/thkruz/ootk/commit/821a1bf7cfaaa3d9d538d2622f9c6fe0e07e9219)
- Update issue templates [`6629196`](https://github.com/thkruz/ootk/commit/662919646cf4ba988139180ce648dee120d36c02)
- Update issue templates [`9650aac`](https://github.com/thkruz/ootk/commit/9650aac33fcb7c7ee8e8a08a9d6a14dafd7b628f)
- Update README.md [`b774337`](https://github.com/thkruz/ootk/commit/b774337f31ad9bb60a4f49a8b87282c2c48c944e)
- ci(ci.yml): fixed node support issue by referenceing dist instead of lib [`faa6e7b`](https://github.com/thkruz/ootk/commit/faa6e7bddddffcd0e02ad08b819d4d14e6684fa8)
- build(umd.js): converted import to ES6 module [`56972d3`](https://github.com/thkruz/ootk/commit/56972d3f1af32b956c75820c2a99e14d0bb99b6f)
- build(cleanup.js): fixed rimraf [`510ee61`](https://github.com/thkruz/ootk/commit/510ee61a39fae0c3cb244b7a04cc7fd630463e28)
- Update README.md [`b7846a2`](https://github.com/thkruz/ootk/commit/b7846a2a0ff37f146bd77f643841fda9a9bace79)
- docs(readme): fixed incorrect import statement [`70e4fe6`](https://github.com/thkruz/ootk/commit/70e4fe6efc961ab1d069ec5a8627492d614947ab)
- ci(ci.yml): fixed spacing error on line 84 [`08c4a97`](https://github.com/thkruz/ootk/commit/08c4a976faa386f6bb0c4fca04197b5b765e8759)
- build(package.json): fixed node compatibility [`8c03b7e`](https://github.com/thkruz/ootk/commit/8c03b7ec111aee9291086b2aed3951bc41b084c1)

#### [v1.0.3](https://github.com/thkruz/ootk/compare/v1.0.2...v1.0.3)

> 14 January 2021 

- build(umd.js): changed globalObject to this instead of self for Node [`6f79359`](https://github.com/thkruz/ootk/commit/6f793590de90b7e9b32ff2bb0b2aa52a244623c1)
- docs(readme): fixed grammar in readme file [`cd819e8`](https://github.com/thkruz/ootk/commit/cd819e853698af689a11896b9413835847ac41fe)

#### [v1.0.2](https://github.com/thkruz/ootk/compare/v1.0.1...v1.0.2)

> 14 January 2021 

- build(package.json): fixed main entry to point to correct file [`62d83a4`](https://github.com/thkruz/ootk/commit/62d83a408df117589cf45b33e9d5db0a41b0cd65)
- docs(readme): fixed link to old library name [`5ba9f84`](https://github.com/thkruz/ootk/commit/5ba9f846a9c4128d235ab223cddf8f3abc442a9b)

#### [v1.0.1](https://github.com/thkruz/ootk/compare/v1.0.0...v1.0.1)

> 13 January 2021 

- build(.npmignore): added npmignore to provide a cleaner package on npm [`8d3ebf2`](https://github.com/thkruz/ootk/commit/8d3ebf2b3d0955edf547e87eeca6b895988d1495)

### [v1.0.0](https://github.com/thkruz/ootk/compare/v1.0.0-alpha1...v1.0.0)

> 13 January 2021 

- docs(readme): added build size to the readme [`#5`](https://github.com/thkruz/ootk/pull/5)
- Develop [`#4`](https://github.com/thkruz/ootk/pull/4)
- Develop [`#3`](https://github.com/thkruz/ootk/pull/3)
- feat(ootk-transforms): add transforms from satellite.js [`#2`](https://github.com/thkruz/ootk/pull/2)
- feat(ootk-transforms): added Transforms and Utils modules [`122ed43`](https://github.com/thkruz/ootk/commit/122ed43146acdda835c345529c0b5ce7c315bf10)
- refactor(ootk-transforms): sorted functions by name [`98a8059`](https://github.com/thkruz/ootk/commit/98a8059a2fffe8e8d984b94ed6ae064753956060)
- docs(readme): updated readme notes [`31913d0`](https://github.com/thkruz/ootk/commit/31913d0be0c2a63f6ed5aa6f1aa7ddfc249add8c)
- build(umd.js): changed libary to Ootk in umd scripts to be consistent among classes [`e85a8c2`](https://github.com/thkruz/ootk/commit/e85a8c2b45c1d159b516ee18a43ec68f5362bdec)
- ci(ci.yml): removed cached ouput between jobs [`e74aa71`](https://github.com/thkruz/ootk/commit/e74aa71fe3748e5a6ec0603c22c809e012450bbf)
- chore(jest-std.json): fixed moduleNameMapper [`618a853`](https://github.com/thkruz/ootk/commit/618a8533f678ff713f6f01c3ac794cf4f4da5d94)
- build(umd.js): included utils module in umd creation [`84682ac`](https://github.com/thkruz/ootk/commit/84682ac006882f7f4c1a4abfa4873e30f82e2ae8)
- build(umd.js): included umd creation for ootk-transforms module [`13ef127`](https://github.com/thkruz/ootk/commit/13ef1279827c165b48d4dcc1bb70cc0813f73ae0)

#### v1.0.0-alpha1

> 13 January 2021 

- Documentation [`#1`](https://github.com/thkruz/ootk/pull/1)
- ootk rename [`f194490`](https://github.com/thkruz/ootk/commit/f194490621dcbefba99554a84d654f8003e459d0)
- Initial Commit [`24f4627`](https://github.com/thkruz/ootk/commit/24f46276b9f5e92f0ddb9b9ce3af9c41ee3022db)
- Functional TypeScript [`02a4b84`](https://github.com/thkruz/ootk/commit/02a4b843726f4eaa0023927dfd0e3b26aada96cd)
- Hide built [`105b742`](https://github.com/thkruz/ootk/commit/105b742abdc8753b47b4f364eb4f912dd9cce45b)
- docs(ootk-sgp4): updated documentation to split description from file [`c91cde4`](https://github.com/thkruz/ootk/commit/c91cde400044acdda684fa64d08b1b8d70ef0536)
- TS Setup [`820c884`](https://github.com/thkruz/ootk/commit/820c88495bf9b93d9129d7b5f79851114099a2f6)
- docs(readme): updated readme file to be more accurate [`5df8c5f`](https://github.com/thkruz/ootk/commit/5df8c5fdea6ca7aba25d5f1296dd5e06021e2535)
- build(package.json): added commitizen support [`860718c`](https://github.com/thkruz/ootk/commit/860718c14c75a985d2f84f069b2fea715106e87e)
- tsconfig and webpack setup [`ff50223`](https://github.com/thkruz/ootk/commit/ff50223ba7c23a6fd023b0af1af275ca8beff2da)
- ci(ci.yml): added codecov and updated CI script [`bc024c5`](https://github.com/thkruz/ootk/commit/bc024c50e180cac0317ae7419f04811afd9312f2)
- ci(ci.yml): fixed typo with indentation [`8a9c985`](https://github.com/thkruz/ootk/commit/8a9c9855bb16cfd386d94d735e84b7832a6d2825)
- build(ci.yml): added actions/cache@v2 to skip reinstalling npm packages [`43293b7`](https://github.com/thkruz/ootk/commit/43293b71ff25b5527791cb81605f9a99e3e4d04c)
- ci(ci.yml): include lib and dist in all jobs [`dd9c83a`](https://github.com/thkruz/ootk/commit/dd9c83afdfb3fe6d057cbfdf823a79cc81dc0c0e)
- ci(ci.yml): fixed typo in path [`daadbce`](https://github.com/thkruz/ootk/commit/daadbce6ebd3e6dacdd55298cd6adbfa093b954a)
- build(package.json): added auto-changelog [`c1abea7`](https://github.com/thkruz/ootk/commit/c1abea7edd46c29a8387f9bc723bbb36227199ae)
- ci(ci.yml): made another change to path [`add7891`](https://github.com/thkruz/ootk/commit/add7891edfbb1617a05f93227bd7ffb2a281cb9c)
- docs(README): updated name of the project [`8119cdb`](https://github.com/thkruz/ootk/commit/8119cdb9d7952b9befad3f254d0c7b595b33f902)
- eslint fix [`0bce593`](https://github.com/thkruz/ootk/commit/0bce593f94eb932257a5690e0a1866889becafaa)
- ci(ci.yml): included lib and dist to cache [`abdd355`](https://github.com/thkruz/ootk/commit/abdd35574fee1df773965a273f49f31b5e599a4c)
- gitignore [`a1cbf95`](https://github.com/thkruz/ootk/commit/a1cbf958e5aca36957b424f27a76e7d60fba264d)
