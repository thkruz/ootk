// eslint-disable-next-line no-undef
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          esmodules: true,
        },
        // modules: "umd", -- THIS IS FOR DOING THE LIB VERSION OF KEEPTRACK
      },
    ],
    '@babel/preset-typescript',
  ],
  compact: 'auto',
};
