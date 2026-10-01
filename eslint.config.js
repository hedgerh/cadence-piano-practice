// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Dependency-direction rules (see docs/architecture.md):
 *   music -> nothing · content -> music · core -> music, content · db -> core
 *   main -> all · renderer -> music, content, shared/ipc only
 * Enforced with core `no-restricted-imports` so no extra plugin is needed.
 */
const noHostImports = [
  { group: ['electron', 'electron/*'], message: 'packages/* must not depend on Electron.' },
  {
    group: ['react', 'react-dom', 'react-dom/*', 'react/*'],
    message: 'packages/* must not depend on React.',
  },
  {
    group: ['node:*', 'fs', 'path', 'os', 'child_process', 'crypto'],
    message: 'packages/* must stay platform-neutral; inject ports instead.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      'docs/handoff/**',
      'packages/db/drizzle/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Plain JS config files are not part of a TS project.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // ---- packages/* boundaries ----
  {
    files: ['packages/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: noHostImports }] },
  },
  {
    files: ['packages/music/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...noHostImports,
            { group: ['@cadence/*'], message: '@cadence/music depends on nothing.' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...noHostImports,
            {
              group: ['@cadence/core', '@cadence/db'],
              message: '@cadence/content may only import @cadence/music.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...noHostImports,
            {
              group: ['@cadence/db'],
              message: '@cadence/core declares ports; @cadence/db implements them.',
            },
          ],
        },
      ],
    },
  },
  // ---- renderer boundaries ----
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'electron/*'],
              message: 'Renderer never imports Electron; use lib/api.ts (window.cadence).',
            },
            {
              group: ['@cadence/db', '@cadence/core'],
              message: 'Renderer talks to the engine over IPC (shared/ipc/contracts.ts).',
            },
            {
              group: ['node:*', 'fs', 'path', 'os', 'child_process'],
              message: 'Renderer is sandboxed; no Node APIs.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/src/{main,preload}/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
