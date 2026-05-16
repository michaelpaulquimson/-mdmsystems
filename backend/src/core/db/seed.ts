import { hash as bcryptHash } from 'bcrypt';
import type { Pool } from 'pg';

import { pool as defaultPool } from './pool.js';
import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

export async function seed(db: Pool = defaultPool): Promise<void> {
  if (env.NODE_ENV === 'production') {
    logger.info('Skipping seed in production');
    return;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: roles } = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM roles',
    );
    const viewerRole = roles.find((r) => r.name === 'Viewer');
    const editorRole = roles.find((r) => r.name === 'Editor');

    const adminHash = await bcryptHash('admin123', env.BCRYPT_ROUNDS);
    const { rows: adminRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['admin@mdm.local', adminHash, 'Admin User'],
    );
    if (!adminRows[0]?.id) {
      // Admin already exists — seed already applied; skip to avoid duplicates
      await client.query('ROLLBACK');
      logger.info('Seed already applied, skipping');
      return;
    }
    const adminId = adminRows[0].id;

    const { rows: orgRows } = await client.query<{ id: string }>(
      `INSERT INTO organizations (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Acme Corp'],
    );
    const orgId = orgRows[0]!.id;

    const { rows: teamRows } = await client.query<{ id: string }>(
      `INSERT INTO teams (name, organization_id) VALUES ($1, $2)
       ON CONFLICT (name, organization_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Engineering', orgId],
    );
    const teamId = teamRows[0]!.id;

    const demoHash = await bcryptHash('password123', env.BCRYPT_ROUNDS);
    const { rows: viewerRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, organization_id, team_id, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['viewer@mdm.local', demoHash, 'Jane Viewer', orgId, teamId, viewerRole?.id ?? null],
    );
    const viewerId = viewerRows[0]?.id ?? null;

    await client.query(
      `INSERT INTO users (email, password_hash, name, organization_id, team_id, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      ['editor@mdm.local', demoHash, 'Ed Editor', orgId, teamId, editorRole?.id ?? null],
    );

    await client.query(
      `INSERT INTO content_items (title, body, organization_id, created_by_user_id, assigned_to_user_id)
       VALUES
         ($1, $2, $3, $4, $5),
         ($6, $7, $3, $4, NULL),
         ($8, $9, $3, $4, NULL)
       ON CONFLICT DO NOTHING`,
      [
        'Q1 Onboarding Guide',
        'Welcome to Acme Corp. This guide covers your first 30 days.',
        orgId,
        adminId,
        viewerId,
        'Security Policy',
        'Our security policy requires 2FA and quarterly password rotation.',
        'Team Handbook',
        'Engineering team norms, on-call rotation, and code review expectations.',
      ],
    );

    await client.query('COMMIT');
    logger.info('Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Allow running as a script
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed()
    .then(() => defaultPool.end())
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
