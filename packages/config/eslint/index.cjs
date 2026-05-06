const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const noBarePrismaRead = require('./rules/no-bare-prisma-read.cjs');
const noNonPublicEnvInFrontend = require('./rules/no-non-public-env-in-frontend.cjs');

const vendorhubPlugin = {
  rules: {
    'no-bare-prisma-read': noBarePrismaRead,
    'no-non-public-env-in-frontend': noNonPublicEnvInFrontend,
  },
};

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      vendorhub: vendorhubPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Frontend apps: forbid non-NEXT_PUBLIC_ env vars in client code (FR-CFG-005).
  {
    files: ['apps/dashboard/src/**/*.ts', 'apps/dashboard/src/**/*.tsx',
            'apps/website/src/**/*.ts',   'apps/website/src/**/*.tsx'],
    plugins: { vendorhub: vendorhubPlugin },
    rules: {
      'vendorhub/no-non-public-env-in-frontend': 'error',
    },
  },
  // Backend: forbid bare Prisma reads outside repository helpers (research R10).
  {
    files: ['apps/backend/src/**/*.ts'],
    ignores: [
      'apps/backend/src/modules/prisma/**',
      'apps/backend/src/modules/common/tenant/**',
      'apps/backend/prisma/**',
    ],
    plugins: { vendorhub: vendorhubPlugin },
    rules: {
      'vendorhub/no-bare-prisma-read': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'vendorhub/no-bare-prisma-read': 'off',
    },
  },
];

module.exports = config;
