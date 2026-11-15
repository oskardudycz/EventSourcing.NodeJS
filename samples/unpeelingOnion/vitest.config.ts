import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

const exclude = ['**/node_modules/**', '**/dist/**', '**/lib/**'];

const mongoDBTests = [
  'src/**/*.int.test.ts',
  'src/**/*.api.test.ts',
  'src/**/*.e2e.test.ts',
];

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 180_000,
    ...localMaxWorkers,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...exclude, ...mongoDBTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'mongodb',
          include: mongoDBTests,
          exclude,
          globalSetup: ['./src/testing/mongoDB/globalSetup.ts'],
        },
      },
    ],
  },
});
