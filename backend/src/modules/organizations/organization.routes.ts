import {
  CreateOrganizationSchema,
  OrganizationSchema,
  UpdateOrganizationSchema,
} from '@mdm/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { OrganizationController } from './organization.controller.js';
import { authRequired, requireAdmin } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Organizations';
const security = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/organizations',
  tags: [tag],
  security,
  summary: 'List all organizations (admin only)',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(OrganizationSchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/organizations',
  tags: [tag],
  security,
  summary: 'Create an organization',
  request: { body: { content: { 'application/json': { schema: CreateOrganizationSchema } } } },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: OrganizationSchema } },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/organizations/{id}',
  tags: [tag],
  security,
  summary: 'Get organization by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: OrganizationSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'patch',
  path: '/organizations/{id}',
  tags: [tag],
  security,
  summary: 'Update organization',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateOrganizationSchema } } },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: OrganizationSchema } },
    },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/organizations/{id}',
  tags: [tag],
  security,
  summary: 'Delete organization',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
});

export function buildOrganizationRoutes(controller: OrganizationController): Router {
  const router = Router();

  router.get('/', authRequired, requireAdmin, controller.list);
  router.get('/:id', authRequired, requireAdmin, controller.get);
  router.post(
    '/',
    authRequired,
    requireAdmin,
    validate(CreateOrganizationSchema),
    controller.create,
  );
  router.patch(
    '/:id',
    authRequired,
    requireAdmin,
    validate(UpdateOrganizationSchema),
    controller.update,
  );
  router.delete('/:id', authRequired, requireAdmin, controller.delete);

  return router;
}
