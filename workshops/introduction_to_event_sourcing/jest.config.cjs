module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: ['./jest.setup.cjs'],
  moduleNameMapper: {
    '#core/(.*)': '<rootDir>/src/core/$1',
    '#config': '<rootDir>/config.ts',
    '#testing/(.*)': '<rootDir>/src/testing/$1',
  },
};
