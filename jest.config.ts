const jestConfig = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/test/**/?(*.)+(spec|test).?(m)[jt]s?(x)'],
  moduleFileExtensions: ['js', 'mjs', 'ts'],
  coverageDirectory: '<rootDir>/coverage',
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/test/sgp4/sgp4prop'],
  coverageReporters: ['lcov', 'html', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/lib/', '/commonjs/', '/test/', '/scripts/', '/coverage/'],
  globalSetup: '<rootDir>/test/lib/globalSetup.js',
};

export default jestConfig;
