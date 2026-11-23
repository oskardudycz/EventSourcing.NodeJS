import { defineConfig } from 'vitest/config';

export const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    ...localMaxWorkers,
  },
});
