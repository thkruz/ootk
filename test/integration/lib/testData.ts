/**
 * Shared test data for integration tests.
 * Using real TLE data for realistic testing.
 */

// ISS (ZARYA) TLE
export const ISS_TLE = {
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002',
  line2: '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010',
  name: 'ISS (ZARYA)',
};

// Starlink satellite TLE
export const STARLINK_TLE = {
  line1: '1 44713U 19074A   24001.50000000  .00001234  00000-0  12345-4 0  9999',
  line2: '2 44713  53.0000 100.0000 0001234  90.0000 270.0000 15.05000000100000',
  name: 'STARLINK-1007',
};

// Ground station coordinates (Kennedy Space Center)
export const KENNEDY_SPACE_CENTER = {
  lat: 28.5729,
  lon: -80.6490,
  alt: 0.003, // 3 meters in km
  name: 'Kennedy Space Center',
};

// Ground station coordinates (Canberra DSN)
export const CANBERRA_DSN = {
  lat: -35.4014,
  lon: 148.9817,
  alt: 0.550,
  name: 'Canberra DSN',
};
