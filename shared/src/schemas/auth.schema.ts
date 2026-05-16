import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const LoginSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((v) => v.toLowerCase().trim())
      .openapi({ example: 'admin@mdm.local' }),
    password: z.string().min(1).openapi({ example: 'admin123' }),
  })
  .openapi({ description: 'Login credentials' });

export const RefreshSchema = z
  .object({
    refreshToken: z.string().min(1).openapi({ example: 'base64url-encoded-refresh-token' }),
  })
  .openapi({ description: 'Refresh token payload' });

export const AuthUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    isAdmin: z.boolean(),
    organizationId: z.string().uuid().nullable(),
    teamId: z.string().uuid().nullable(),
    roleId: z.string().uuid().nullable(),
  })
  .openapi({ description: 'Authenticated user profile' });

export const AuthResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    user: AuthUserSchema,
  })
  .openapi({ description: 'Successful login response' });

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
