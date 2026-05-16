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
let editorToken: string;

interface LoginResponse {
  accessToken: string;
  user: { id: string };
}

async function loginAs(email: string, password: string): Promise<LoginResponse> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body as LoginResponse;
}

async function getViewerUserId(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'viewer@mdm.local'",
  );
  return rows[0]!.id;
}

async function getFirstContentId(token: string): Promise<string> {
  const res = await request(app).get('/api/v1/content').set('Authorization', `Bearer ${token}`);
  const data = res.body.data as Array<{ id: string }>;
  return data[0]!.id;
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
  const adminLogin = await loginAs('admin@mdm.local', 'admin123');
  adminToken = adminLogin.accessToken;
  const viewerLogin = await loginAs('viewer@mdm.local', 'password123');
  viewerToken = viewerLogin.accessToken;
  const editorLogin = await loginAs('editor@mdm.local', 'password123');
  editorToken = editorLogin.accessToken;
});

// ─── GET /content ────────────────────────────────────────────────────────────

describe('GET /api/v1/content', () => {
  it('200 — viewer (has content:read) gets paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/content')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array),
      pagination: expect.any(Object),
    });
    // Seed creates 3 content items for Acme Corp — viewer can see them
    expect((res.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('200 — editor gets content list', async () => {
    const res = await request(app)
      .get('/api/v1/content')
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: expect.any(Array) });
  });

  it('200 — admin gets content list (all orgs)', async () => {
    const res = await request(app)
      .get('/api/v1/content')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: expect.any(Array) });
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app).get('/api/v1/content');
    expect(res.status).toBe(401);
  });

  it('org-scoping — viewer only sees Acme Corp content', async () => {
    const res = await request(app)
      .get('/api/v1/content')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    const orgIds = new Set(
      (res.body.data as Array<{ organizationId: string }>).map((c) => c.organizationId),
    );

    // All returned items must belong to the viewer's org (Acme Corp)
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM organizations WHERE name = 'Acme Corp'",
    );
    const acmeId = rows[0]!.id;
    for (const id of orgIds) {
      expect(id).toBe(acmeId);
    }
  });
});

// ─── GET /content/assigned/:userId ───────────────────────────────────────────

describe('GET /api/v1/content/assigned/:userId', () => {
  it('200 — viewer gets content assigned to themselves', async () => {
    const userId = await getViewerUserId();
    const res = await request(app)
      .get(`/api/v1/content/assigned/${userId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Seed assigns "Q1 Onboarding Guide" to viewer
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('200 — admin gets content assigned to viewer', async () => {
    const userId = await getViewerUserId();
    const res = await request(app)
      .get(`/api/v1/content/assigned/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('404 — non-existent userId', async () => {
    const res = await request(app)
      .get('/api/v1/content/assigned/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const userId = await getViewerUserId();
    const res = await request(app).get(`/api/v1/content/assigned/${userId}`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /content ───────────────────────────────────────────────────────────

describe('POST /api/v1/content', () => {
  it('201 — editor creates content item', async () => {
    const res = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'New Guide', body: 'Content body here.' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'New Guide', body: 'Content body here.' });
    expect(res.body.id).toBeTruthy();
  });

  it('403 — viewer has no content:create permission', async () => {
    const res = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Forbidden Guide', body: 'Should not create.' });

    expect(res.status).toBe(403);
  });

  it('400 — missing title', async () => {
    const res = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ body: 'No title provided.' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('401 — unauthenticated', async () => {
    const res = await request(app)
      .post('/api/v1/content')
      .send({ title: 'Ghost', body: 'Ghost body.' });
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /content/:id ──────────────────────────────────────────────────────

describe('PATCH /api/v1/content/:id', () => {
  it('200 — editor updates content item', async () => {
    const contentId = await getFirstContentId(editorToken);
    const res = await request(app)
      .patch(`/api/v1/content/${contentId}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  it('403 — viewer has no content:update permission', async () => {
    const contentId = await getFirstContentId(editorToken);
    const res = await request(app)
      .patch(`/api/v1/content/${contentId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Forbidden Update' });

    expect(res.status).toBe(403);
  });

  it('404 — non-existent content item', async () => {
    const res = await request(app)
      .patch('/api/v1/content/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const contentId = await getFirstContentId(editorToken);
    const res = await request(app).patch(`/api/v1/content/${contentId}`).send({ title: 'Ghost' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /content/:id ─────────────────────────────────────────────────────

describe('DELETE /api/v1/content/:id', () => {
  it('204 — editor deletes content item', async () => {
    // Create a fresh item to avoid cascading state issues
    const created = await request(app)
      .post('/api/v1/content')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ title: 'Deletable', body: 'Delete me.' });

    const res = await request(app)
      .delete(`/api/v1/content/${created.body.id}`)
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(204);
  });

  it('403 — viewer has no content:delete permission', async () => {
    const contentId = await getFirstContentId(editorToken);
    const res = await request(app)
      .delete(`/api/v1/content/${contentId}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — non-existent content item', async () => {
    const res = await request(app)
      .delete('/api/v1/content/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${editorToken}`);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated', async () => {
    const contentId = await getFirstContentId(editorToken);
    const res = await request(app).delete(`/api/v1/content/${contentId}`);
    expect(res.status).toBe(401);
  });
});
