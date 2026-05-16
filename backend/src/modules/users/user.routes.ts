import { CreateUserSchema, UpdateUserSchema, UserSchema } from '@mdm/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { UserController } from './user.controller.js';
import { authRequired, requireAdmin } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Users';
const security = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/users',
  tags: [tag],
  security,
  summary: 'List all users (admin only)',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(UserSchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/users',
  tags: [tag],
  security,
  summary: 'Create a user',
  request: { body: { content: { 'application/json': { schema: CreateUserSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: UserSchema } } },
  },
});
registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  tags: [tag],
  security,
  summary: 'Get user by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: UserSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  tags: [tag],
  security,
  summary: 'Update user',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateUserSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: UserSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  tags: [tag],
  security,
  summary: 'Delete user',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
});

export function buildUserRoutes(controller: UserController): Router {
  const router = Router();

  router.get('/', authRequired, requireAdmin, controller.list);
  router.get('/:id', authRequired, requireAdmin, controller.get);
  router.post('/', authRequired, requireAdmin, validate(CreateUserSchema), controller.create);
  router.patch('/:id', authRequired, requireAdmin, validate(UpdateUserSchema), controller.update);
  router.delete('/:id', authRequired, requireAdmin, controller.delete);

  return router;
}
