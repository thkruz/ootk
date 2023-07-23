import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  testEnvironment: 'node',
  transform: {
    '\\.(js|ts|jsx|tsx)$': 'babel-jest',
  },
  testPathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/lib', '<rootDir>/scripts', '<rootDir>/coverage'],
  transformIgnorePatterns: ['dist', 'scripts', 'coverage'],
  testMatch: ['**/?(*.)+(spec|test).?(m)[jt]s?(x)'],
  moduleFileExtensions: ['js', 'mjs', 'ts'],
  //   setupFiles: [''],
  coverageDirectory: '<rootDir>/coverage',
  moduleDirectories: ['node_modules', 'offline'],
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/scripts/',
    '<rootDir>/test/sgp4/sgp4prop',
  ],
  moduleNameMapper: {
    '^@lib(.*)$': '<rootDir>/lib/$1',
    '^@dist(.*)$': '<rootDir>/dist/$1',
    '^@src(.*)$': '<rootDir>/src/$1',
    '^@test(.*)$': '<rootDir>/test/$1',
  },
  coverageReporters: ['lcov', 'html', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/lib/', '/scripts/', '/coverage/'],
};

export default jestConfig;
