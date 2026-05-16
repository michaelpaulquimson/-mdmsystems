import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const RoleSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    name: z.string().min(2).max(100).openapi({ example: 'Editor' }),
    permissions: z
      .array(z.string())
      .openapi({ example: ['content:read', 'content:create', 'content:update', 'content:delete'] }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'A role with a set of permissions' });

export const CreateRoleSchema = RoleSchema.pick({ name: true, permissions: true }).openapi({
  description: 'Create role payload',
});

export const UpdateRoleSchema = CreateRoleSchema.partial().openapi({
  description: 'Update role payload (all fields optional)',
});

export type Role = z.infer<typeof RoleSchema>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
