/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./shared/tsconfig.json', './shared/tsconfig.test.json', './backend/tsconfig.json', './backend/tsconfig.test.json', './frontend/tsconfig.json', './e2e/tsconfig.json'],
  },
  plugins: ['@typescript-eslint', 'import', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['shared/tsconfig.json', 'backend/tsconfig.json', 'frontend/tsconfig.json'],
        alwaysTryTypes: true,
      },
    },
    'boundaries/elements': [
      { type: 'shared', pattern: 'shared/src/**/*' },
      { type: 'core', pattern: 'backend/src/core/**/*' },
      { type: 'module', pattern: 'backend/src/modules/*/!(tests)', capture: ['moduleName'] },
      { type: 'feature', pattern: 'frontend/src/features/*/!(*.test.*)', capture: ['featureName'] },
      { type: 'app-shared', pattern: 'frontend/src/shared/**/*' },
    ],
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling']],
        pathGroups: [
          { pattern: '@mdm/shared', group: 'internal', position: 'before' },
          { pattern: '@/core/**', group: 'internal', position: 'after' },
          { pattern: '@/modules/**', group: 'internal', position: 'after' },
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // CommonJS-interop default imports (e.g. jsonwebtoken, bcrypt) are commonly used
    // as namespace objects; named-as-default-member is a style nit, not a bug.
    'import/no-named-as-default-member': 'off',
    // bcrypt and jsonwebtoken are CJS-only packages whose @types don't declare a default
    // export, but esModuleInterop makes the default import work correctly at runtime.
    'import/default': 'off',
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          // modules can import from core and other module barrels (not deep paths)
          {
            from: 'module',
            allow: [
              'shared',
              'core',
              ['module', { moduleName: '!${from.moduleName}' }],
            ],
          },
          // core can import shared and other core files (never modules)
          { from: 'core', allow: ['shared', 'core'] },
          // frontend features can import shared app utilities and other features
          { from: 'feature', allow: ['shared', 'app-shared', 'feature'] },
          // app-shared can import shared package and other app-shared (e.g. ui → lib/utils)
          { from: 'app-shared', allow: ['shared', 'app-shared'] },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'import/no-default-export': 'off',
        'boundaries/element-types': 'off',
      },
    },
    {
      files: ['**/*.cjs', '**/*.mjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['**/*.config.ts', '**/*.config.js'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
    {
      // Mobile workspace: Expo Router requires default exports; TypeScript
      // handles module resolution for @/ aliases so skip import/no-unresolved.
      files: ['mobile/**/*.ts', 'mobile/**/*.tsx'],
      rules: {
        'import/no-default-export': 'off',
        'import/no-unresolved': 'off',
        'boundaries/element-types': 'off',
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', '*.js', 'vite.config.ts', 'tailwind.config.*', 'mobile/'],
};
