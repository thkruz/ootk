# Time Module

This module provides precise time handling for orbital mechanics calculations. Different astronomical time scales are required for different applications, and this module provides classes for each.

## Quick Start

For most use cases, start with `EpochUTC`:

```typescript
import { EpochUTC, Seconds } from 'ootk';

// Create from various sources
const now = EpochUTC.now();
const fromDate = EpochUTC.fromDate({ year: 2024, month: 6, day: 15, hour: 12 });
const fromString = EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z');
const fromJsDate = EpochUTC.fromDateTime(new Date('2024-06-15T12:00:00Z'));

// Time arithmetic
const oneHourLater = now.roll(3600 as Seconds);
const difference = oneHourLater.difference(now); // 3600 seconds

// Convert to other time scales as needed
const tai = now.toTAI();
const tt = now.toTT();
const tdb = now.toTDB();
const gps = now.toGPS();
```

## Class Hierarchy

```
Epoch (base class)
├── EpochUTC  ─── Coordinated Universal Time (primary user-facing class)
├── EpochTAI  ─── International Atomic Time
├── EpochTT   ─── Terrestrial Time
└── EpochTDB  ─── Barycentric Dynamical Time

EpochGPS      ─── GPS Time (standalone, week/seconds format)
```

## Time Scale Conversion Chain

```
UTC ──(+leap seconds)──► TAI ──(+32.184s)──► TT ──(+relativistic)──► TDB
 │
 └──(week/seconds since 1980-01-06)──► GPS
```

## Time Scales Overview

| Class | Time Scale | Offset from UTC | Primary Use Case |
|-------|------------|-----------------|------------------|
| `EpochUTC` | Coordinated Universal Time | - | User I/O, TLEs, general tracking |
| `EpochTAI` | International Atomic Time | +37s (as of 2024) | Continuous timekeeping |
| `EpochTT` | Terrestrial Time | +69.184s (as of 2024) | Earth orientation, force models |
| `EpochTDB` | Barycentric Dynamical Time | ~TT ± 1.6ms | Planetary ephemerides, JPL data |
| `EpochGPS` | GPS Time | +18s (as of 2024) | GPS/GNSS applications |

## Choosing the Right Time Scale

### Use EpochUTC when

- Parsing or generating TLE (Two-Line Element) data
- Displaying timestamps to users
- Working with satellite pass predictions
- Any civil time application

### Use EpochTAI when

- You need continuous time without leap second jumps
- Interfacing with atomic time systems
- As an intermediate for UTC ↔ TT conversions

### Use EpochTT when
- Calculating Earth precession and nutation (ootk does not model polar motion)
- Calculating Earth precession, nutation, or polar motion
- Evaluating precession and nutation series (IERS Earth Orientation Parameters themselves are tabulated by UTC MJD, not TT)
- Working with astronomical almanacs
- Satellite force modeling that references Earth orientation

### Use EpochTDB when

- Querying JPL planetary ephemerides (DE430, DE440, etc.)
- Calculating Sun, Moon, or planet positions with your own ephemeris code (ootk's `Sun`, `Moon` and `SolarSystem` bodies take a JavaScript `Date` as UTC and convert internally)
- Interplanetary mission planning
- Working in barycentric coordinate systems (ICRF/BCRS)

### Use EpochGPS when

- Processing GPS receiver timestamps
- Working with GPS broadcast ephemerides
- GNSS navigation applications
- Interfacing with systems using week/seconds format

## Detailed Conversions

### UTC to TAI

```
TAI = UTC + leap_seconds
```

Leap seconds are added to UTC periodically (typically every few years) to keep civil time synchronized with Earth's rotation. TAI runs continuously without these adjustments.

### TAI to TT

```
TT = TAI + 32.184 seconds
```

This is a fixed offset chosen for historical continuity with Ephemeris Time.

### TT to TDB

```
TDB ≈ TT + 0.001658·sin(M) + 0.000014·sin(2M)
```

Where M is Earth's mean anomaly. This periodic correction accounts for relativistic effects from Earth's elliptical orbit around the Sun. Maximum difference is approximately ±1.6 milliseconds.

### UTC to GPS

```
GPS = UTC + leap_seconds - 19
```

GPS Time was synchronized with UTC in 1980 when there were 19 leap seconds. GPS does not add leap seconds, so it diverges from UTC over time.

## Common Patterns

### Earth Orientation

```typescript
import { Earth, EpochUTC } from 'ootk';

const utc = EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z');

// Earth orientation helpers take the UTC epoch and convert to TT internally
const precession = Earth.precession(utc); // IAU 1976 zeta, theta, zed (rad)
const nutation = Earth.nutation(utc); // IAU 1980, 106 terms: dPsi, dEps, eps, gast (rad)

// TT Julian centuries, if you evaluate your own series
const t = utc.toTT().toJulianCenturies();
```

### Sun, Moon and Planetary Positions

```typescript
import { EpochUTC, Moon, Sun } from 'ootk';

const date = new Date('2024-06-15T12:00:00Z');

// ootk's body APIs take a JavaScript Date interpreted as UTC (not an EpochTDB);
// the time-scale conversions happen inside.
const sunPosition = Sun.eci(date); // J2000, km
const moonPosition = Moon.eci(date); // J2000, km

// TDB seconds past J2000, for example as the argument to your own JPL ephemeris reader
const tdbSeconds = EpochUTC.fromDateTime(date).toTDB().posix - 946728000;
```

### GPS Data Processing

```typescript
import { EpochGPS, EpochUTC } from 'ootk';

// Convert GPS week/seconds to UTC
const gps = new EpochGPS(2318, 302400);
const utc = gps.toUTC();

// Or convert UTC to GPS format
const gpsTime = EpochUTC.now().toGPS();
console.log(`Week: ${gpsTime.week}, Seconds: ${gpsTime.seconds}`);

// Access the GPS reference epoch (1980-01-06T00:00:00Z)
const reference = EpochGPS.getReference();
```

## Julian Date Conversions

All Epoch classes provide Julian Date conversions:

```typescript
import { EpochUTC } from 'ootk';

const epoch = EpochUTC.now();

// Julian Date (days since 4713 BCE)
const jd = epoch.toJulianDate();

// Julian Centuries since J2000.0 (for astronomical calculations)
const centuries = epoch.toJulianCenturies();

// Modified Julian Date (JD - 2400000.5)
const mjd = epoch.toMjd();

// GSFC Modified Julian Date (MJD - 29999.5)
const mjdGsfc = epoch.toMjdGsfc();
```

## Sidereal Time

EpochUTC provides Greenwich Mean Sidereal Time (GMST, IAU 1982), essential for converting between Earth-fixed and inertial reference frames. UTC stands in for UT1 (no DUT1 correction, so up to 0.9 s or about 420 m of rotation at the equator):

```typescript
import { EpochUTC } from 'ootk';

const epoch = EpochUTC.now();

// GMST in radians (0 to 2 pi)
const gmstRad = epoch.gmstAngle();

// GMST in degrees (0 to 360)
const gmstDeg = epoch.gmstAngleDegrees();
```

## Additional Classes

### EpochWindow

Represents a time interval with start and end epochs, useful for:

- Satellite visibility windows
- Contact periods
- Event scheduling

### TimeStamped

Generic interface for objects that have an associated epoch timestamp.
