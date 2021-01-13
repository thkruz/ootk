![GitHub release (latest by date)](https://img.shields.io/github/v/release/thkruz/sgp4-js?style=flat-square)  ![GitHub issues](https://img.shields.io/github/issues/thkruz/sgp4-js?style=flat-square) [![License](https://img.shields.io/github/license/thkruz/sgp4-js?style=flat-square)](LICENSE.md)

# ootk
> Orbital Object Tool Kit in Your Web Browser

## Table of Contents
- [Introduction](#Introduction)
- [Installation](#Installation)
- [Usage](#Usage)
- [Sample Usage](#Sample-Usage)
- [Differences with satellite.js](#differences-with-satellitejs)
- [Contributing](#Contributing)
- [Building](#Building)
- [Exposed Objects](#Exposed-Objects)
- [Exposed Functions](#Exposed-Functions)
- [Contributors](#Contributors)
- [License](#License)

## Introduction

How do we know where a satellite actually is? Well as it turns out, we rarely actually know exactly where it is. What we do know is that space is largely a vacuum and gravity is fairly predicatable! So by propagating out where the satellite was last believed to be and applying adjustments for the gravity pulling the satellite towards the earth (or the moon!) we can come up with a highly accurate guess of where it should be now.

Various [sensors around the world](https://github.com/thkruz/keeptrack.space/) will track these satellites and provide update observations of its last known location. Then the whole cycle of propagating and verifying starts over again.

There are [a few](https://en.wikipedia.org/wiki/Simplified_perturbations_models) methods for propagating a satellite's location. The higher the accuracy the more computational power is required. The most commonly accepted method for simplifying the problem without sacrificing too much accuracy is Simplified General Perturbations 4 (SGP4) - which is actually a merger of SGP4 and Simplified Deep Space Perturbations 4 (SDP4).

The original source code for SGP4 was released in 1988 in FORTRAN IV and has since been ported to [C++](http://www.celestrak.com/publications/aiaa/2006-6753/AIAA-2006-6753.pdf), [Python](https://pypi.python.org/pypi/sgp4/), and many other languages.

In 2013 it was ported from [Python to JavaScript in satellite.js](https://github.com/shashwatak/satellite-js/) and that became the defacto library for many of us (myself included).

In December 2020 I set out to rewrite satellite.js to realign it with the most recent version of sgp4unit.cpp from "Fundamentals of Astrodynamics and Applications" by David Vallado. The goal was to try and bring it as close to the original source code before adding any modifications or improvements for JavaScript. Additionally with the [deprecation of the classic 5 digit satellite number format](https://space.stackexchange.com/questions/46448/tle-on-path-to-be-deprecated-what-is-9-digit), this was an excellent time to add support for the new Alpha-5 format.

## Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm install satellite.js
```

## Usage

### Common.js ([Node.js](https://nodejs.org))

```js
var satellite = require('satellite.js');
...
var positionAndVelocity = satellite.sgp4(satrec, time);
```

### ES ([Babel.js](https://babeljs.io/))

```js
import { sgp4 } from 'satellite.js';
...
const positionAndVelocity = sgp4(satrec, time);
```

### Script tag

Include `dist/satellite.min.js` as a script in your html:

```html
<script src="path/to/dist/satellite.min.js"></script>
```

`satellite` object will be available in global scope:

```js
var positionAndVelocity = satellite.sgp4(satrec, time);
```

## Sample Usage
    
```js
// Sample TLE
var tleLine1 = '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
    tleLine2 = '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442';    

// Initialize a satellite record
var satrec = satellite.twoline2satrec(tleLine1, tleLine2);

//  Propagate satellite using time since epoch (in minutes).
var positionAndVelocity = satellite.sgp4(satrec, timeSinceTleEpochMinutes);

//  Or you can use a JavaScript Date
var positionAndVelocity = satellite.propagate(satrec, new Date());

// The position_velocity result is a key-value pair of ECI coordinates.
// These are the base results from which all other coordinates are derived.
var positionEci = positionAndVelocity.position,
    velocityEci = positionAndVelocity.velocity;

// Set the Observer at 122.03 West by 36.96 North, in RADIANS
var observerGd = {
    longitude: satellite.degreesToRadians(-122.0308),
    latitude: satellite.degreesToRadians(36.9613422),
    height: 0.370
};

// You will need GMST for some of the coordinate transforms.
// http://en.wikipedia.org/wiki/Sidereal_time#Definition
var gmst = satellite.gstime(new Date());

// You can get ECF, Geodetic, Look Angles, and Doppler Factor.
var positionEcf   = satellite.eciToEcf(positionEci, gmst),
    observerEcf   = satellite.geodeticToEcf(observerGd),
    positionGd    = satellite.eciToGeodetic(positionEci, gmst),
    lookAngles    = satellite.ecfToLookAngles(observerGd, positionEcf),
    dopplerFactor = satellite.dopplerFactor(observerCoordsEcf, positionEcf, velocityEcf);

// The coordinates are all stored in key-value pairs.
// ECI and ECF are accessed by `x`, `y`, `z` properties.
var satelliteX = positionEci.x,
    satelliteY = positionEci.y,
    satelliteZ = positionEci.z;

// Look Angles may be accessed by `azimuth`, `elevation`, `range_sat` properties.
var azimuth   = lookAngles.azimuth,
    elevation = lookAngles.elevation,
    rangeSat  = lookAngles.rangeSat;

// Geodetic coords are accessed via `longitude`, `latitude`, `height`.
var longitude = positionGd.longitude,
    latitude  = positionGd.latitude,
    height    = positionGd.height;

//  Convert the RADIANS to DEGREES.
var longitudeDeg = satellite.degreesLong(longitude),
    latitudeDeg  = satellite.degreesLat(latitude);
```

## Differences with satellite.js

For those of you who found this page and are familiar with satellite.js, you are probably wondering if there are any differences between this project and the original. There are some differences and there will continue to be more. The goal is to remove some of the errors in satellite.js and add some of the features that I believe bottlenecked performance.

Currently the satellite.js file included can be substituded 1:1 with the old satellite.js. If you run into any problems, let me know and I will fix them. I am gradually transitioning my own project and this allows me to take advantage of the new features while not breaking legacy calls to satellite.js. If you are new to this library, I highly recommend starting with sgp4.js instead.

### Bug Fixes

* Added support for Alpha-5
* Fixed millisecond issue in invjday
* Corrected gravity constants to use recommended WGS-72 values
* Included support for AFSPC time calculations (see below)
* Fixed parsing errors with nddot and bstar

### Improved Testing

Satellite.js allowed a margin of error in verification of the sgp4 results when comparing them against the gold standard in Revisiting Spacetrack #3. The margin of error, while slight, was caused by incorrect time and gravity constants. For the hobbyist, this doesn't really matter a bunch, but trying to improve performance or correct timing issues it is better if there is no margin of error in the testing.

### Planned Improvements

The main reason I chose to branch off from the satellite.js vs working on correcting the above issues is my plan to use [threads.js](https://github.com/andywer/threads.js/) to add support for webworkers. Rather than focusing on supporting the most platforms, I am focused on improving the performance of this library. The first step in that is adding a benchmarking suite to quickly establish current performance - ideally from the command line. Then optional support for 2-8 webworkers will be added to allow performing multi-threaded calculations.

Additionally, the current SGP4 code was designed to maximize performance on 1970s mainframe computers (seriously!). There are likely many ways that performance can be increased in JavaScript - one of the first was removing the variable declarations from inside the functions to allow recylcing them for those of us who are propagating the whole catalog on a loop.

## Contributing

This repo follows [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).

Before starting a work on new [pull request](https://github.com/thkruz/sgp4-js/compare), please, checkout your feature or bugfix branch from `develop` branch:

```bash
git checkout develop
git fetch origin
git merge origin/develop
git checkout -b my-feature
```

Make sure that your changes don't break the existing code by running

```bash
npm test
```

and that your code follows the rules established in eslint.rc

```bash
npm run lint
```

## Building

The source code is organized as Common.js modules and uses [ES6 syntax](http://es6-features.org/).

In order to build the library follow these steps:

- install [Node.js](https://nodejs.org/) and [Node Package Manager](https://www.npmjs.com/);

- install all required packages with NPM by running the following command from repository's root directory:

    ```bash
    npm install
    ```

- run the following NPM script to build everything:

    ```bash
    npm run build
    ```

These is a full list of all available NPM scripts:

- `build`           builds everything
- `lint`            lints sources code located in `src` directory with [ESLint](http://eslint.org/)
- `lint:test`       lints tests located in `test` directory with ESLint;
- `lint:fix`        lints tests located in `src` directory with ESLint and attempts to auto-fix errors
- `test`            runs tests to verify code remains functional

### ES5 and satellite.min.js

Some people are confused that they can't just download a single satellite.js or satellite.min.js file. That is because satellite.js is not written in plain old JavaScript (ES5) anymore but ported to latter JavaScript versions ES6+.

Only the "src" directory is included in the Git repository, "dist" and "lib" directories are ignored. It's done intentionally to retain the size of the repository as small as possible. A full detailed explanation of why is located [here](https://github.com/shashwatak/satellite-js/issues/80#issuecomment-749225324).

You should install satellite.js with your package manager (npm or yarn) and then find satellite.js and satellite.min.js in node_modules/satellite.js/dist directory.

## Exposed Objects

### satrec

The `satrec` object comes from the original code by Rhodes as well as Vallado. It is immense and complex, but the
most important values it contains are the Keplerian Elements and the other values pulled from the TLEs. I do not
suggest that anybody try to simplify it unless they have absolute understanding of Orbital Mechanics.

- `satnum`      Unique satellite number given in the TLE file.
- `epochyr`     Full four-digit year of this element set's epoch moment.
- `epochdays`   Fractional days into the year of the epoch moment.
- `jdsatepoch`  Julian date of the epoch (computed from `epochyr` and `epochdays`).
- `ndot`        First time derivative of the mean motion (ignored by SGP4).
- `nddot`       Second time derivative of the mean motion (ignored by SGP4).
- `bstar`       Ballistic drag coefficient B* in inverse earth radii.
- `inclo`       Inclination in radians.
- `nodeo`       Right ascension of ascending node in radians.
- `ecco`        Eccentricity.
- `argpo`       Argument of perigee in radians.
- `mo`          Mean anomaly in radians.
- `no`          Mean motion in radians per minute.

## Exposed Functions

### Initialization

```js
var satrec = satellite.twoline2satrec(longstr1, longstr2);
```

returns satrec object, created from the TLEs passed in. The satrec object is vastly complicated, but you don't have
to do anything with it, except pass it around.

NOTE! You are responsible for providing TLEs. [Get your free Space Track account here.](https://www.space-track.org/auth/login)
longstr1 and longstr2 are the two lines of the TLE, properly formatted by NASA and NORAD standards. if you use
Space Track, there should be no problem.

### Propagation

Both `propagate()` and `sgp4()` functions return position and velocity as a dictionary of the form:

```json
{
  "position": { "x" : 1, "y" : 1, "z" : 1 },
  "velocity": { "x" : 1, "y" : 1, "z" : 1 }
}
```

position is in km, velocity is in km/s, both the ECI coordinate frame.

```js
var positionAndVelocity = satellite.propagate(satrec, new Date());
```

Returns position and velocity, given a satrec and the calendar date. Is merely a wrapper for `sgp4()`, converts the
calendar day to Julian time since satellite epoch. Sometimes it's better to ask for position and velocity given
a specific date.

```js
var positionAndVelocity = satellite.sgp4(satrec, timeSinceTleEpochMinutes);
```

Returns position and velocity, given a satrec and the time in minutes since epoch. Sometimes it's better to ask for
position and velocity given the time elapsed since epoch.

### Doppler

You can get the satellites current Doppler factor, relative to your position, using the `dopplerFactor()` function.
Use either ECI or ECF coordinates, but don't mix them.

```js
var dopplerFactor = satellite.dopplerFactor(observer, position, velocity);
```

See the section on Coordinate Transforms to see how to get ECF/ECI/Geodetic coordinates.

### Coordinate Transforms

#### Greenwich Mean Sidereal Time

You'll need to provide some of the coordinate transform functions with your current GMST aka GSTIME. You can use
Julian Day:

```js
var gmst = satellite.gstime(julianDay);
```

or a JavaScript Date:

```js
var gmst = satellite.gstime(new Date());
```

#### Transforms

Most of these are self explanatory from their names. Coords are arrays of three floats EX: [1.1, 1.2, 1.3] in
kilometers. Once again, read the following first.

The coordinate transforms are based off T.S. Kelso's columns:
* [Part I](http://celestrak.com/columns/v02n01/)
* [Part II](http://celestrak.com/columns/v02n02/)
* [Part III](http://celestrak.com/columns/v02n03/)

And the coursework for UC Boulder's ASEN students
* [Coodinate Transforms @ UC Boulder](http://ccar.colorado.edu/ASEN5070/handouts/coordsys.doc)

These four are used to convert between ECI, ECF, and Geodetic, as you need them. ECI and ECF coordinates are in
km or km/s. Geodetic coords are in radians.

```js
var ecfCoords = satellite.eciToEcf(eciCoords, gmst);
```

```js
var eciCoords = satellite.ecfToEci(ecfCoords, gmst);
```

```js
var geodeticCoords = satellite.eciToGeodetic(eciCoords, gmst);
```

```js
var ecfCoords = satellite.geodeticToEcf(geodeticCoords);
```

These function is used to compute the look angle, from your geodetic position to a satellite in ECF coordinates.
Make sure you convert the ECI output from sgp4() and propagate() to ECF first.

```js
var lookAngles = satellite.ecfToLookAngles(observerGeodetic, satelliteEcf);
```

#### Latitude and Longitude

These two functions will return human readable Latitude or Longitude strings (Ex: "125.35W" or "45.565N")
from `geodeticCoords`:

```js
var latitudeStr = satellite.degreesLat(geodeticRadians),
    longitudeStr = satellite.degreesLong(geodeticRadians);
```

## Contributors

This whole project is an example of standing on the shoulder's of giants. None of it would have been possible without the previous work of the following:

- [shashwatak (Shashwat Kandadai)](https://github.com/shashwatak)
- [ezze (Dmitriy Pushkov)](https://github.com/ezze)
- [davidcalhoun (David Calhoun)](https://github.com/davidcalhoun)
- [tikhonovits (Nikos Sagias)](https://github.com/tikhonovits)
- [dangodev (Drew Powers)](https://github.com/dangodev)
- [bakercp (Christopher Baker)](https://github.com/bakercp)
- [kylegmaxwell (Kyle G. Maxwell)](https://github.com/kylegmaxwell)
- [iamthechad (Chad Johnston)](https://github.com/iamthechad)
- [drom (Aliaksei Chapyzhenka)](https://github.com/drom)
- [PeterDaveHello (Peter Dave Hello)](https://github.com/PeterDaveHello)
- [Alesha72003](https://github.com/Alesha72003)
- [nhamer](https://github.com/nhamer)
- [owntheweb](https://github.com/owntheweb)
- [Zigone](https://github.com/Zigone)

## License

In keeping with the tradition of [Shashwat Kandadai's satellite.js](https://github.com/shashwatak/satellite-js/) and [Brandon Rhodes' sgp4](https://pypi.python.org/pypi/sgp4/), I kept this licensed under the [MIT License](LICENSE.md).
