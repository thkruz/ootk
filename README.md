# ootk

[![build](https://img.shields.io/github/workflow/status/thkruz/ootk/CI?style=flat-square)](https://github.com/thkruz/ootk/actions?query=workflow%3ACI) ![Size](https://img.shields.io/github/languages/code-size/thkruz/ootk?style=flat-square) [![Release](https://img.shields.io/github/v/release/thkruz/ootk?style=flat-square)](https://www.npmjs.com/package/ootk) [![Issues](https://img.shields.io/github/issues/thkruz/ootk?style=flat-square)](https://github.com/thkruz/ootk/issues) [![Coverage](https://img.shields.io/codecov/c/github/thkruz/ootk?style=flat-square)](https://codecov.io/gh/thkruz/ootk) [![License](https://img.shields.io/github/license/thkruz/ootk?style=flat-square)](LICENSE.MD)

> An Orbital Object Toolkit in Your Web Browser

**ootk** is a modular collection of small libraries for doing math related to orbital objects written in TypeScript. ootk was developed to simplify the math and let you focus on using the results.

## :blue_book: Table of Contents

- [Installation](#Installation)
- [Usage](#Usage)
- [Contributing](#Contributing)
- [Building](#Building)
- [Contributors](#Contributors)
- [License](#License)

## :wrench: Installation

Install the library with [NPM](https://www.npmjs.com/):

```bash
npm i ootk
```

## :satellite: Usage

### Common.js ([Node.js](https://nodejs.org))

```js
let Ootk = require('ootk.js');
...
const satrec = Ootk.Sgp4.createSatrec(line1, line2, 'wgs72', 'i');
```

### ES ([Babel.js](https://babeljs.io/))

```js
import * as Ootk from 'ootk.es.js';
...
const satrec = Ootk.Sgp4.createSatrec(line1, line2, 'wgs72', 'i');
```

### Script tag

Include `dist/ootk.js` as a script in your html:

```html
<script src="path/to/dist/ootk.js"></script>
```

`Ootk` object will be available in global scope:

```js
var satrec = Ootk.Sgp4.createSatrec(line1, line2, 'wgs72', 'i');
```

## :desktop_computer: Building

The source code is organized as Common.js modules and uses [ES6 syntax](http://es6-features.org/). To build the library:

1. Install [Node.js](https://nodejs.org/) and [Node Package Manager](https://www.npmjs.com/);

2. Install all required packages with NPM by running the following command from repository's root directory:

   ```bash
   npm install
   ```

3. Run the following NPM script to build everything:

   ```bash
   npm run build
   ```

## :gem: NPM Scripts

- `build` compiles TypeScript into ES6 Modules and combines them into a single file in the `dist` directory.
- `lint` lints source code located in `src` directory with [ESLint](http://eslint.org/)
- `lint:fix` lints tests located in `src` directory with ESLint and attempts to auto-fix errors
- `lint:test` lints tests located in `test` directory with ESLint
- `test` runs jest to verify code remains functional
- `test:coverage` generates lcov report to view code coverage

## :man_teacher: Contributing

This repo follows [Gitflow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).

Before starting a work on new [pull request](https://github.com/thkruz/ootk/compare), please, checkout your feature or bugfix branch from `develop` branch:

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

## :man_scientist: Contributors

This whole project is an example of standing on the shoulder's of giants. None of it would have been possible without the previous work of the following:

- [ezze (Dmitriy Pushkov)](https://github.com/ezze)
- [davidcalhoun (David Calhoun)](https://github.com/davidcalhoun)
- [shashwatak (Shashwat Kandadai)](https://github.com/shashwatak)
- [brandon-rhodes (Brandon Rhodes)](https://github.com/brandon-rhodes)
- [mourner (Volodymyr Agafonkin)](https://github.com/mourner)
- [Hypnos (Robert Gester)](https://github.com/Hypnos3)

## :balance_scale: License

Due to the expanding scope of this project, I have placed the code under the [AGPL License](LICENSE.md) in order to ensure that good ideas can be shared and that the code is open for everyone to use.
