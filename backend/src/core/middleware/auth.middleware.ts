import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../errors/http-errors.js';
import type { AuthenticatedUser } from '../types/express.js';

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AuthenticatedUser;
    req.user = payload;
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
