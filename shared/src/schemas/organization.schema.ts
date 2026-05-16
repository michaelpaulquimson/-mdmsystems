import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const OrganizationSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    name: z.string().min(2).max(255).openapi({ example: 'Acme Corp' }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'An organization' });

export const CreateOrganizationSchema = OrganizationSchema.pick({ name: true }).openapi({
  description: 'Create organization payload',
});

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial().openapi({
  description: 'Update organization payload (all fields optional)',
});

export type Organization = z.infer<typeof OrganizationSchema>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
