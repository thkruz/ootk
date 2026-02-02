const jestConfig = {
  testEnvironment: 'node',
  maxWorkers: '75%',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@src$': '<rootDir>/src',
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
  testMatch: ['**/test/**/?(*.)+(spec|test).?(m)[jt]s?(x)', '**/__tests__/**/?(*.)+(spec|test).?(m)[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/test/integration/'],
  moduleFileExtensions: ['js', 'mjs', 'ts'],
  coverageDirectory: '<rootDir>/coverage',
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/test/sgp4/sgp4prop', '<rootDir>/test/sgp4/full-catalog'],
  coverageReporters: ['lcov', 'html', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/lib/', '/commonjs/', '/test/', '/scripts/', '/coverage/', '/__tests__/'],
  globalSetup: '<rootDir>/test/lib/globalSetup.js',
};

export default jestConfig;
