# Sensors

Ground stations, attached sensor components, and the low-level transform functions (ECEF, ECI, LLA, RAE) used for look-angle math. Use this when you need to convert positions between Earth-fixed, inertial, and topocentric frames, or when you want a sensor with field-of-view constraints attached to a ground site.

<<< ../../examples/sensor.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/sensor.ts
```

## Create a ground station

`GroundStation` is the location-bearing object: it holds lat/lon/alt and provides coordinate helpers like `lla()`, `eci()`, and `toJ2000()`. Sensors do not carry a position of their own; they attach to a platform like this one.

<<< ../../examples/sensor.ts#create-ground-station

## Attach a sensor

Sensors are components. Construct a concrete type (here `PhasedArrayRadar`) with a `fieldOfView` (cone half-angle, range bounds, minimum elevation) plus radar-specific parameters, then wire it to the platform with `groundStation.addSensor(radar)` and `radar.setParent(groundStation)`. Both calls are needed: the station tracks its sensors, and the sensor delegates position queries to its parent.

<<< ../../examples/sensor.ts#attach-sensor

## ECEF to RAE

`ecef2rae(lla, ecef)` converts an Earth-fixed position into range, azimuth, and elevation as seen from an observer given in geodetic degrees. The station's `lla()` output feeds it directly.

<<< ../../examples/sensor.ts#ecef-to-rae

## ECI conversions

The same point can be routed through the inertial frame: `calcGmst(date)` gives the rotation angle, `ecef2eci` moves the point into ECI, and `eci2rae(date, eci, observer)` or `eci2lla(eci, gmst)` bring it back to observer-relative or geodetic coordinates. The RAE result matches the direct ECEF path.

<<< ../../examples/sensor.ts#eci-conversions

## Satellite look angles

`Satellite.rae(groundObject, date)` computes look angles in one call, and `toJ2000(date).toITRF().toGeodetic()` chains frame conversions to get the subsatellite point. The attached radar layers its FOV constraints on top via `canObserve(sat, date)`.

<<< ../../examples/sensor.ts#satellite-look-angles

## Output

```txt
[GroundStation]
  ID: -1
  Name: Test Station
  Location: 41.0000°, -71.0000°, 1.000 km
  Sensors: 0
  Comm Devices: 0

[_PhasedArrayRadar]
  ID: 1
  Name: Cape Cod
  Type: PHASED_ARRAY_RADAR
  Parent: Test Station
  [FieldOfView]
    Boresight: Az 0.0°, El 90.0°
    Shape: 60.0° cone
    Range: 200.0 - 5556.0 km
    Min Elevation: 3.0°
  Faces: 2
    Face 0: Az=47.0°, El=20.0°
    Face 1: Az=167.0°, El=20.0°

RAE from ECEF:
{
  rng: 11867.826042828654,
  az: 46.3936383480027,
  el: -45.14527065977833
}

RAE from ECI (should match the ECEF path):
{
  rng: 11867.826042828654,
  az: 46.3936383480027,
  el: -45.14527065977833
}

Geodetic coordinates of the ECI point:
{
  lon: 60.25511870305778,
  lat: 20.50378567774451,
  alt: 2226.796648045177
}

Satellite look angles from the ground station:
{
  rng: 2323.6437976750553,
  az: 220.1318954201388,
  el: 31.442701897926916
}

Satellite geodetic position (J2000 -> ITRF -> Geodetic):
_Geodetic {
  lat: 0.5103321455362404,
  lon: -1.4268203137993296,
  alt: 1467.0398331566748
}

Is the satellite in the radar's FOV? YES
```
