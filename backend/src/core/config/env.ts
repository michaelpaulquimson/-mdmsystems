import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(12),
  METRICS_TOKEN: z.string().optional(),
});

// Crash at boot with a clear message if any required env var is missing/invalid
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌  Invalid environment configuration:\n', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
