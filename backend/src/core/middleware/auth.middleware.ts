import { AuthUserSchema } from '@mdm/shared';
import type { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../errors/http-errors.js';

const JwtPayloadSchema = AuthUserSchema.extend({
  permissions: z.array(z.string()),
});

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  try {
    const token = header.slice(7);
    const raw = verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const parsed = JwtPayloadSchema.parse(raw);
    req.user = parsed;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    throw new ForbiddenError('Admin access required');
  }
  next();
}
