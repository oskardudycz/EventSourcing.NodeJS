import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
  {
    ignores: [
      'vitest.config.ts',
      'vitest.shared.ts',
      'packages/*/vitest.config.ts',
      '**/dist/',
      '**/lib/',
      'node_modules/*',
      '**/node_modules',
      '**/*.d.ts',
      'eslint.config.mjs',
      'eventcatalog/.astro/',
      'eventcatalog/.eventcatalog-core/',
    ],
  },
  js.configs.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  ...typescriptEslint.configs['flat/recommended-type-checked'],
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },

      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },

    rules: {
      'no-unused-vars': 'off',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      '@typescript-eslint/no-misused-promises': ['off'],
      '@typescript-eslint/prefer-namespace-keyword': 'off',

      'no-restricted-imports': [
        'error',
        {
          paths: ['**.spec.ts'],
          patterns: ['node:*'],
        },
      ],
    },
  },
  {
    files: [
      '**/**.spec.ts',
      'packages/**/src/testing/**',
      'packages/application/src/shop/shopPages.tsx',
      'packages/application/src/documentation/contractSnapshotTests.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
