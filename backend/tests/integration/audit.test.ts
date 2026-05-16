import 'express-async-errors';
import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestDb, teardownTestDb, cleanTables, pool } from './setup.js';
import { createApp } from '../../src/app.js';
import { buildCompositionRoot } from '../../src/composition-root.js';

let app: Express;
let adminToken: string;
let viewerToken: string;

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return (res.body as { accessToken: string }).accessToken;
}

beforeAll(async () => {
  await setupTestDb();
  const expressApp = createApp();
  const { router } = buildCompositionRoot(pool);
  expressApp.use('/api/v1', router);
  const { errorMiddleware } = await import('../../src/core/middleware/error.middleware.js');
  const { notFoundMiddleware } = await import('../../src/core/middleware/not-found.middleware.js');
  expressApp.use(notFoundMiddleware);
  expressApp.use(errorMiddleware);
  app = expressApp;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanTables();
  adminToken = await loginAs('admin@mdm.local', 'admin123');
  viewerToken = await loginAs('viewer@mdm.local', 'password123');
});

// ─── GET /audit ───────────────────────────────────────────────────────────────

describe('GET /api/v1/audit', () => {
  it('200 — admin sees audit entries (login events from beforeEach)', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    });
    // loginAs calls above generate at least one 'login' event
    expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('200 — returns correct shape per entry', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const first = (res.body.data as Array<Record<string, unknown>>)[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      action: expect.any(String),
      entityType: expect.any(String),
    });
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/audit');
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── GET /audit after a mutation ──────────────────────────────────────────────

describe('GET /api/v1/audit — after org creation mutation', () => {
  it('shows audit entry with action=create and entityType=organization', async () => {
    // Perform a mutation to generate an audit entry
    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AuditTestOrg' });

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entries = res.body.data as Array<{ action: string; entityType: string }>;
    const orgCreate = entries.find((e) => e.action === 'create' && e.entityType === 'organization');
    expect(orgCreate).toBeDefined();
  });
});

// ─── Filtering ────────────────────────────────────────────────────────────────

describe('GET /api/v1/audit?entityType=organization', () => {
  it('filters by entityType correctly', async () => {
    // Create an org so there is at least one organization audit entry
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'FilterOrg' });

    const res = await request(app)
      .get('/api/v1/audit?entityType=organization')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entries = res.body.data as Array<{ entityType: string }>;
    expect(entries.length).toBeGreaterThanOrEqual(1);
    for (const entry of entries) {
      expect(entry.entityType).toBe('organization');
    }
  });

  it('401 — unauthenticated filter request', async () => {
    const res = await request(app).get('/api/v1/audit?entityType=organization');
    expect(res.status).toBe(401);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('GET /api/v1/audit?limit=1&offset=0', () => {
  it('returns exactly 1 entry with limit=1', async () => {
    // Ensure there are enough entries by performing a couple of mutations
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PaginationOrg1' });
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PaginationOrg2' });

    const res = await request(app)
      .get('/api/v1/audit?limit=1&offset=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({
      limit: 1,
      offset: 0,
    });
    expect(res.body.pagination.total).toBeGreaterThan(1);
  });

  it('offset moves the window', async () => {
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PaginationOrgA' });
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PaginationOrgB' });

    const page1 = await request(app)
      .get('/api/v1/audit?limit=1&offset=0')
      .set('Authorization', `Bearer ${adminToken}`);
    const page2 = await request(app)
      .get('/api/v1/audit?limit=1&offset=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);

    const id1 = (page1.body.data as Array<{ id: string }>)[0]!.id;
    const id2 = (page2.body.data as Array<{ id: string }>)[0]!.id;
    expect(id1).not.toBe(id2);
  });
});

// ─── Actor-based filtering ────────────────────────────────────────────────────

describe('GET /api/v1/audit?actorUserId=...', () => {
  it('returns only entries for the specified actor', async () => {
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE email = 'admin@mdm.local'",
    );
    const adminId = rows[0]!.id;

    const res = await request(app)
      .get(`/api/v1/audit?actorUserId=${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entries = res.body.data as Array<{ actorUserId: string }>;
    for (const entry of entries) {
      expect(entry.actorUserId).toBe(adminId);
    }
  });
});
