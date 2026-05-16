import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { Pool } from 'pg';

import { pool as defaultPool } from './pool.js';
import { logger } from '../logger/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function migrate(db: Pool = defaultPool): Promise<void> {
  const client = await db.connect();
  try {
    // Disable statement timeout for DDL — index creation on large tables can take > 5s
    await client.query('SET LOCAL statement_timeout = 0');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    VARCHAR(255) PRIMARY KEY,
        checksum    VARCHAR(64)  NOT NULL,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [file],
      );
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
        logger.info({ file }, 'Migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    logger.info('Migrations complete');
  } finally {
    client.release();
  }
}

// Allow running as a script: ts-node src/core/db/migrate.ts
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate()
    .then(() => defaultPool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
