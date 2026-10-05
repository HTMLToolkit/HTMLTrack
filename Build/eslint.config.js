import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import css from '@eslint/css';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'dev-dist/**',
      '.wrangler/**',
      'public/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { react },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['**/*.json'],
    ignores: ['tsconfig*.json', 'package-lock.json'],
    plugins: { json },
    language: 'json/json',
    ...json.configs.recommended,
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    ...markdown.configs.recommended,
  },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    ...css.configs.recommended,
    rules: {
      'css/no-invalid-properties': 'off',
    },
  },
];
