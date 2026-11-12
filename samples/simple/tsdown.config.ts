import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  fixedExtension: false,
  target: 'esnext',
  outDir: 'dist',
  entry: ['src/index.ts'],
  sourcemap: true,
  deps: {
    skipNodeModulesBundle: true,
  },
  tsconfig: 'tsconfig.json',
});
