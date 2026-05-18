import { Pool } from 'pg';

import { migrate } from '../../src/core/db/migrate.js';
import { seed } from '../../src/core/db/seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL_TEST'] ??
  'postgresql://mdm_test:mdm_test_password@localhost:5433/mdmsystems_test';

export let pool: Pool;

export async function setupTestDb() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await migrate(pool);
  await seed(pool);
}

export async function teardownTestDb() {
  await pool.end();
}

export async function cleanTables() {
  await pool.query(`
    TRUNCATE TABLE audit_log, refresh_tokens, content_items, users, teams, roles, organizations
    RESTART IDENTITY CASCADE
  `);
  // seed() is the single source of role definitions + dynamic data (users, org, team, content)
  await seed(pool);
}
