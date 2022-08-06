const CopyPlugin = require('copy-webpack-plugin');

const config = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: '**/*.d.ts',
          context: 'lib',
        },
      ],
    }),
  ],
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
    ],
  },
  resolve: {
    alias: {
      // eslint-disable-next-line no-path-concat, no-undef
      '@src': `${__dirname}/../src`,
    },
  },
};

const lib = {
  ...config,
  name: 'ootk',
  mode: 'production',
  entry: {
    ootk: ['./lib/ootk.js'],
  },
  output: {
    filename: '[name].js',
    library: 'Ootk',
    libraryTarget: 'umd',
    // eslint-disable-next-line no-path-concat, no-undef
    path: `${__dirname}/../dist`,
    globalObject: 'this',
  },
  optimization: {
    minimize: true,
  },
  stats: 'errors-warnings',
};

// Return Array of Configurations
// eslint-disable-next-line no-undef
module.exports = [lib];
