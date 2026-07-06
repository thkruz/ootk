/**
 * Loads the full-catalog TLE fixtures (real space-track snapshot, ~25k objects)
 * shared with the accuracy tests, so the benchmark exercises the same mix of
 * near-earth and deep-space objects a real consumer would propagate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'sgp4', 'full-catalog');
const FILE_COUNT = 51;

export const loadTles = () => {
  const tles = [];

  for (let i = 0; i < FILE_COUNT; i++) {
    const raw = readFileSync(join(CATALOG_DIR, `TLE_${i}.json`), 'utf8');

    for (const { line1, line2 } of JSON.parse(raw)) {
      // Some fixture entries carry a UTF-8 BOM inside the first line
      tles.push({ line1: line1.replace(/^﻿/u, ''), line2: line2.replace(/^﻿/u, '') });
    }
  }

  return tles;
};
