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

async function getOrgId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM organizations WHERE name = 'Acme Corp'",
  );
  return rows[0]!.id;
}

async function getEngineeringTeamId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM teams WHERE name = 'Engineering'",
  );
  return rows[0]!.id;
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

// ─── GET /teams ──────────────────────────────────────────────────────────────

describe('GET /api/v1/teams', () => {
  it('200 — admin gets paginated team list', async () => {
    const res = await request(app)
      .get('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    });
    // Engineering team created by seed
    const names = (res.body.data as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('Engineering');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/teams');
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .get('/api/v1/teams')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /teams ─────────────────────────────────────────────────────────────

describe('POST /api/v1/teams', () => {
  it('201 — admin creates team with valid body', async () => {
    const orgId = await getOrgId();
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'DevOps', organizationId: orgId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'DevOps', organizationId: orgId });
    expect(res.body.id).toBeTruthy();
  });

  it('400 — missing name', async () => {
    const orgId = await getOrgId();
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: orgId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('400 — missing organizationId', async () => {
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NoOrg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('401 — unauthenticated', async () => {
    const orgId = await getOrgId();
    const res = await request(app)
      .post('/api/v1/teams')
      .send({ name: 'Ghost', organizationId: orgId });
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const orgId = await getOrgId();
    const res = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Ghost', organizationId: orgId });
    expect(res.status).toBe(403);
  });
});

// ─── GET /teams/:id ──────────────────────────────────────────────────────────

describe('GET /api/v1/teams/:id', () => {
  it('200 — admin gets existing team', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(teamId);
    expect(res.body.name).toBe('Engineering');
  });

  it('404 — non-existent team', async () => {
    const res = await request(app)
      .get('/api/v1/teams/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app).get(`/api/v1/teams/${teamId}`);
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /teams/:id ────────────────────────────────────────────────────────

describe('PATCH /api/v1/teams/:id', () => {
  it('200 — admin updates team name', async () => {
    const orgId = await getOrgId();
    const created = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'BeforeTeam', organizationId: orgId });

    const res = await request(app)
      .patch(`/api/v1/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AfterTeam' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('AfterTeam');
  });

  it('404 — non-existent team', async () => {
    const res = await request(app)
      .patch('/api/v1/teams/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app).patch(`/api/v1/teams/${teamId}`).send({ name: 'Ghost' });
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /teams/:id ───────────────────────────────────────────────────────

describe('DELETE /api/v1/teams/:id', () => {
  it('204 — admin deletes team', async () => {
    const orgId = await getOrgId();
    const created = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete', organizationId: orgId });

    const res = await request(app)
      .delete(`/api/v1/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  it('404 — non-existent team', async () => {
    const res = await request(app)
      .delete('/api/v1/teams/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const teamId = await getEngineeringTeamId();
    const res = await request(app).delete(`/api/v1/teams/${teamId}`);
    expect(res.status).toBe(401);
  });
});
