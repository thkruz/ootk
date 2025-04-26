export const sgp4FullCovFail = [
  {
    description: 'Mean motion is zero and that is not allowed.',
    tleLine1: '1 00001U 57001B   21005.53831292 -.00000083  00000-0 -11575-3 0  9996',
    tleLine2: '2 00001  34.2508 325.6936 1846988 181.8107 177.4919 00.00000000227203',
    error: 2,
  },
  {
    description: 'Eccentricity is way too high because mean motion is nearly zero.',
    tleLine1: '1 00002U 57001B   21005.53831292 -.00000083  00000-0 -11575-3 0  9996',
    tleLine2: '2 00002  34.2508 325.6936 1846988 181.8107 177.4919 00.00000001227203',
    error: 3,
  },
  {
    description: 'Mean motion is zero and that is not allowed.',
    tleLine1: '1 00004U 57001B   21005.53831292 -.00000083  00000-0 -11575-3 0  9996',
    tleLine2: '2 00004  34.2508 325.6936 9999999 181.8107 177.4919 10.84863720227203',
    error: 4,
  },
  {
    description: 'Satellite should be decayed already.',
    tleLine1: '1 00006U 57001B   21005.53831292 -.00000083  00000-0 -11575-3 0  9996',
    tleLine2: '2 00005  34.2508 325.6936 1846988 181.8107 177.4919 25.84863720227203',
    error: 6,
  },
  {
    description: 'error code 3',
    tleLine1: '1 33334U 78066F   06174.85818871  .00000620  00000-0  10000-3 0  6809',
    tleLine2: '2 33334  68.4714 236.1303 5602877 123.7484 302.5767  0.00001000 67521',
    error: 3,
  },
];
