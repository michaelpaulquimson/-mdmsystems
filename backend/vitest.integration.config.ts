import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env['DATABASE_URL_TEST'] ??
        'postgres://mdm_test:mdm_test_password@localhost:5433/mdmsystems_test',
      JWT_SECRET: 'test_jwt_secret_at_least_32_chars_long',
      BACKEND_PORT: '4001',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'error',
      BCRYPT_ROUNDS: '4',
      METRICS_TOKEN: '',
    },
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@mdm/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
