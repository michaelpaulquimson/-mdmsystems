import type { AuthUser } from '@mdm/shared';

export type AuthenticatedUser = AuthUser & { permissions: string[] };

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}
