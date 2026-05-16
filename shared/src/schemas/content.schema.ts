import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const ContentItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440004' }),
    title: z.string().min(1).max(255).openapi({ example: 'Q1 Onboarding Guide' }),
    body: z
      .string()
      .max(50_000)
      .openapi({ example: 'Welcome to Acme Corp. Here is what you need to know…' }),
    assignedToUserId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440003' }),
    createdByUserId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    organizationId: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'A content item' });

export const CreateContentSchema = ContentItemSchema.pick({
  title: true,
  body: true,
})
  .extend({
    assignedToUserId: z.string().uuid().nullable().optional().openapi({ example: null }),
  })
  .openapi({ description: 'Create content item payload' });

export const UpdateContentSchema = CreateContentSchema.partial().openapi({
  description: 'Update content item payload (all fields optional)',
});

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type CreateContentInput = z.infer<typeof CreateContentSchema>;
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;
