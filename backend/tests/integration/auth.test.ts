import 'express-async-errors';
import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { setupTestDb, teardownTestDb, cleanTables, pool } from './setup.js';
import { createApp } from '../../src/app.js';
import { buildCompositionRoot } from '../../src/composition-root.js';

let app: Express;

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
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mdm.local', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: expect.objectContaining({ email: 'admin@mdm.local', isAdmin: true }),
    });
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mdm.local', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 401 for unknown user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'admin123' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mdm.local', password: 'admin123' });

    const { refreshToken } = loginRes.body as { refreshToken: string };

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    expect(refreshRes.body.refreshToken).not.toBe(refreshToken);
  });

  it('returns 401 when reusing a rotated token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mdm.local', password: 'admin123' });

    const { refreshToken } = loginRes.body as { refreshToken: string };

    await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    const reuseRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(reuseRes.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mdm.local', password: 'admin123' });

    const { accessToken } = loginRes.body as { accessToken: string };

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('admin@mdm.local');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
