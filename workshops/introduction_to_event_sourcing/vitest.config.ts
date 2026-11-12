import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

const exclude = ['**/node_modules/**', '**/dist/**', '**/lib/**'];

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    hookTimeout: 60_000,
    testTimeout: 30_000,
    ...localMaxWorkers,
    projects: [
      {
        extends: true,
        test: {
          name: 'workshop',
          include: ['src/**/*.test.ts'],
          exclude: [
            ...exclude,
            'src/**/*eventstoredb/**',
            'src/**/postgresql/**',
            'src/**/mongodb/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'eventstoredb',
          include: ['src/**/*eventstoredb/**/*.test.ts'],
          exclude,
          globalSetup: ['./src/core/testing/eventStoreDB/globalSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'postgresql',
          include: ['src/**/postgresql/**/*.test.ts'],
          exclude,
          globalSetup: ['./src/core/testing/postgreSQL/globalSetup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'mongodb',
          include: ['src/**/mongodb/**/*.test.ts'],
          exclude,
          globalSetup: ['./src/core/testing/mongoDB/globalSetup.ts'],
        },
      },
    ],
  },
});
