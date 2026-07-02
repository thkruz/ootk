# Time Systems

This example works with the epoch classes (UTC, TAI, TT, TDB, GPS), converts between time systems, computes Julian dates and Greenwich Mean Sidereal Time, and demonstrates epoch arithmetic. You need these conversions whenever you mix data sources that use different time scales, such as GPS receivers, ephemerides, and TLEs.

<<< ../../examples/time-systems.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/time-systems.ts
```

## Creating epochs

`EpochUTC` is the primary time class; construct it with `fromDateTime`, `fromDateTimeString`, or `now`. The other time systems (`EpochTAI`, `EpochTT`, `EpochTDB`, `EpochGPS`) are derived from a UTC epoch through `toTAI()`, `toTT()`, `toTDB()`, and `toGPS()`; they have no `fromDateTime` constructors of their own.

<<< ../../examples/time-systems.ts#create-epochs

## GPS time

`EpochGPS` is not posix-based: it stores a week count since the 1980-01-06 reference epoch plus seconds into the week. The `week10Bit` and `week13Bit` getters model receiver week-number rollover, and `toUTC()` converts back, accounting for the 19-second GPS-TAI offset and accumulated leap seconds.

<<< ../../examples/time-systems.ts#gps-time

## Julian dates

The standalone `jday` function computes a Julian date from calendar components, while epoch instances expose `toJulianDate()`, `toMjd()`, and `toJulianCenturies()` (centuries since J2000, the argument most precession and nutation series expect).

<<< ../../examples/time-systems.ts#julian-dates

## Greenwich Mean Sidereal Time

`calcGmst` returns GMST in radians for a JavaScript `Date`, and `EpochUTC.gmstAngle()` produces the same angle from an epoch. GMST is the rotation angle between the ECI and ECEF frames, so it appears in every inertial-to-Earth-fixed transform.

<<< ../../examples/time-systems.ts#gmst

## Time system offsets

Every `Epoch` stores posix seconds in its own time scale, so subtracting `posix` values between two derived epochs exposes the offsets: TAI leads UTC by the accumulated leap seconds (37 at this date), TT leads TAI by a constant 32.184 s, and TDB differs from TT by a sub-2 ms periodic relativistic term.

<<< ../../examples/time-systems.ts#time-offsets

## Epoch arithmetic

`roll(seconds)` returns a new epoch shifted by a `Seconds` amount (it does not mutate), and `difference(other)` returns the separation in seconds.

<<< ../../examples/time-systems.ts#epoch-arithmetic

## Reference epochs and precision

The same APIs applied to well-known reference epochs (GPS start, J2000.0, Unix epoch), plus a sub-second example showing that `posix` preserves millisecond input precision through conversions.

<<< ../../examples/time-systems.ts#reference-epochs

## Output

```txt
=== Example 1: Different Time Systems ===

UTC (Coordinated Universal Time): 2024-01-28T12:00:00.000Z
TAI (International Atomic Time):  2024-01-28T12:00:37.000Z
TT  (Terrestrial Time):           2024-01-28T12:01:09.184Z
TDB (Barycentric Dynamical Time): 2024-01-28T12:01:09.184Z
GPS (week:seconds of week):       2299:43218.000

=== Example 2: GPS Time ===

GPS reference epoch: 1980-01-06T00:00:00.000Z
GPS week:            2299
GPS week (10-bit):   251
GPS week (13-bit):   2299
Seconds of week:     43218.000

Round trip GPS -> UTC: 2024-01-28T12:00:00.000Z

=== Example 3: Julian Dates ===

Date: 2024-01-28T12:00:00.000Z
Julian Date: 2460338.000000
Modified Julian Date: 60337.500000

From EpochUTC:
  Julian Date: 2460338.000000
  Modified Julian Date: 60337.500000
  Julian Centuries since J2000: 0.24073922

J2000 Epoch:
  Date: 2000-01-01T12:00:00.000Z
  Julian Date: 2451545.000000

=== Example 4: Greenwich Mean Sidereal Time ===

Date: 2024-01-28T12:00:00.000Z
GMST: 5.362663 radians
      307.257933 deg
      20.483862 hours
      20h 29m 1.90s

From EpochUTC: 5.362663 radians

=== Example 5: Time System Offsets ===

TAI - UTC = 37 seconds (leap seconds)
TT - TAI  = 32.184 seconds (constant)
TDB - TT  = 0.682 milliseconds (periodic)

=== Example 6: Epoch Arithmetic ===

Start: 2024-01-01T00:00:00.000Z
+1 day: 2024-01-02T00:00:00.000Z
+7 days: 2024-01-08T00:00:00.000Z
Difference: 604800 seconds

=== Example 7: Common Date/Time Scenarios ===

GPS Epoch Start:
  Date: 1980-01-06T00:00:00.000Z
  JD: 2444244.500000
  GMST: 6.9828 hours

... (truncated)

=== Example 8: High-Precision Time Comparison ===

Input: 2024-01-28T12:34:56.789Z
UTC epoch posix: 1706445296.789000034 seconds since Unix epoch

Time differences (from UTC):
  TAI: +37000 ms
  TT:  +69184 ms
```
