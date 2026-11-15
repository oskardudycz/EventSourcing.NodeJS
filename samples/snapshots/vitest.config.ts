import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

const exclude = ['**/node_modules/**', '**/dist/**', '**/lib/**'];

const kurrentDBContainerTests = ['src/testing/kurrentDB/**/*.test.ts'];

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
          include: ['src/**/*.unit.test.ts'],
          exclude,
        },
      },
      {
        extends: true,
        test: {
          name: 'kurrentdb-container',
          include: kurrentDBContainerTests,
          exclude,
        },
      },
      {
        extends: true,
        test: {
          name: 'kurrentdb',
          include: [
            'src/**/*.int.test.ts',
            'src/**/*.api.test.ts',
            'src/**/*.e2e.test.ts',
          ],
          exclude: [...exclude, ...kurrentDBContainerTests],
          globalSetup: ['./src/testing/kurrentDB/globalSetup.ts'],
        },
      },
    ],
  },
});
