import { CreateRoleSchema, RoleSchema, UpdateRoleSchema } from '@mdm/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { RoleController } from './role.controller.js';
import { authRequired, requireAdmin } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Roles';
const security = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/roles',
  tags: [tag],
  security,
  summary: 'List all roles (admin only)',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(RoleSchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/roles',
  tags: [tag],
  security,
  summary: 'Create a role',
  request: { body: { content: { 'application/json': { schema: CreateRoleSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: RoleSchema } } },
  },
});
registry.registerPath({
  method: 'get',
  path: '/roles/{id}',
  tags: [tag],
  security,
  summary: 'Get role by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: RoleSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'patch',
  path: '/roles/{id}',
  tags: [tag],
  security,
  summary: 'Update role',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateRoleSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: RoleSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/roles/{id}',
  tags: [tag],
  security,
  summary: 'Delete role',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
});

export function buildRoleRoutes(controller: RoleController): Router {
  const router = Router();

  router.get('/', authRequired, requireAdmin, controller.list);
  router.get('/:id', authRequired, requireAdmin, controller.get);
  router.post('/', authRequired, requireAdmin, validate(CreateRoleSchema), controller.create);
  router.patch('/:id', authRequired, requireAdmin, validate(UpdateRoleSchema), controller.update);
  router.delete('/:id', authRequired, requireAdmin, controller.delete);

  return router;
}
