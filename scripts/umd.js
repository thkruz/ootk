const TerserPlugin = require('terser-webpack-plugin');

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
        test: /\.worker\.js$/u,
        use: { loader: 'worker-loader' },
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
      '@src': __dirname + '/../src',
    },
  },
};

let umd = {
  ...config,
  name: 'ootk',
  mode: 'production',
  entry: {
    'ootk': ['./lib/ootk.es.js'],
    'ootk-sgp4': ['./lib/ootk-sgp4.es.js'],
    'ootk-transforms': ['./lib/ootk-transforms.es.js'],
    'ootk-utils': ['./lib/ootk-utils.es.js'],
    'ootk-multi': ['./lib/ootk-multi.es.js'],
  },
  output: {
    filename: '[name].js',
    library: 'Ootk',
    libraryTarget: 'umd',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
    globalObject: 'this',
  },
  optimization: {
    minimize: false,
  },
  stats: 'errors-warnings',
};

let minUmd = {
  ...config,
  name: 'ootk',
  mode: 'production',
  entry: {
    'ootk': ['./lib/ootk.es.js'],
    'ootk-sgp4': ['./lib/ootk-sgp4.es.js'],
    'ootk-transforms': ['./lib/ootk-transforms.es.js'],
    'ootk-utils': ['./lib/ootk-utils.es.js'],
    'ootk-multi': ['./lib/ootk-multi.es.js'],
  },
  output: {
    filename: '[name].min.js',
    library: 'Ootk',
    libraryTarget: 'umd',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
    globalObject: 'this',
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: /@copyright/iu,
          },
        },
        extractComments: false,
      }),
    ],
  },
  stats: 'errors-warnings',
};

let workers = {
  ...config,
  name: 'ootk',
  mode: 'production',
  entry: {
    'ootk-multi': ['./src/ootk-multi.worker.js'],
  },
  output: {
    filename: 'ootk-multi.js',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
    globalObject: 'this',
  },
  optimization: {
    minimize: false,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: /@copyright/iu,
          },
        },
        extractComments: false,
      }),
    ],
  },
  stats: 'errors-warnings',
};

// Return Array of Configurations
// eslint-disable-next-line no-undef
module.exports = [umd, minUmd, workers];
