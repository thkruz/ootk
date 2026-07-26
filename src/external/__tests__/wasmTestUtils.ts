import { existsSync } from 'node:fs';
import { TleLine1, TleLine2 } from '../../types/types';

/**
 * The license-restricted Sgp4Prop artifacts are gitignored; suites that need
 * them skip cleanly when they are absent (e.g. in CI).
 */
export const SGP4_ARTIFACTS_PRESENT = ['Sgp4Prop.js', 'Sgp4Prop.wasm']
  .every((file) => existsSync(new URL(`../${file}`, import.meta.url)));

export const SGP4XP_ARTIFACTS_PRESENT = ['Sgp4Prop.xp.js', 'Sgp4Prop.xp.wasm']
  .every((file) => existsSync(new URL(`../${file}`, import.meta.url)));

/** ISS TLE (epoch: 2024-001 12:00:00 UTC). */
export const ISS_TLE_2024 = {
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1,
  line2: '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2,
  epochDate: new Date(Date.UTC(2024, 0, 1, 12, 0, 0)),
};

/** ISS TLE at a different epoch (distinct satKey in the TLE tree). */
export const ISS_TLE_2020 = {
  line1: '1 25544U 98067A   20049.59954503  .00001714  00000-0  38792-4 0  9993' as TleLine1,
  line2: '2 25544  51.6454 207.5396 0005246  10.7845 349.3392 15.49172904214789' as TleLine2,
};

/** ISS TLE at a third epoch. */
export const ISS_TLE_2022 = {
  line1: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1,
  line2: '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2,
};
