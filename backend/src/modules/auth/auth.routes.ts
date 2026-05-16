import { AuthResponseSchema, AuthUserSchema, LoginSchema, RefreshSchema } from '@mdm/shared';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';

import type { AuthController } from './auth.controller.js';
import { authRequired } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Auth';
const bearerSecurity = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: [tag],
  summary: 'Login with email and password',
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: {
      description: 'Authenticated',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: { description: 'Invalid credentials' },
  },
});
registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: [tag],
  summary: 'Refresh access token',
  request: { body: { content: { 'application/json': { schema: RefreshSchema } } } },
  responses: {
    200: {
      description: 'New token pair',
      content: {
        'application/json': {
          schema: z.object({ accessToken: z.string(), refreshToken: z.string() }),
        },
      },
    },
    401: { description: 'Invalid or expired refresh token' },
  },
});
registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: [tag],
  security: bearerSecurity,
  summary: 'Revoke the current refresh token',
  responses: { 204: { description: 'Logged out' } },
});
registry.registerPath({
  method: 'get',
  path: '/auth/me',
  tags: [tag],
  security: bearerSecurity,
  summary: 'Get the currently authenticated user',
  responses: {
    200: {
      description: 'Current user',
      content: { 'application/json': { schema: AuthUserSchema } },
    },
    401: { description: 'Not authenticated' },
  },
});

export function buildAuthRoutes(
  controller: AuthController,
  loginLimiter: RequestHandler,
  refreshLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post('/login', loginLimiter, validate(LoginSchema), controller.login);
  router.post('/refresh', refreshLimiter, validate(RefreshSchema), controller.refresh);
  router.post('/logout', authRequired, validate(RefreshSchema), controller.logout);
  router.get('/me', authRequired, controller.me);

  return router;
}
