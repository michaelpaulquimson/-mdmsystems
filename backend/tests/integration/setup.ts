import { Pool } from 'pg';

import { migrate } from '../../src/core/db/migrate.js';
import { seed } from '../../src/core/db/seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL_TEST'] ?? 'postgresql://mdm:mdm@localhost:5433/mdm_test';

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
  // Re-insert static roles (mirroring 002_seed_roles.sql — truncated above)
  await pool.query(`
    INSERT INTO roles (name, permissions) VALUES
      ('Viewer', '["content:read"]'::jsonb),
      ('Editor', '["content:read","content:create","content:update","content:delete"]'::jsonb)
    ON CONFLICT (name) DO NOTHING
  `);
  // Re-seed dynamic data (users, org, team, content)
  await seed(pool);
}
