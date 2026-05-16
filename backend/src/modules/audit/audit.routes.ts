import { Router } from 'express';
import { z } from 'zod';

import type { AuditController } from './audit.controller.js';
import { authRequired, requireAdmin } from '../../core/middleware/auth.middleware.js';
import { registry } from '../../core/openapi/registry.js';

const tag = 'Audit';
const security = [{ bearerAuth: [] }];

const AuditLogEntrySchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440099' }),
    actorUserId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440003' }),
    action: z.string().openapi({ example: 'create' }),
    entityType: z.string().openapi({ example: 'organization' }),
    entityId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    organizationId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    before: z.unknown().openapi({ example: null }),
    after: z.unknown().openapi({ example: { name: 'Acme Corp' } }),
    ipAddress: z.string().nullable().openapi({ example: '127.0.0.1' }),
    userAgent: z.string().nullable().openapi({ example: 'Mozilla/5.0' }),
    occurredAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'An audit log entry' });

registry.registerPath({
  method: 'get',
  path: '/audit',
  tags: [tag],
  security,
  summary: 'List audit log entries (admin only)',
  responses: {
    200: {
      description: 'Paginated list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(AuditLogEntrySchema),
            pagination: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          }),
        },
      },
    },
  },
});

export function buildAuditRoutes(controller: AuditController): Router {
  const router = Router();

  router.get('/', authRequired, requireAdmin, controller.list);

  return router;
}
