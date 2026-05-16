import {
  ContentItemSchema,
  CreateContentSchema,
  Permissions,
  UpdateContentSchema,
} from '@mdm/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { ContentController } from './content.controller.js';
import { authRequired } from '../../core/middleware/auth.middleware.js';
import { requirePermission } from '../../core/middleware/permission.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Content';
const security = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/content',
  tags: [tag],
  security,
  summary: 'List all content items',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(ContentItemSchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/content/assigned/{userId}',
  tags: [tag],
  security,
  summary: 'Get content items assigned to a user',
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    200: {
      description: 'Assigned content items',
      content: { 'application/json': { schema: z.array(ContentItemSchema) } },
    },
    404: { description: 'User not found' },
  },
});
registry.registerPath({
  method: 'post',
  path: '/content',
  tags: [tag],
  security,
  summary: 'Create a content item',
  request: { body: { content: { 'application/json': { schema: CreateContentSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: ContentItemSchema } } },
  },
});
registry.registerPath({
  method: 'patch',
  path: '/content/{id}',
  tags: [tag],
  security,
  summary: 'Update a content item',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateContentSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: ContentItemSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/content/{id}',
  tags: [tag],
  security,
  summary: 'Delete a content item',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
});

export function buildContentRoutes(controller: ContentController): Router {
  const router = Router();

  router.get('/', authRequired, requirePermission(Permissions.CONTENT_READ), controller.list);
  router.get(
    '/assigned/:userId',
    authRequired,
    requirePermission(Permissions.CONTENT_READ),
    controller.getAssignedToUser,
  );
  router.post(
    '/',
    authRequired,
    requirePermission(Permissions.CONTENT_CREATE),
    validate(CreateContentSchema),
    controller.create,
  );
  router.patch(
    '/:id',
    authRequired,
    requirePermission(Permissions.CONTENT_UPDATE),
    validate(UpdateContentSchema),
    controller.update,
  );
  router.delete(
    '/:id',
    authRequired,
    requirePermission(Permissions.CONTENT_DELETE),
    controller.delete,
  );

  return router;
}
