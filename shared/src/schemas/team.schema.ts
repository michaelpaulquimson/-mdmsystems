import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const TeamSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440001' }),
    name: z.string().min(2).max(255).openapi({ example: 'Engineering' }),
    organizationId: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'A team within an organization' });

export const CreateTeamSchema = TeamSchema.pick({ name: true, organizationId: true }).openapi({
  description: 'Create team payload',
});

export const UpdateTeamSchema = CreateTeamSchema.partial().openapi({
  description: 'Update team payload (all fields optional)',
});

export type Team = z.infer<typeof TeamSchema>;
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
