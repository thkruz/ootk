# ootk
![build](https://img.shields.io/github/workflow/status/thkruz/ootk/CI?style=flat-square) ![Release](https://img.shields.io/github/v/release/thkruz/ootk?style=flat-square)  ![Issues](https://img.shields.io/github/issues/thkruz/ootk?style=flat-square) ![Coverage](https://img.shields.io/codecov/c/github/thkruz/ootk?style=flat-square) [![License](https://img.shields.io/github/license/thkruz/ootk?style=flat-square)](LICENSE.md)

> Orbital Object Tool Kit in Your Web Browser

**ootk** is a modular collection of small libraries for doing math related to orbital objects written in TypeScript. ootk was developed to simplify the math and let you focus on using the results.

## Table of Contents
- [Installation](#Installation)
- [Usage](#Usage)
- [Contributing](#Contributing)
- [Building](#Building)
- [Contributors](#Contributors)
- [License](#License)

## Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm install ootk
```

## Usage

### Common.js ([Node.js](https://nodejs.org))

```js
var ootk = require('ootk.js');
...
var positionAndVelocity = ootk.Sgp4.propagate(satrec, time);
```

### ES ([Babel.js](https://babeljs.io/))

```js
import { ootk } from 'ootk.es.js';
...
const positionAndVelocity = ootk.Sgp4.propagate(satrec, time);
```

### Script tag

Include `dist/ootk.min.js` as a script in your html:

```html
<script src="path/to/dist/ootk.min.js"></script>
```

`ootk` object will be available in global scope:

```js
var positionAndVelocity = ootk.Sgp4.propagate(satrec, time);
```

## Building

The source code is organized as Common.js modules and uses [ES6 syntax](http://es6-features.org/). To build the library:

1. Install [Node.js](https://nodejs.org/) and [Node Package Manager](https://www.npmjs.com/);

2. Install all required packages with NPM by running the following command from repository's root directory:

    ```bash
    npm install
    ```

3. Run the following NPM script to build everything:

    ```bash
    npm run build:umd
    ```

## NPM Scripts

- `build` compiles TypeScript into ES6 Modules
- `build:umd` compiles TypeScript into ES6 Modules and generates UMD files
- `lint` lints source code located in `src` directory with [ESLint](http://eslint.org/)
- `lint:fix` lints tests located in `src` directory with ESLint and attempts to auto-fix errors
- `lint:test` lints tests located in `test` directory with ESLint
- `test` runs jest to verify code remains functional
- `test:coverage` generates lcov report to view code coverage

## Contributing

This repo follows [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).

Before starting a work on new [pull request](https://github.com/thkruz/sgp4-js/compare), please, checkout your feature or bugfix branch from `develop` branch:

```bash
git checkout develop
git fetch origin
git merge origin/develop
git checkout -b my-feature
```

Make sure that your changes don't break the existing code by running:

```bash
npm test
```

Check that your code follows the rules established in eslint.rc:

```bash
npm run lint
```

Use [commitzen](https://github.com/commitizen/cz-cli) to format your commit messages:

```bash
git cz
```

## Contributors

This whole project is an example of standing on the shoulder's of giants. None of it would have been possible without the previous work of the following:

- [ezze (Dmitriy Pushkov)](https://github.com/ezze)
- [davidcalhoun (David Calhoun)](https://github.com/davidcalhoun)
- [shashwatak (Shashwat Kandadai)](https://github.com/shashwatak)
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
