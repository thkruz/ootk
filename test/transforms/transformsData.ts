import { Degrees, EcfVec3, EciVec3, Kilometers, RAD2DEG, Radians } from '../../src/main';

export const transformsData = {
  validLatitudes: [
    {
      radians: 0 as Radians,
      degrees: 0 as Degrees,
    },
    {
      radians: 1.0471975511965976 as Radians,
      degrees: 60 as Degrees,
    },
    {
      radians: 1.5707963267948966 as Radians,
      degrees: 90 as Degrees,
    },
    {
      radians: -1.0471975511965976 as Radians,
      degrees: -60 as Degrees,
    },
    {
      radians: -1.5707963267948966 as Radians,
      degrees: -90 as Degrees,
    },
  ],
  validLongitudes: [
    {
      radians: 0 as Radians,
      degrees: 0 as Degrees,
    },
    {
      radians: 1.0471975511965976 as Radians,
      degrees: 60 as Degrees,
    },
    {
      radians: 2.356194490192345 as Radians,
      degrees: 135 as Degrees,
    },
    {
      radians: 3.141592653589793 as Radians,
      degrees: 180 as Degrees,
    },
    {
      radians: -1.0471975511965976 as Radians,
      degrees: -60 as Degrees,
    },
    {
      radians: -2.356194490192345 as Radians,
      degrees: -135 as Degrees,
    },
    {
      radians: -3.141592653589793 as Radians,
      degrees: -180 as Degrees,
    },
  ],
  validGeodeticToEcf: [
    {
      lla: {
        lon: 0 as Degrees,
        lat: 0 as Degrees,
        alt: 0 as Kilometers,
      },
      ecf: {
        x: 6378.137 as Kilometers,
        y: 0 as Kilometers,
        z: 0 as Kilometers,
      },
    },
    {
      lla: {
        lon: 380 as Degrees,
        lat: 40 as Degrees,
        alt: 1 as Kilometers,
      },
      ecf: {
        x: 4598.36107377528 as Kilometers,
        y: 1673.6665572625757 as Kilometers,
        z: 4078.628359764023 as Kilometers,
      },
    },
    {
      lla: {
        lon: -400 as Degrees,
        lat: 80 as Degrees,
        alt: 2 as Kilometers,
      },
      ecf: {
        x: 851.4677191220125 as Kilometers,
        y: -714.4662490746402 as Kilometers,
        z: 6261.512576488877 as Kilometers,
      },
    },
  ],
  validEciToGeodetic: [
    {
      eci: {
        x: 6400,
        y: 100,
        z: 0,
      } as EciVec3,
      gmst: 0,
      lla: {
        lon: (0.015623 * RAD2DEG) as Degrees,
        lat: (0 * RAD2DEG) as Degrees,
        alt: 22.6442 as Kilometers,
      },
    },
    {
      eci: {
        x: 5000,
        y: 45000,
        z: 0,
      } as EciVec3,
      gmst: 10,
      lla: {
        lon: (-2.256675587199412 * RAD2DEG) as Degrees,
        lat: (0 * RAD2DEG) as Degrees,
        alt: 38898.78869068708 as Kilometers,
      },
    },
    {
      eci: {
        x: 5000,
        y: 45000,
        z: 0,
      } as EciVec3,
      gmst: -10,
      lla: {
        lon: (-1.1062315087381709 * RAD2DEG) as Degrees,
        lat: (0 * RAD2DEG) as Degrees,
        alt: 38898.78869068708,
      },
    },
  ],
  validEciToEcf: [
    {
      eci: {
        x: 6400,
        y: 0,
        z: 0,
      },
      gmst: 10,
      ecf: {
        x: -5370.057786089295,
        y: 3481.7351096919665,
        z: 0,
      },
    },
    {
      eci: {
        x: 8000,
        y: 0,
        z: 8000,
      },
      gmst: 10,
      ecf: {
        x: -6712.572232611619,
        y: 4352.168887114958,
        z: 8000,
      },
    },
    {
      eci: {
        x: 8000,
        y: -4000,
        z: -8000,
      },
      gmst: -30,
      ecf: {
        x: -2718.114897270775,
        y: -8521.25879229323,
        z: -8000,
      },
    },
  ],
  validEcfToEci: [
    {
      ecf: {
        x: 5555,
        y: 3000,
        z: 0,
      },
      gmst: 100,
      eci: {
        x: 6309.278258887361,
        y: -225.90451950165834,
        z: 0,
      },
    },
    {
      ecf: {
        x: 12000,
        y: 0,
        z: 9999,
      },
      gmst: 5000,
      eci: {
        x: 1856.0208741689655,
        y: -11855.597265201322,
        z: 9999,
      },
    },
    {
      ecf: {
        x: 54321,
        y: 12345,
        z: 12345,
      },
      gmst: 12345,
      eci: {
        x: 18321.41422594596,
        y: -52606.994276059,
        z: 12345,
      },
    },
  ],
  validEcfToLookangles: [
    {
      lla: {
        lat: (0.7287584767123405 * RAD2DEG) as Degrees,
        lon: (-1.2311404365114507 * RAD2DEG) as Degrees,
        alt: 0.060966 as Kilometers,
      },
      satelliteEcf: {
        x: 1838.5578358534067,
        y: -4971.972919387344,
        z: 4466.101983887215,
      } as EcfVec3<Kilometers>,
      rae: {
        az: 156.45929778422533 as Degrees,
        el: 70.9805298041814 as Degrees,
        rng: 591.9168938970199 as Kilometers,
      },
    },
  ],
  validRae2Sez: [
    {
      rae: {
        rng: 4612.7279304771755 as Kilometers,
        az: 2.769701913047414 as Radians,
        el: 0.2050152036110117 as Radians,
      },
      sez: {
        s: 4207.414029689924 as Kilometers,
        e: 1641.0595158550045 as Kilometers,
        z: 939.0685857776206 as Kilometers,
      },
    },
  ],
  validRae2Ecf: [
    {
      rae: {
        rng: 4612.7279304771755 as Kilometers,
        az: 158.6922301314627 as Degrees,
        el: 11.74650590326194 as Degrees,
      },
      lla: {
        lon: -71 as Degrees,
        lat: 41 as Degrees,
        alt: 1 as Kilometers,
      },
      ecf: {
        x: 4000 as Kilometers,
        y: 7000 as Kilometers,
        z: 3000 as Kilometers,
      },
    },
  ],
  invalidLatitudes: [
    {
      radians: 2.0943951023931953 as Radians,
      degrees: 120 as Degrees,
    },
    {
      radians: -2.0943951023931953 as Radians,
      degrees: -120 as Degrees,
    },
  ],
  invalidLongitudes: [
    {
      radians: 4.71238898038469 as Radians,
      degrees: 270 as Degrees,
    },
    {
      radians: -4.71238898038469 as Radians,
      degrees: -270 as Degrees,
    },
  ],
};
