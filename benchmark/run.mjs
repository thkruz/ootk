/**
 * Orchestrates the ootk vs satellite.js SGP4 benchmark.
 *
 * Each trial spawns worker.mjs in a fresh Node process (one library per
 * process) and the run order alternates A/B, B/A, A/B... so neither library
 * benefits from CPU warm-up or thermal drift. Results are pooled across all
 * trials and summarized with median (the headline number), min, and stddev.
 *
 * Usage: node benchmark/run.mjs [trials]   (default 3 trials per library)
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'worker.mjs');
const LIBS = ['ootk', 'satellite.js'];
const trials = Number(process.argv[2] ?? 3);

const runWorker = (lib) => {
  const proc = spawnSync(process.execPath, [WORKER, lib], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (proc.status !== 0) {
    throw new Error(`worker for ${lib} failed:\n${proc.stderr}`);
  }

  return JSON.parse(proc.stdout);
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const stddev = (values) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};

const results = { ootk: [], 'satellite.js': [] };

for (let trial = 0; trial < trials; trial++) {
  // Alternate which library goes first each trial
  const order = trial % 2 ? [...LIBS].reverse() : LIBS;

  for (const lib of order) {
    process.stderr.write(`trial ${trial + 1}/${trials}: ${lib}...\n`);
    results[lib].push(runWorker(lib));
  }
}

// ---- Sanity: both libraries must have done identical work -----------------
const [ootkRef, satRef] = [results.ootk[0], results['satellite.js'][0]];

if (ootkRef.satrecCount !== satRef.satrecCount) {
  process.stderr.write(`WARNING: satrec counts differ (ootk ${ootkRef.satrecCount} vs satellite.js ${satRef.satrecCount})\n`);
}
const checksumDelta = Math.abs(ootkRef.checksum - satRef.checksum) / Math.max(1, Math.abs(satRef.checksum));

if (checksumDelta > 1e-9) {
  process.stderr.write(`WARNING: position checksums diverge (relative delta ${checksumDelta.toExponential(2)}) — the two libraries are NOT computing the same thing\n`);
}
const e2eChecksumDelta = Math.abs(ootkRef.e2eChecksum - satRef.e2eChecksum) / Math.max(1, Math.abs(satRef.e2eChecksum));
const ootkE2eOk = ootkRef.e2eCount - ootkRef.e2eErrors;
const satE2eOk = satRef.e2eCount - satRef.e2eErrors;

/*
 * The success sets legitimately differ: for long-decayed objects propagated
 * months past epoch, ootk flags error 6 and returns null while satellite.js
 * returns garbage positions with error still 0 — so only warn when the sets
 * match but the numbers still diverge.
 */
if (ootkE2eOk === satE2eOk && e2eChecksumDelta > 1e-6) {
  process.stderr.write(`WARNING: e2e look-angle checksums diverge (relative delta ${e2eChecksumDelta.toExponential(2)})\n`);
}

// ---- Report ----------------------------------------------------------------
const PHASE_TIMES = {
  init: (r) => r.initTimesMs,
  prop: (r) => r.propTimesMs,
  e2e: (r) => r.e2eTimesMs,
};
const summarize = (lib, phase) => {
  const times = results[lib].flatMap(PHASE_TIMES[phase]);

  return { med: median(times), min: Math.min(...times), sd: stddev(times), times };
};

const fmt = (n, digits = 2) => n.toFixed(digits).padStart(9);
const line = (label, ootkStats, satStats, perCall) => {
  const ratioLabel = `${(ootkStats.med / satStats.med).toFixed(2)}x`;

  process.stdout.write(
    `${label.padEnd(22)}${fmt(ootkStats.med)}${fmt(satStats.med)}  ${ratioLabel.padStart(7)}\n` +
    `${''.padEnd(22)}${fmt(ootkStats.min)}${fmt(satStats.min)}  (min)\n` +
    `${''.padEnd(22)}${fmt(ootkStats.sd)}${fmt(satStats.sd)}  (stddev)\n`,
  );
  if (perCall) {
    const perOotk = (ootkStats.med * 1e6) / perCall;
    const perSat = (satStats.med * 1e6) / perCall;

    process.stdout.write(`${'  per call (ns)'.padEnd(22)}${fmt(perOotk, 0)}${fmt(perSat, 0)}\n`);
  }
};

process.stdout.write('\n');
process.stdout.write(`SGP4 benchmark — node ${ootkRef.node}, ${ootkRef.tleCount} TLEs, ${ootkRef.satrecCount} valid satrecs\n`);
process.stdout.write(`${trials} trials/lib, fresh process per trial, ${ootkRef.propCallsPerRound} sgp4 calls per propagation round\n`);
process.stdout.write(`checksum parity: relative delta ${checksumDelta.toExponential(2)} (ootk errors: ${ootkRef.propErrors}, satellite.js errors: ${satRef.propErrors})\n\n`);
process.stdout.write(`${'(median ms)'.padEnd(22)}${'ootk'.padStart(9)}${'sat.js'.padStart(9)}  ${'ratio'.padStart(7)}\n`);
process.stdout.write(`${'-'.repeat(50)}\n`);

line('init (satrec create)', summarize('ootk', 'init'), summarize('satellite.js', 'init'));
process.stdout.write('\n');
line('propagate (per round)', summarize('ootk', 'prop'), summarize('satellite.js', 'prop'), ootkRef.propCallsPerRound);
process.stdout.write('\n');
line('e2e issue #31 (round)', summarize('ootk', 'e2e'), summarize('satellite.js', 'e2e'), ootkRef.e2eCount);
process.stdout.write(
  `\ne2e: ${ootkRef.e2eCount} look angles/round from one site at one instant\n` +
  `e2e successes: ootk ${ootkE2eOk}, satellite.js ${satE2eOk} ` +
  '(satellite.js returns garbage for long-decayed objects instead of erroring; ootk nulls them)\n' +
  `e2e look-angle checksum relative delta: ${e2eChecksumDelta.toExponential(2)}\n` +
  `e2e setup (issue's prep code): ootk ${ootkRef.e2eSetupMs.toFixed(0)} ms (new Satellite[]), ` +
  `satellite.js ${satRef.e2eSetupMs.toFixed(0)} ms (twoline2satrec[])\n`,
);
// ---- Overlapping standalone functions --------------------------------------
process.stdout.write(`\noverlapping functions (${ootkRef.microN} calls/round, median ns/call)\n`);
process.stdout.write(`${'-'.repeat(64)}\n`);
process.stdout.write(`${'function'.padEnd(22)}${'ootk'.padStart(9)}${'sat.js'.padStart(9)}  ${'ratio'.padStart(7)}  parity\n`);

let anyMismatch = false;

for (const name of Object.keys(ootkRef.microTimesMs)) {
  const perCall = (lib) => {
    const times = results[lib].flatMap((r) => r.microTimesMs[name]);

    return (median(times) * 1e6) / ootkRef.microN;
  };
  const ootkNs = perCall('ootk');
  const satNs = perCall('satellite.js');
  const ratioLabel = `${(ootkNs / satNs).toFixed(2)}x`;
  const parityDelta = Math.abs(ootkRef.microChecksums[name] - satRef.microChecksums[name]) /
    Math.max(1, Math.abs(satRef.microChecksums[name]));
  const parityLabel = parityDelta < 1e-6 ? 'match' : `Δ ${parityDelta.toExponential(1)} *`;

  anyMismatch ||= parityDelta >= 1e-6;
  process.stdout.write(`${name.padEnd(22)}${fmt(ootkNs, 0)}${fmt(satNs, 0)}  ${ratioLabel.padStart(7)}  ${parityLabel}\n`);
}
if (anyMismatch) {
  process.stdout.write('* checksums differ beyond float noise — inspect whether the two functions use different conventions\n');
}

process.stdout.write('\nratio > 1.00x means ootk is slower than satellite.js\n');
