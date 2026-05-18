/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../.eslintrc.cjs'],
  parserOptions: {
    // Path relative to monorepo root (where ESLint is invoked by lint-staged)
    project: ['./mobile/tsconfig.json'],
  },
  rules: {
    // Expo Router uses file-based routing which requires default exports
    'import/no-default-export': 'off',
    // TypeScript handles @/ alias resolution; import plugin cannot resolve Expo bundler paths
    'import/no-unresolved': 'off',
    // Module boundary rules apply to backend/frontend layers, not Expo screens
    'boundaries/element-types': 'off',
  },
};
