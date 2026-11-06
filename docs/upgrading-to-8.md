# Upgrading to ootk 8


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

