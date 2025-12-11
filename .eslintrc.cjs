const path = require('path');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.json'),
    tsconfigRootDir: __dirname,
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', '@next/next'],
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  ignorePatterns: ['*.config.*', 'next.config.ts', 'node_modules/', '.next/', 'dist/', 'coverage/', 'src/app/__tests__/__fixtures__/**/*.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // Desactivado temporalmente
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-unsafe-function-type': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-dupe-else-if': 'off', // Desactivado temporalmente
    'no-console': 'off',
    'prefer-const': 'off', // Desactivado temporalmente
    '@next/next/no-img-element': 'off',
    'react-hooks/exhaustive-deps': 'off', // Desactivado temporalmente
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx,js}'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'prefer-const': 'off',
        'no-console': 'off',
      },
    },
  ],
};
