import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ootk',
  description: 'Orbital Object Toolkit - satellite propagation, orbit determination, sensors, and maneuver planning in TypeScript',
  // Served at the root of the custom domain (ootk.kruczeklabs.com), so base is
  // '/'. If you ever drop the custom domain and serve at thkruz.github.io/ootk/,
  // change this back to '/ootk/'.
  base: '/',
  // README.md stays for GitHub folder browsing; index.md is the site home
  srcExclude: ['README.md'],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Changelog', link: 'https://github.com/thkruz/ootk/blob/main/CHANGELOG.md' },
    ],
    sidebar: {
      '/': [
        {
          text: 'Guides',
          items: [
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'User Guide', link: '/user-guide' },
            { text: 'Advanced Features', link: '/advanced-features-guide' },
            { text: 'Lambert & Satellite Integration', link: '/lambert-satellite-integration-guide' },
          ],
        },
        {
          text: 'Examples',
          link: '/examples/',
          items: [
            { text: 'Orbital Elements', link: '/examples/orbital-elements' },
            { text: 'Coordinate Transforms', link: '/examples/coordinate-transforms' },
            { text: 'Time Systems', link: '/examples/time-systems' },
            { text: 'Satellite Passes', link: '/examples/satellite-passes' },
            { text: 'Sensors', link: '/examples/sensor' },
            { text: 'Observations', link: '/examples/observations' },
            { text: 'Doppler Shift', link: '/examples/doppler' },
            { text: 'Numerical Integrators', link: '/examples/integrator' },
            { text: 'Initial Orbit Determination', link: '/examples/iod' },
            { text: 'Gooding IOD', link: '/examples/gooding-iod' },
            { text: 'Lambert State Vectors', link: '/examples/lambert-state-vector' },
            { text: 'Maneuvers', link: '/examples/maneuvers' },
            { text: 'Conjunction Assessment', link: '/examples/conjunction-assessment-example' },
            { text: 'Covariance Matrix', link: '/examples/covariance-matrix' },
            { text: 'Sun', link: '/examples/sun' },
            { text: 'Moon', link: '/examples/moon' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/thkruz/ootk' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/ootk' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Copyright (c) 2025-2026 Kruczek Labs LLC',
    },
  },
});
