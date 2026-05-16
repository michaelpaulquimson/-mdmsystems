import { CreateTeamSchema, TeamSchema, UpdateTeamSchema } from '@mdm/shared';
import { Router } from 'express';
import { z } from 'zod';

import type { TeamController } from './team.controller.js';
import { authRequired, requireAdmin } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Teams';
const security = [{ bearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/teams',
  tags: [tag],
  security,
  summary: 'List all teams (admin only)',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(TeamSchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/teams',
  tags: [tag],
  security,
  summary: 'Create a team',
  request: { body: { content: { 'application/json': { schema: CreateTeamSchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: TeamSchema } } },
  },
});
registry.registerPath({
  method: 'get',
  path: '/teams/{id}',
  tags: [tag],
  security,
  summary: 'Get team by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: TeamSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'patch',
  path: '/teams/{id}',
  tags: [tag],
  security,
  summary: 'Update team',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateTeamSchema } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: TeamSchema } } },
    404: { description: 'Not found' },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/teams/{id}',
  tags: [tag],
  security,
  summary: 'Delete team',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 204: { description: 'Deleted' }, 404: { description: 'Not found' } },
});

export function buildTeamRoutes(controller: TeamController): Router {
  const router = Router();

  router.get('/', authRequired, requireAdmin, controller.list);
  router.get('/:id', authRequired, requireAdmin, controller.get);
  router.post('/', authRequired, requireAdmin, validate(CreateTeamSchema), controller.create);
  router.patch('/:id', authRequired, requireAdmin, validate(UpdateTeamSchema), controller.update);
  router.delete('/:id', authRequired, requireAdmin, controller.delete);

  return router;
}
