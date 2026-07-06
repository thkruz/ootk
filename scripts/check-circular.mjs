/**
 * Circular-dependency ratchet.
 *
 * ootk has a small number of intentional, runtime-safe cycles (mutual
 * conversions between coordinate frames, linear-algebra classes, and epoch
 * types). They are documented in docs/circular-dependencies.md. This gate fails
 * only if the cycle count rises ABOVE the baseline — i.e. a NEW cycle was
 * introduced — while still letting us drive the number down over time.
 *
 * When you remove a cycle, lower BASELINE to match; never raise it without
 * adding the new cycle to the doc and explaining why it is unavoidable.
 */
import madge from 'madge';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASELINE = 9;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rc = JSON.parse(readFileSync(resolve(root, '.madgerc'), 'utf8'));

const result = await madge(resolve(root, 'src/main.ts'), rc);
const cycles = result.circular();
const count = cycles.length;

if (count > BASELINE) {
  console.error(`\n✖ Circular dependencies: ${count} (baseline ${BASELINE}). A NEW import cycle was introduced.\n`);
  cycles.forEach((c, i) => console.error(`${i + 1}) ${c.join(' > ')}`));
  console.error('\nBreak the new cycle. If it is genuinely unavoidable, raise BASELINE in');
  console.error('scripts/check-circular.mjs AND document it in docs/circular-dependencies.md.');
  process.exit(1);
}

if (count < BASELINE) {
  console.log(`✓ Circular dependencies: ${count} (below baseline ${BASELINE}).`);
  console.log(`  Nice — lower BASELINE to ${count} in scripts/check-circular.mjs to lock in the win.`);
  process.exit(0);
}

console.log(`✓ Circular dependencies: ${count} (at baseline, all intentional — see docs/circular-dependencies.md).`);
process.exit(0);
