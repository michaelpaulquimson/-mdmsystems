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

async function getViewerUserId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'viewer@mdm.local'",
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

// ─── GET /users ───────────────────────────────────────────────────────────────

describe('GET /api/v1/users', () => {
  it('200 — admin gets list (viewer + editor from seed)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    });
    const emails = (res.body.data as Array<{ email: string }>).map((u) => u.email);
    expect(emails).toContain('viewer@mdm.local');
    expect(emails).toContain('editor@mdm.local');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /users ──────────────────────────────────────────────────────────────

describe('POST /api/v1/users', () => {
  it('201 — admin creates user with valid body', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newuser@mdm.local',
        name: 'New User',
        password: 'Secur3Pass',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'newuser@mdm.local',
      name: 'New User',
      isAdmin: false,
    });
    expect(res.body.id).toBeTruthy();
  });

  it('400 — weak password (no number)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'weakpass@mdm.local',
        name: 'Weak Pass',
        password: 'nosecret',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('400 — password too short', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'short@mdm.local',
        name: 'Short Pass',
        password: 'a1b',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('400 — invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'not-an-email',
        name: 'Bad Email',
        password: 'Secur3Pass',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ email: 'ghost@mdm.local', name: 'Ghost', password: 'Secur3Pass' });
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'ghost@mdm.local', name: 'Ghost', password: 'Secur3Pass' });
    expect(res.status).toBe(403);
  });
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('200 — admin gets existing user', async () => {
    const userId = await getViewerUserId();
    const res = await request(app)
      .get(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe('viewer@mdm.local');
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const userId = await getViewerUserId();
    const res = await request(app).get(`/api/v1/users/${userId}`);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /users/:id ────────────────────────────────────────────────────────

describe('PATCH /api/v1/users/:id', () => {
  it('200 — admin updates name', async () => {
    const userId = await getViewerUserId();
    const res = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const userId = await getViewerUserId();
    const res = await request(app).patch(`/api/v1/users/${userId}`).send({ name: 'Ghost' });
    expect(res.status).toBe(401);
  });

  it('403 — viewer (non-admin)', async () => {
    const userId = await getViewerUserId();
    const res = await request(app)
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /users/:id ───────────────────────────────────────────────────────

describe('DELETE /api/v1/users/:id', () => {
  it('204 — admin deletes user', async () => {
    // Create a disposable user first
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'todelete@mdm.local',
        name: 'To Delete',
        password: 'Secur3Pass',
      });

    const res = await request(app)
      .delete(`/api/v1/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  it('404 — non-existent user', async () => {
    const res = await request(app)
      .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const userId = await getViewerUserId();
    const res = await request(app).delete(`/api/v1/users/${userId}`);
    expect(res.status).toBe(401);
  });
});
