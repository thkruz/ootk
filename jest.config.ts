const jestConfig = {
  testEnvironment: 'node',
  transform: {
    '\\.(js|ts|jsx|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(ootk-core))'],
  testMatch: ['**/test/**/?(*.)+(spec|test).?(m)[jt]s?(x)'],
  moduleFileExtensions: ['js', 'mjs', 'ts'],
  coverageDirectory: '<rootDir>/coverage',
  moduleDirectories: ['node_modules'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  coverageReporters: ['lcov', 'html', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/lib/', '/commonjs/', '/test/', '/scripts/', '/coverage/'],
  globalSetup: '<rootDir>/test/lib/globalSetup.js',
};

export default jestConfig;
