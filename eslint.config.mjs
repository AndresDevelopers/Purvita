import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Project ignores
  {
    ignores: [
      '*.config.*',
      'next.config.ts',
      'node_modules/',
      '.next/',
      'dist/',
      'coverage/',
      'src/app/__tests__/__fixtures__/**/*.js',
    ],
  },
  // Next.js recommended rules (this should work with the plugin detection)
  ...compat.extends('next/core-web-vitals'),
  // TypeScript support
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  // Custom rule adjustments
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: 'useAsyncEffect' }],
    },
  },
  // Targeted overrides
  {
    files: ['src/hooks/use-concurrency-safe.ts'],
    rules: { 'react-hooks/exhaustive-deps': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx,js}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
