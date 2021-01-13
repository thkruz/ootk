const TerserPlugin = require('terser-webpack-plugin');

// var rimraf = require('rimraf');

// console.log(`Removing ./dist...`);
// try {
//   rimraf.sync('./dist');
// } catch (error) {
//   // Intentionally left blank
// }

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
};

let umd = {
  ...config,
  name: 'ootk',
  mode: 'production',
  entry: {
    ootk: ['./dist/ootk.es.js'],
  },
  output: {
    filename: '[name].js',
    library: 'ootk',
    libraryTarget: 'umd',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
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
    ootk: ['./dist/ootk.es.js'],
  },
  output: {
    filename: '[name].min.js',
    library: 'ootk',
    libraryTarget: 'umd',
    // eslint-disable-next-line no-path-concat, no-undef
    path: __dirname + '/../dist',
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

// Return Array of Configurations
// eslint-disable-next-line no-undef
module.exports = [umd, minUmd];
