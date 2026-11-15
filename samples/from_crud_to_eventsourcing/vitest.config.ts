import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

const exclude = ['**/node_modules/**', '**/dist/**', '**/lib/**'];

const postgreSQLTests = ['src/**/*.int.test.ts', 'src/**/*.e2e.test.ts'];

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 180_000,
    fileParallelism: false,
    ...localMaxWorkers,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...exclude, ...postgreSQLTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'postgresql',
          include: postgreSQLTests,
          exclude,
          globalSetup: ['./src/testing/postgreSQL/globalSetup.ts'],
        },
      },
    ],
  },
});
