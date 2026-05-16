import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@mdm/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
