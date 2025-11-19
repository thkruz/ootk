import { Decibels, Gigahertz, Kelvin, Kilometers, Watts, BitsPerSecond } from '../../src/main.js';
import { LinkBudget, Antenna, Transmitter, Receiver } from '../../src/main.js';
import { FrequencyBand, PolarizationType } from '../../src/main.js';

describe('LinkBudget', () => {
  it('should create a link budget and perform calculations', () => {
    // Define a simple link: ground station to GEO satellite
    const linkBudget = new LinkBudget({
      transmitter: {
        power: 100 as Watts, // 100W transmitter
        antenna: {
          gain: 50 as Decibels, // 50 dBi antenna
          frequency: 14 as Gigahertz, // Ku-band uplink
          band: FrequencyBand.KU_BAND,
          polarization: PolarizationType.RHCP,
        },
        cableLoss: 2 as Decibels,
      },
      receiver: {
        antenna: {
          gain: 30 as Decibels, // 30 dBi antenna on satellite
          frequency: 14 as Gigahertz,
          band: FrequencyBand.KU_BAND,
          polarization: PolarizationType.RHCP,
        },
        systemNoiseTemperature: 500 as Kelvin,
        cableLoss: 1 as Decibels,
      },
      range: 38000 as Kilometers, // GEO distance
      frequency: 14 as Gigahertz,
      dataRate: 10e6 as BitsPerSecond, // 10 Mbps
      requiredEbN0: 10 as Decibels,
      atmosphericLoss: 1 as Decibels,
    });

    expect(linkBudget).toBeInstanceOf(LinkBudget);

    const result = linkBudget.calculate();

    // Check that we got valid results
    expect(result.eirp).toBeGreaterThan(0);
    expect(result.pathLoss).toBeGreaterThan(0);
    expect(result.cn0).toBeGreaterThan(0);
    expect(result.linkMargin).toBeDefined();
  });

  it('should calculate correct EIRP', () => {
    const linkBudget = new LinkBudget({
      transmitter: {
        power: 100 as Watts,
        antenna: {
          gain: 50 as Decibels,
          frequency: 14 as Gigahertz,
        },
      },
      receiver: {
        antenna: {
          gain: 30 as Decibels,
          frequency: 14 as Gigahertz,
        },
        systemNoiseTemperature: 500 as Kelvin,
      },
      range: 1000 as Kilometers,
      frequency: 14 as Gigahertz,
    });

    const result = linkBudget.calculate();

    // EIRP should be approximately: 10*log10(100) + 50 = 20 + 50 = 70 dBW
    expect(result.eirp).toBeCloseTo(70, 0);
  });

  it('should calculate free space path loss correctly', () => {
    const linkBudget = new LinkBudget({
      transmitter: {
        power: 100 as Watts,
        antenna: {
          gain: 50 as Decibels,
          frequency: 14 as Gigahertz,
        },
      },
      receiver: {
        antenna: {
          gain: 30 as Decibels,
          frequency: 14 as Gigahertz,
        },
        systemNoiseTemperature: 500 as Kelvin,
      },
      range: 1000 as Kilometers,
      frequency: 14 as Gigahertz,
    });

    const result = linkBudget.calculate();

    // Path loss should be positive and reasonable for 1000 km at 14 GHz
    expect(result.pathLoss).toBeGreaterThan(170);
    expect(result.pathLoss).toBeLessThan(190);
  });

  it('should generate a summary', () => {
    const linkBudget = new LinkBudget({
      transmitter: {
        power: 100 as Watts,
        antenna: {
          gain: 50 as Decibels,
          frequency: 14 as Gigahertz,
        },
      },
      receiver: {
        antenna: {
          gain: 30 as Decibels,
          frequency: 14 as Gigahertz,
        },
        systemNoiseTemperature: 500 as Kelvin,
      },
      range: 38000 as Kilometers,
      frequency: 14 as Gigahertz,
      dataRate: 10e6 as BitsPerSecond,
      requiredEbN0: 10 as Decibels,
    });

    const summary = linkBudget.getSummary();

    expect(summary).toContain('Link Budget Summary');
    expect(summary).toContain('EIRP');
    expect(summary).toContain('Path Loss');
    expect(summary).toContain('Link Margin');
  });
});
