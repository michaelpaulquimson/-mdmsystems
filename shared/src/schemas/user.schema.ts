import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const UserSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440003' }),
    email: z.string().email().openapi({ example: 'viewer@mdm.local' }),
    name: z.string().min(2).max(255).openapi({ example: 'Jane Viewer' }),
    isAdmin: z.boolean().openapi({ example: false }),
    organizationId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    teamId: z.string().uuid().nullable().openapi({ example: null }),
    roleId: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi({ description: 'A user account' });

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must contain at least one number')
  .openapi({ example: 'Secur3Pass' });

export const CreateUserSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((v) => v.toLowerCase().trim())
      .openapi({ example: 'newuser@mdm.local' }),
    name: z.string().min(2).max(255).openapi({ example: 'New User' }),
    password: passwordSchema,
    isAdmin: z.boolean().default(false).openapi({ example: false }),
    organizationId: z.string().uuid().nullable().optional().openapi({ example: null }),
    teamId: z.string().uuid().nullable().optional().openapi({ example: null }),
    roleId: z.string().uuid().nullable().optional().openapi({ example: null }),
  })
  .openapi({ description: 'Create user payload' });

export const UpdateUserSchema = CreateUserSchema.omit({ password: true })
  .extend({ password: passwordSchema.optional() })
  .partial()
  .openapi({ description: 'Update user payload (all fields optional)' });

export type User = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
