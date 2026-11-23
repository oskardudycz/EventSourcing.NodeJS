import { defineConfig } from 'vitest/config';
import { localMaxWorkers } from './vitest.shared.ts';

export default defineConfig({
  test: {
    exclude: ['**/lib/**', '**/dist/**'],
    ...localMaxWorkers,
    projects: ['packages/core', 'packages/application'],
  },
});
