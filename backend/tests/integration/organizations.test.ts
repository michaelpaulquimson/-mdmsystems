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

describe('GET /api/v1/organizations', () => {
  it('200 — returns list for admin', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: expect.any(Array), pagination: expect.any(Object) });
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/organizations');
    expect(res.status).toBe(401);
  });

  it('403 — non-admin viewer', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/organizations', () => {
  it('201 — creates org', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Org' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Org');
    expect(res.body.id).toBeTruthy();
  });

  it('400 — validation fails for empty name', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).post('/api/v1/organizations').send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('403 — non-admin', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/organizations/:id', () => {
  it('200 — returns org', async () => {
    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Lookup Org' });

    const res = await request(app)
      .get(`/api/v1/organizations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Lookup Org');
  });

  it('404 — missing org', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/organizations/:id', () => {
  it('200 — updates org', async () => {
    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Before' });

    const res = await request(app)
      .patch(`/api/v1/organizations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'After' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('After');
  });
});

describe('DELETE /api/v1/organizations/:id', () => {
  it('204 — deletes org', async () => {
    const created = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'To Delete' });

    const res = await request(app)
      .delete(`/api/v1/organizations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const get = await request(app)
      .get(`/api/v1/organizations/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(404);
  });
});
