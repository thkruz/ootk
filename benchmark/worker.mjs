/**
 * Benchmarks exactly ONE library (ootk or satellite.js) in this process, then
 * prints a JSON result to stdout. Run via run.mjs, which gives each trial a
 * fresh Node process so JIT specialization and GC pressure from one library
 * can never contaminate the other's numbers.
 *
 * Three phases are timed independently:
 *   init — TLE parse + satrec initialization (twoline2satrec / createSatrec)
 *   prop — pure SGP4 propagation (sgp4(satrec, tsince)), the hot loop
 *   e2e  — the exact scenario from ootk issue #31: look angles for the whole
 *          catalog from one ground site at one instant. ootk uses
 *          groundObject.rae(satellite, date); satellite.js uses the reporter's
 *          propagate + eciToEcf + ecfToLookAngles pipeline with gstime hoisted
 *          out of the loop (as written in the issue).
 *   micro — every overlapping standalone function (gstime, eci<->ecf,
 *           eci->geodetic, geodetic->ecf, look angles, doppler) over a
 *           deterministic seeded dataset built without either library, so both
 *           workers see byte-identical inputs.
 *
 * A position checksum is accumulated inside the timed loop. This both prevents
 * the JIT from dead-code-eliminating the work and lets run.mjs verify the two
 * libraries produced numerically identical results.
 */
import { loadTles } from './load-tles.mjs';

const LIB = process.argv[2];
const INIT_ROUNDS = 3;
const PROP_WARMUP_ROUNDS = 3;
const PROP_ROUNDS = 10;
// Offsets (minutes from epoch) spread over a day so period-dependent branches
// (near-earth vs deep-space resonance code) all get exercised.
const TSINCE_OFFSETS = [0, 360, 720, 1440];
const E2E_WARMUP_ROUNDS = 3;
const E2E_ROUNDS = 10;
// Fixed instant near the fixture TLE epochs (space-track snapshot from Aug 2022)
const E2E_DATE = new Date(Date.UTC(2022, 7, 10, 0, 0, 0));
// Nonzero altitude also validates the lla2sez fix: elevations only match
// satellite.js when the observer altitude actually flows into the SEZ frame.
const OBSERVER = { lat: 40, lon: -75, alt: 0.1 }; // degrees / km
const DEG2RAD = Math.PI / 180;

const tles = loadTles();

// ---- Deterministic micro-bench dataset (identical for both libraries) -----
const MICRO_N = 25000;
const MICRO_WARMUP_ROUNDS = 2;
const MICRO_ROUNDS = 8;
const MICRO_GMST = 4.88; // rad, arbitrary fixed sidereal angle
const MICRO_JD0 = 2459801.5; // 2022-08-10, matches the e2e instant

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = mulberry32(0xC0FFEE);
const eciVecs = [];
const ecefVecs = [];
const posVelPairs = [];
const llaDegVecs = []; // ootk's native geodetic input (degrees)
const llaRadVecs = []; // satellite.js's native geodetic input (radians)
const jdVals = [];

for (let i = 0; i < MICRO_N; i++) {
  // Random position on an orbital shell between LEO and just past GEO
  const r = 6600 + rand() * 36000;
  const cosColat = rand() * 2 - 1;
  const theta = rand() * 2 * Math.PI;
  const sinColat = Math.sqrt(1 - cosColat * cosColat);
  const pos = { x: r * sinColat * Math.cos(theta), y: r * sinColat * Math.sin(theta), z: r * cosColat };

  eciVecs.push(pos);
  ecefVecs.push({ x: pos.y, y: pos.z, z: pos.x }); // reshuffled so ecf inputs aren't the same values

  // Tangential velocity at circular speed for the shell
  const speed = Math.sqrt(398600.4418 / r);
  const horizontal = Math.hypot(pos.x, pos.y);
  const tangent = horizontal > 1
    ? { x: -pos.y / horizontal, y: pos.x / horizontal, z: 0 }
    : { x: 1, y: 0, z: 0 };

  posVelPairs.push({ pos, vel: { x: tangent.x * speed, y: tangent.y * speed, z: tangent.z * speed } });

  const lat = (rand() * 178 - 89);
  const lon = (rand() * 360 - 180);
  const alt = rand() * 2000;

  llaDegVecs.push({ lat, lon, alt });
  llaRadVecs.push({ latitude: lat * DEG2RAD, longitude: lon * DEG2RAD, height: alt });

  jdVals.push(MICRO_JD0 + (rand() * 60 - 30));
}

let createSatrec;
let sgp4;
let e2eSetup; // builds the per-library objects the issue's prep code built
let e2eRun; // one full-catalog look-angle pass; returns {checksum, errors} with az+el in radians
let micro; // canonical fn name -> one timed pass over the shared dataset, returns checksum

if (LIB === 'ootk') {
  const { Sgp4, Satellite, GroundObject, eci2ecef, ecef2eci, eci2lla, lla2ecef, ecef2rae, dopplerFactor } =
    await import('../dist/main.js');

  createSatrec = (l1, l2) => Sgp4.createSatrec(l1, l2);
  sgp4 = (satrec, tsince) => Sgp4.propagate(satrec, tsince);

  const obsLla = { lat: OBSERVER.lat, lon: OBSERVER.lon, alt: OBSERVER.alt };
  const obsEcf = lla2ecef(obsLla);

  // Checksums normalize to radians/km so they can be compared across libraries
  micro = {
    gstime: () => {
      let cs = 0;

      for (const jd of jdVals) {
        cs += Sgp4.gstime(jd);
      }

      return cs;
    },
    'eci -> ecf': () => {
      let cs = 0;

      for (const vec of eciVecs) {
        const out = eci2ecef(vec, MICRO_GMST);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'ecf -> eci': () => {
      let cs = 0;

      for (const vec of ecefVecs) {
        const out = ecef2eci(vec, MICRO_GMST);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'eci -> geodetic': () => {
      let cs = 0;

      for (const vec of eciVecs) {
        const out = eci2lla(vec, MICRO_GMST);

        cs += out.lat * DEG2RAD + out.lon * DEG2RAD + out.alt;
      }

      return cs;
    },
    'geodetic -> ecf': () => {
      let cs = 0;

      for (const lla of llaDegVecs) {
        const out = lla2ecef(lla);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'ecf -> look angles': () => {
      let cs = 0;

      for (const vec of ecefVecs) {
        const out = ecef2rae(obsLla, vec);

        cs += out.az * DEG2RAD + out.el * DEG2RAD + out.rng;
      }

      return cs;
    },
    dopplerFactor: () => {
      let cs = 0;

      for (const { pos, vel } of posVelPairs) {
        cs += dopplerFactor(obsEcf, pos, vel);
      }

      return cs;
    },
  };

  let sats = [];
  let observer;

  e2eSetup = () => {
    observer = new GroundObject(OBSERVER);
    sats = tles.map(({ line1, line2 }) => {
      try {
        const sat = new Satellite({ tle1: line1, tle2: line2 });

        return sat.satrec.error === 0 ? sat : null;
      } catch {
        return null;
      }
    }).filter((sat) => sat !== null);

    return sats.length;
  };
  e2eRun = () => {
    let checksum = 0;
    let errors = 0;

    for (const sat of sats) {
      const rae = observer.rae(sat, E2E_DATE);

      if (rae) {
        checksum += rae.az * DEG2RAD + rae.el * DEG2RAD;
      } else {
        errors++;
      }
    }

    return { checksum, errors };
  };
} else if (LIB === 'satellite.js') {
  const satellite = await import('satellite.js');

  createSatrec = (l1, l2) => satellite.twoline2satrec(l1, l2);
  sgp4 = (satrec, tsince) => satellite.sgp4(satrec, tsince);

  const obsGd = {
    longitude: OBSERVER.lon * DEG2RAD,
    latitude: OBSERVER.lat * DEG2RAD,
    height: OBSERVER.alt,
  };
  const obsEcf = satellite.geodeticToEcf(obsGd);

  micro = {
    gstime: () => {
      let cs = 0;

      for (const jd of jdVals) {
        cs += satellite.gstime(jd);
      }

      return cs;
    },
    'eci -> ecf': () => {
      let cs = 0;

      for (const vec of eciVecs) {
        const out = satellite.eciToEcf(vec, MICRO_GMST);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'ecf -> eci': () => {
      let cs = 0;

      for (const vec of ecefVecs) {
        const out = satellite.ecfToEci(vec, MICRO_GMST);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'eci -> geodetic': () => {
      let cs = 0;

      for (const vec of eciVecs) {
        const out = satellite.eciToGeodetic(vec, MICRO_GMST);

        cs += out.latitude + out.longitude + out.height;
      }

      return cs;
    },
    'geodetic -> ecf': () => {
      let cs = 0;

      for (const lla of llaRadVecs) {
        const out = satellite.geodeticToEcf(lla);

        cs += out.x + out.y + out.z;
      }

      return cs;
    },
    'ecf -> look angles': () => {
      let cs = 0;

      for (const vec of ecefVecs) {
        const out = satellite.ecfToLookAngles(obsGd, vec);

        cs += out.azimuth + out.elevation + out.rangeSat;
      }

      return cs;
    },
    dopplerFactor: () => {
      let cs = 0;

      for (const { pos, vel } of posVelPairs) {
        cs += satellite.dopplerFactor(obsEcf, pos, vel);
      }

      return cs;
    },
  };

  let e2eSatrecs = [];
  let observerGd;

  e2eSetup = () => {
    observerGd = {
      longitude: satellite.degreesToRadians(OBSERVER.lon),
      latitude: satellite.degreesToRadians(OBSERVER.lat),
      height: OBSERVER.alt,
    };
    e2eSatrecs = tles
      .map(({ line1, line2 }) => satellite.twoline2satrec(line1, line2))
      .filter((satrec) => satrec.error === 0);

    return e2eSatrecs.length;
  };
  // Exactly the reporter's pipeline, including gstime hoisted out of the loop
  e2eRun = () => {
    const gmst = satellite.gstime(E2E_DATE);
    let checksum = 0;
    let errors = 0;

    for (const satrec of e2eSatrecs) {
      const state = satellite.propagate(satrec, E2E_DATE);

      if (state && typeof state.position === 'object') {
        const ecf = satellite.eciToEcf(state.position, gmst);
        const lookAngles = satellite.ecfToLookAngles(observerGd, ecf);

        checksum += lookAngles.azimuth + lookAngles.elevation;
      } else {
        errors++;
      }
    }

    return { checksum, errors };
  };
} else {
  process.stderr.write(`unknown lib: ${LIB}\n`);
  process.exit(1);
}
const now = () => process.hrtime.bigint();
const ms = (t0, t1) => Number(t1 - t0) / 1e6;

// ---- Phase 1: satrec initialization -------------------------------------
const initTimesMs = [];
let satrecs = [];

for (let round = 0; round < INIT_ROUNDS; round++) {
  const roundSatrecs = new Array(tles.length);
  const t0 = now();

  for (let i = 0; i < tles.length; i++) {
    try {
      roundSatrecs[i] = createSatrec(tles[i].line1, tles[i].line2);
    } catch {
      roundSatrecs[i] = null;
    }
  }
  initTimesMs.push(ms(t0, now()));
  satrecs = roundSatrecs;
}

satrecs = satrecs.filter((satrec) => satrec !== null && satrec.error === 0);

// ---- Phase 2: pure SGP4 propagation --------------------------------------
const propagateAll = () => {
  let checksum = 0;
  let errors = 0;

  for (const tsince of TSINCE_OFFSETS) {
    for (const satrec of satrecs) {
      const state = sgp4(satrec, tsince);
      const pos = state?.position;

      if (pos) {
        checksum += pos.x + pos.y + pos.z;
      } else {
        errors++;
      }
    }
  }

  return { checksum, errors };
};

let checksum = 0;
let propErrors = 0;

for (let round = 0; round < PROP_WARMUP_ROUNDS; round++) {
  ({ checksum, errors: propErrors } = propagateAll());
}

const propTimesMs = [];

for (let round = 0; round < PROP_ROUNDS; round++) {
  const t0 = now();
  const result = propagateAll();

  propTimesMs.push(ms(t0, now()));
  checksum = result.checksum;
  propErrors = result.errors;
}

// ---- Phase 3: end-to-end issue #31 scenario -------------------------------
const t0Setup = now();
const e2eCount = e2eSetup();
const e2eSetupMs = ms(t0Setup, now());

let e2eChecksum = 0;
let e2eErrors = 0;

for (let round = 0; round < E2E_WARMUP_ROUNDS; round++) {
  ({ checksum: e2eChecksum, errors: e2eErrors } = e2eRun());
}

const e2eTimesMs = [];

for (let round = 0; round < E2E_ROUNDS; round++) {
  const t0 = now();
  const result = e2eRun();

  e2eTimesMs.push(ms(t0, now()));
  e2eChecksum = result.checksum;
  e2eErrors = result.errors;
}

// ---- Phase 4: overlapping standalone functions -----------------------------
const microTimesMs = {};
const microChecksums = {};

for (const [name, fn] of Object.entries(micro)) {
  for (let round = 0; round < MICRO_WARMUP_ROUNDS; round++) {
    fn();
  }
  const times = [];
  let cs = 0;

  for (let round = 0; round < MICRO_ROUNDS; round++) {
    const t0 = now();

    cs = fn();
    times.push(ms(t0, now()));
  }
  microTimesMs[name] = times;
  microChecksums[name] = cs;
}

process.stdout.write(JSON.stringify({
  lib: LIB,
  node: process.version,
  microN: MICRO_N,
  microTimesMs,
  microChecksums,
  tleCount: tles.length,
  satrecCount: satrecs.length,
  propCallsPerRound: satrecs.length * TSINCE_OFFSETS.length,
  initTimesMs,
  propTimesMs,
  checksum,
  propErrors,
  e2eCount,
  e2eSetupMs,
  e2eTimesMs,
  e2eChecksum,
  e2eErrors,
}));
