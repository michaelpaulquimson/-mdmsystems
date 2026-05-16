import type { Permission } from '@mdm/shared';
import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../errors/http-errors.js';

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (req.user.isAdmin) return next();

    if (!req.user.permissions.includes(permission)) {
      throw new ForbiddenError(`Permission required: ${permission}`);
    }
    next();
  };
}
