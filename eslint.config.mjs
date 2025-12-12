import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

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
  // Next.js rules (flat config)
  (nextPlugin.flatConfig && nextPlugin.flatConfig.coreWebVitals) ? nextPlugin.flatConfig.coreWebVitals : nextPlugin.configs.recommended,
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
