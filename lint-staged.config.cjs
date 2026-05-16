module.exports = {
  '*.{ts,tsx}': [
    // Filter out config files that are excluded by ESLint ignorePatterns to avoid
    // "File ignored" warnings being treated as errors with --max-warnings 0.
    (files) => {
      const lintable = files.filter(
        (f) => !f.endsWith('vite.config.ts') && !f.includes('tailwind.config'),
      );
      return lintable.length
        ? `eslint --fix --max-warnings 0 ${lintable.join(' ')}`
        : 'echo "No lintable TS files"';
    },
    'prettier --write',
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
