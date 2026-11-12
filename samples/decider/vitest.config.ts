import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**'],
    hookTimeout: 180_000,
    testTimeout: 180_000,
    ...localMaxWorkers,
  },
});
