require('webpack');
const ThreadsPlugin = require('threads-plugin');
var rimraf = require('rimraf');

console.log(`Removing ./dist...`);
try {
  rimraf.sync('./dist');
} catch (error) {
  // Intentionally left blank
}

let config = {
  module: {
    rules: [
      {
        test: /\.m?js$/u,
        // eslint-disable-next-line prefer-named-capture-group
        exclude: /(node_modules|bower_components)/u,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.html$/iu,
        loader: 'html-loader',
      },
    ],
  },
  resolve: {
    alias: {
      // eslint-disable-next-line no-path-concat, no-undef
      '@app': __dirname + '/../src',
    },
  },
  output: {
    filename: '[name].js',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
  },
};

let testFiles = {
  ...config,
  name: 'testFiles',
  mode: 'production',
  entry: {
    benchmark: ['./test/performance/entry.js'],
  },
  output: {
    filename: '[name].js',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
  },
  optimization: {
    minimize: false,
  },
  plugins: [new ThreadsPlugin()],
  stats: 'errors-warnings',
};

let minSizeFiles = {
  ...config,
  name: 'minSizeFiles',
  mode: 'production',
  entry: {
    'sgp4.min': ['./src/export/sgp4.js'],
    'satellite.min': ['./src/export/satellite.js'],
  },
  optimization: {
    minimize: true,
  },
  stats: 'errors-warnings',
};

let fullSizeFiles = {
  ...config,
  name: 'fullSizeFiles',
  mode: 'production',
  entry: {
    sgp4: ['./src/export/sgp4.js'],
    satellite: ['./src/export/satellite.js'],
  },
  optimization: {
    minimize: false,
  },
  stats: 'errors-warnings',
};

// Return Array of Configurations
// eslint-disable-next-line no-undef
module.exports = [minSizeFiles, fullSizeFiles, testFiles];
