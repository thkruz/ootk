import { Degrees, Gigahertz, Kelvin, Kilometers, SpaceObjectType, Watts, Decibels } from '../../src/main.js';
import { GroundStation } from '../../src/main.js';
import { FrequencyBand, PolarizationType } from '../../src/main.js';

describe('GroundStation', () => {
  it('should create a ground station with transmitter and receiver', () => {
    const groundStation = new GroundStation({
      name: 'Test Ground Station',
      lat: 40.0 as Degrees,
      lon: -105.0 as Degrees,
      alt: 1.655 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 5 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 100 as Kilometers,
      maxRng: 5000 as Kilometers,
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      boresightAz: [0 as Degrees],
      boresightEl: [45 as Degrees],
      beamwidth: 2 as Degrees,
      transmitter: {
        power: 1000 as Watts,
        antenna: {
          gain: 45 as Decibels,
          frequency: 2 as Gigahertz,
          band: FrequencyBand.S_BAND,
          polarization: PolarizationType.RHCP,
        },
      },
      receiver: {
        antenna: {
          gain: 45 as Decibels,
          frequency: 2.3 as Gigahertz,
          band: FrequencyBand.S_BAND,
          polarization: PolarizationType.RHCP,
        },
        systemNoiseTemperature: 150 as Kelvin,
      },
      minOperatingElevation: 10,
      maxRange: 5000,
    });

    expect(groundStation).toBeInstanceOf(GroundStation);
    expect(groundStation.canTransmit()).toBe(true);
    expect(groundStation.canReceive()).toBe(true);
    expect(groundStation.isFullDuplex()).toBe(true);
  });

  it('should create a receive-only ground station', () => {
    const groundStation = new GroundStation({
      name: 'Receive Only Station',
      lat: 40.0 as Degrees,
      lon: -105.0 as Degrees,
      alt: 1.655 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 5 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 100 as Kilometers,
      maxRng: 5000 as Kilometers,
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      boresightAz: [0 as Degrees],
      boresightEl: [45 as Degrees],
      beamwidth: 2 as Degrees,
      receiver: {
        antenna: {
          gain: 45 as Decibels,
          frequency: 2.3 as Gigahertz,
        },
        systemNoiseTemperature: 150 as Kelvin,
      },
    });

    expect(groundStation.canTransmit()).toBe(false);
    expect(groundStation.canReceive()).toBe(true);
    expect(groundStation.isFullDuplex()).toBe(false);
  });

  it('should calculate EIRP correctly', () => {
    const groundStation = new GroundStation({
      name: 'Test Station',
      lat: 40.0 as Degrees,
      lon: -105.0 as Degrees,
      alt: 1.655 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 5 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 100 as Kilometers,
      maxRng: 5000 as Kilometers,
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      boresightAz: [0 as Degrees],
      boresightEl: [45 as Degrees],
      beamwidth: 2 as Degrees,
      transmitter: {
        power: 100 as Watts,
        antenna: {
          gain: 40 as Decibels,
          frequency: 2 as Gigahertz,
        },
      },
    });

    const eirp = groundStation.getEirp();

    // EIRP should be approximately 20 dBW (power) + 40 dBi (gain) = 60 dBW
    expect(eirp).toBeDefined();
    expect(eirp).toBeCloseTo(60, 0);
  });

  it('should check elevation constraints', () => {
    const groundStation = new GroundStation({
      name: 'Test Station',
      lat: 40.0 as Degrees,
      lon: -105.0 as Degrees,
      alt: 1.655 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 5 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 100 as Kilometers,
      maxRng: 5000 as Kilometers,
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      boresightAz: [0 as Degrees],
      boresightEl: [45 as Degrees],
      beamwidth: 2 as Degrees,
      minOperatingElevation: 10,
    });

    expect(groundStation.canOperateAtElevation(15 as Degrees)).toBe(true);
    expect(groundStation.canOperateAtElevation(5 as Degrees)).toBe(false);
  });

  it('should get station information', () => {
    const groundStation = new GroundStation({
      name: 'Test Station',
      lat: 40.0 as Degrees,
      lon: -105.0 as Degrees,
      alt: 1.655 as Kilometers,
      minAz: 0 as Degrees,
      maxAz: 360 as Degrees,
      minEl: 5 as Degrees,
      maxEl: 90 as Degrees,
      minRng: 100 as Kilometers,
      maxRng: 5000 as Kilometers,
      type: SpaceObjectType.GROUND_SENSOR_STATION,
      boresightAz: [0 as Degrees],
      boresightEl: [45 as Degrees],
      beamwidth: 2 as Degrees,
      receiver: {
        antenna: {
          gain: 45 as Decibels,
          frequency: 2.3 as Gigahertz,
        },
        systemNoiseTemperature: 150 as Kelvin,
      },
    });

    const info = groundStation.getInfo();

    expect(info.name).toBe('Test Station');
    expect(info.canTransmit).toBe(false);
    expect(info.canReceive).toBe(true);
    expect(info.gOverT).toBeDefined();
  });
});
