import pg from 'pg';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

const dbUrl =
  env.NODE_ENV === 'test' && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

export const pool = new pg.Pool({
  connectionString: dbUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected pg pool error');
});

export async function connectWithRetry(maxAttempts = 10, delayMs = 1_500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      logger.info('Database connection established');
      return;
    } catch (err) {
      logger.warn({ attempt, maxAttempts, err }, 'DB connection failed, retrying…');
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}
