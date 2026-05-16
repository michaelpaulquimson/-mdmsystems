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

async function getViewerRoleId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'Viewer'");
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

// ─── GET /roles ───────────────────────────────────────────────────────────────

describe('GET /api/v1/roles', () => {
  it('200 — admin gets list (Viewer + Editor from seed)', async () => {
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    });
    const names = (res.body.data as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain('Viewer');
    expect(names).toContain('Editor');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/roles');
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /roles ──────────────────────────────────────────────────────────────

describe('POST /api/v1/roles', () => {
  it('201 — admin creates role with permissions', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TestRole', permissions: ['content:read'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'TestRole',
      permissions: ['content:read'],
    });
    expect(res.body.id).toBeTruthy();
  });

  it('400 — missing name', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: ['content:read'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/v1/roles').send({ name: 'Ghost', permissions: [] });
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Ghost', permissions: [] });
    expect(res.status).toBe(403);
  });
});

// ─── GET /roles/:id ───────────────────────────────────────────────────────────

describe('GET /api/v1/roles/:id', () => {
  it('200 — admin gets existing role', async () => {
    const roleId = await getViewerRoleId();
    const res = await request(app)
      .get(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(roleId);
    expect(res.body.name).toBe('Viewer');
  });

  it('404 — non-existent role', async () => {
    const res = await request(app)
      .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const roleId = await getViewerRoleId();
    const res = await request(app).get(`/api/v1/roles/${roleId}`);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /roles/:id ────────────────────────────────────────────────────────

describe('PATCH /api/v1/roles/:id', () => {
  it('200 — admin updates permissions array', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'MutableRole', permissions: ['content:read'] });

    const res = await request(app)
      .patch(`/api/v1/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: ['content:read', 'content:update'] });

    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual(
      expect.arrayContaining(['content:read', 'content:update']),
    );
  });

  it('200 — admin updates name', async () => {
    const roleId = await getViewerRoleId();
    const res = await request(app)
      .patch(`/api/v1/roles/${roleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'RenamedViewer' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('RenamedViewer');
  });

  it('404 — non-existent role', async () => {
    const res = await request(app)
      .patch('/api/v1/roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const roleId = await getViewerRoleId();
    const res = await request(app).patch(`/api/v1/roles/${roleId}`).send({ name: 'Ghost' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /roles/:id ───────────────────────────────────────────────────────

describe('DELETE /api/v1/roles/:id', () => {
  it('204 — admin deletes role', async () => {
    const created = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete', permissions: [] });

    const res = await request(app)
      .delete(`/api/v1/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  it('404 — non-existent role', async () => {
    const res = await request(app)
      .delete('/api/v1/roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const roleId = await getViewerRoleId();
    const res = await request(app).delete(`/api/v1/roles/${roleId}`);
    expect(res.status).toBe(401);
  });
});
